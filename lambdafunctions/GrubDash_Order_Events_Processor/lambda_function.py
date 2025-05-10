import os
import json
from decimal import Decimal
from datetime import datetime, timezone
import boto3
import uuid

# Setup
sqs = boto3.client("sqs")
lambda_client = boto3.client("lambda")
dynamodb = boto3.resource("dynamodb")
ORDERS_TABLE = os.environ["ORDERS_TABLE"]
orders_table = dynamodb.Table(ORDERS_TABLE)
ORDER_BATCHING_QUEUE = os.environ["ORDER_BATCHING_QUEUE_URL"]
DELIVERY_EVENTS_QUEUE = os.environ["DELIVERY_EVENTS_QUEUE_URL"]

# Convert floats to Decimal for DynamoDB compatibility
def normalize_decimals(data):
    if isinstance(data, list):
        return [normalize_decimals(i) for i in data]
    elif isinstance(data, dict):
        return {k: normalize_decimals(v) for k, v in data.items()}
    elif isinstance(data, float):
        return Decimal(str(data))
    return data

# Convert Decimal to floats for JSON serialization compatibility
def floatify(value):
    """Recursively convert Decimal types to float for JSON serialization."""
    if isinstance(value, list):
        return [floatify(v) for v in value]
    elif isinstance(value, dict):
        return {k: floatify(v) for k, v in value.items()}
    elif isinstance(value, Decimal):
        return float(value)
    return value

def getPickupZone(coordinates):
    lat = float(coordinates["latitude"])
    lon = float(coordinates["longitude"])
    return f"zone-{int(lat * 10)}-{int(lon * 10)}"

def handle_order_creation(body, now_utc):
    order_id = body["order_id"]
    existing = orders_table.get_item(Key={"order_id": order_id}).get("Item")

    if existing:
        print(f"[SKIP] Order {order_id} already exists.")
        return
    payload = {
        "order_id": order_id,
        "customer_id": body["customer_id"],
        "restaurant_id": body["restaurant_id"],
        "stripe_customer_id": body.get("stripe_customer_id"),
        "payment_intent_id": body.get("payment_intent_id"),
        "items": normalize_decimals(body["items"]),
        "amount": normalize_decimals(body.get("amount", 0)),
        "delivery_location": normalize_decimals(body.get("delivery_location")),
        "restaurant_location": normalize_decimals(body.get("restaurant_location")),
        "status": "payment_pending",
        "created_at": body.get("created_at", now_utc),
        "last_modified": now_utc
    }   
    print(payload)
    orders_table.put_item(Item=payload)
    print(f"[CREATE] Order {order_id} stored with status: payment_pending")


def handle_payment_state_update(body, now_utc):
    order_id = body["order_id"]
    new_status = body["status"]

    existing = orders_table.get_item(Key={"order_id": order_id}).get("Item")
    if not existing:
        print(f"[SKIP] Order {order_id} not found for status update.")
        return

    if existing.get("status") == new_status:
        print(f"[SKIP] Order {order_id} already in state: {new_status}")
        return

    update_expr = "SET #s = :s, last_modified = :lm"
    expr_vals = {
        ":s": new_status,
        ":lm": now_utc
    }
    expr_names = {"#s": "status"}

    orders_table.update_item(
        Key={"order_id": order_id},
        UpdateExpression=update_expr,
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_vals
    )
    print(f"[UPDATE] Order {order_id} status moved to: {new_status}")

    # Update the restaurant after payment confirmation
    if new_status == "payment_confirmed":
        try:
            notification_payload = {
                "restaurantId": existing["restaurant_id"],
                "orderId": existing["order_id"],
                "items": [
                    {
                        "id": item["item_id"],
                        "quantity": int(item["quantity"]),
                        "name": item["name"],
                    }
                    for item in existing.get("items", [])
                ]
            }
            print(f"[NOTIFY] order_notifications payload: {notification_payload}")
            lambda_client.invoke(
                FunctionName="Grubdash_Orders_notifications",
                InvocationType="Event",  # async
                Payload=json.dumps(notification_payload).encode("utf-8")
            )
            print(f"[NOTIFY] order_notifications triggered for {order_id}")
        except Exception as e:
            print(f"[WARN] Failed to notify restaurant for {order_id}: {e}")

def handle_order_confirmed(body, now_utc):
    order_id = body["order_id"]
    existing = orders_table.get_item(Key={"order_id": order_id}).get("Item")

    if not existing:
        print(f"[SKIP] Order {order_id} not found for confirmation.")
        return

    if existing.get("status") == "order_confirmed":
        print(f"[SKIP] Order {order_id} already confirmed.")
        return

    update_expr = "SET #s = :s, last_modified = :lm"
    expr_vals = {
        ":s": "order_confirmed",
        ":lm": now_utc
    }
    expr_names = {"#s": "status"}

    orders_table.update_item(
        Key={"order_id": order_id},
        UpdateExpression=update_expr,
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_vals
    )
    print(f"[UPDATE] Order {order_id} status moved to: order_confirmed")

    # Prepare SQS delivery payload
    delivery_id = str(uuid.uuid4())
    delivery_payload = {
        "delivery_id": delivery_id,
        "order_id": existing["order_id"],
        "customer_id": existing["customer_id"],
        "restaurant_id": existing["restaurant_id"],
        "items": floatify(existing.get("items", [])),
        "amount": float(existing["amount"]),
        "delivery_location": floatify(existing.get("delivery_location", {})),
        "restaurant_location": floatify(existing.get("restaurant_location", {})),
        "status": "dp_pending"
    }

    pickup_zone = getPickupZone(existing["restaurant_location"])

    # Push to order batching queue
    order_batching_payload = {
        "order_id": existing["order_id"],
        "customer_id": existing["customer_id"],
        "restaurant_id": existing["restaurant_id"],
        "items": floatify(existing.get("items", [])),
        "amount": float(existing["amount"]),
        "delivery_location": floatify(existing.get("delivery_location", {})),
        "restaurant_location": floatify(existing.get("restaurant_location", {})),
        "pickup_zone": pickup_zone,
        "attempt": 1,
        "status": "dp_pending"
    }
    sqs.send_message(
        QueueUrl=ORDER_BATCHING_QUEUE,
        MessageBody=json.dumps(order_batching_payload),
        MessageGroupId=pickup_zone,
        MessageDeduplicationId=f"{existing["order_id"]}|attempt-1"
    )

    # Push to delivery queue
    # sqs.send_message(
    #     QueueUrl=DELIVERY_EVENTS_QUEUE,
    #     MessageBody=json.dumps(delivery_payload),
    #     MessageGroupId=delivery_id,
    #     MessageDeduplicationId=f"{delivery_id}|dp_pending"
    # )
    print(f"[ENQUEUE] Delivery event queued for order {order_id}")


def handle_order_cancelled(body, now_utc):
    order_id = body["order_id"]
    existing = orders_table.get_item(Key={"order_id": order_id}).get("Item")

    if not existing:
        print(f"[SKIP] Order {order_id} not found for cancellation.")
        return

    if existing.get("status") == "order_cancelled":
        print(f"[SKIP] Order {order_id} already cancelled.")
        return

    update_expr = "SET #s = :s, last_modified = :lm"
    expr_vals = {
        ":s": "order_cancelled",
        ":lm": now_utc
    }
    expr_names = {"#s": "status"}

    orders_table.update_item(
        Key={"order_id": order_id},
        UpdateExpression=update_expr,
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_vals
    )
    print(f"[UPDATE] Order {order_id} status moved to: order_cancelled")

def handle_ready_for_delivery(body, now_utc):
    order_id = body["order_id"]
    existing = orders_table.get_item(Key={"order_id": order_id}).get("Item")

    if not existing:
        print(f"[SKIP] Order {order_id} not found for delivery.")
        return

    if existing.get("status") == "ready_for_delivery":
        print(f"[SKIP] Order {order_id} already ready for delivery.")
        return
    
    if existing.get("status") == "delivered":
        print(f"[SKIP] Order {order_id} already delivered.")
        return

    update_expr = "SET #s = :s, last_modified = :lm"
    expr_vals = {
        ":s": "ready_for_delivery",
        ":lm": now_utc
    }
    expr_names = {"#s": "status"}

    orders_table.update_item(
        Key={"order_id": order_id},
        UpdateExpression=update_expr,
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_vals
    )
    print(f"[UPDATE] Order {order_id} status moved to: ready_for_delivery")

def handle_order_picked_up(body, now_utc):
    order_id = body["order_id"]
    existing = orders_table.get_item(Key={"order_id": order_id}).get("Item")

    if not existing:
        print(f"[SKIP] Order {order_id} not found for delivery.")
        return

    if existing.get("status") == "order_picked_up":
        print(f"[SKIP] Order {order_id} already picked up.")
        return

    if existing.get("status") == "delivered":
        print(f"[SKIP] Order {order_id} already delivered.")
        return

    update_expr = "SET #s = :s, last_modified = :lm"
    expr_vals = {
        ":s": "order_picked_up",
        ":lm": now_utc
    }
    expr_names = {"#s": "status"}

    orders_table.update_item(
        Key={"order_id": order_id},
        UpdateExpression=update_expr,
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_vals
    )
    print(f"[UPDATE] Order {order_id} status moved to: order_picked_up")

def handle_order_delivered(body, now_utc):
    order_id = body["order_id"]
    existing = orders_table.get_item(Key={"order_id": order_id}).get("Item")

    if not existing:
        print(f"[SKIP] Order {order_id} not found for delivery.")
        return

    if existing.get("status") == "delivered":
        print(f"[SKIP] Order {order_id} already delivered.")
        return

    update_expr = "SET #s = :s, last_modified = :lm"
    expr_vals = {
        ":s": "delivered",
        ":lm": now_utc
    }
    expr_names = {"#s": "status"}

    orders_table.update_item(
        Key={"order_id": order_id},
        UpdateExpression=update_expr,
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_vals
    )
    print(f"[UPDATE] Order {order_id} status moved to: delivered")

def handle_dp_confirmed(body, now_utc):
    order_id = body["order_id"]
    delivery_id = body["delivery_id"]
    existing = orders_table.get_item(Key={"order_id": order_id}).get("Item")

    if not existing:
        print(f"[SKIP] Order {order_id} not found for delivery.")
        return

    update_expr = "SET #lm = :lm, #d = :d"
    expr_vals = {
        ":lm": now_utc,
        ":d": delivery_id
    }
    expr_names = {
        "#lm": "last_modified",
        "#d": "delivery_id"
    }

    orders_table.update_item(
        Key={"order_id": order_id},
        UpdateExpression=update_expr,
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_vals
    )

    print(f"[UPDATE] Order {order_id} linked to delivery {delivery_id}, last_modified updated.")


# Status dispatcher
status_handlers = {
    "payment_pending": handle_order_creation,
    "payment_confirmed": handle_payment_state_update,
    "payment_failed": handle_payment_state_update,
    "order_confirmed": handle_order_confirmed,
    "order_cancelled": handle_order_cancelled,
    "ready_for_delivery": handle_ready_for_delivery,
    "dp_confirmed": handle_dp_confirmed,
    "order_picked_up": handle_order_picked_up,
    "delivered": handle_order_delivered
    # Add more status keys if needed
}

def lambda_handler(event, context):
    for record in event["Records"]:
        try:
            body = json.loads(record["body"])
            status = body.get("status")
            now_utc = datetime.now(timezone.utc).isoformat()

            if not status or status not in status_handlers:
                print(f"[SKIP] Unhandled or missing status: {status}")
                continue

            # Route to handler
            status_handlers[status](body, now_utc)

        except Exception as e:
            print(f"[ERROR] Failed processing message {record.get('messageId')}: {e}")
            raise e  # Retry or DLQ
