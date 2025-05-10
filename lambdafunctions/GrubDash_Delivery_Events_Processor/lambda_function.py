import os
import json
from decimal import Decimal
from datetime import datetime, timezone
import boto3

# === Setup ===
DELIVERY_TABLE = os.environ["DELIVERY_TABLE"]
ORDERS_QUEUE = os.environ["ORDERS_QUEUE"]
dynamodb = boto3.resource("dynamodb")
sqs = boto3.client("sqs")
delivery_table = dynamodb.Table(DELIVERY_TABLE)
lambda_client = boto3.client("lambda")

# === Helpers ===

def floatify(obj):
    if isinstance(obj, list):
        return [floatify(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: floatify(v) for k, v in obj.items()}
    try:
        return float(obj)
    except (TypeError, ValueError):
        return obj

def normalize_decimals(data):
    if isinstance(data, list):
        return [normalize_decimals(i) for i in data]
    elif isinstance(data, dict):
        return {k: normalize_decimals(v) for k, v in data.items()}
    elif isinstance(data, float):
        return Decimal(str(data))
    return data

# === Delivery Event Handlers ===

def handle_dp_assigned(event, now_utc):
    print(event)
    delivery_id = event["delivery_id"]
    partner_id = event["partner_id"]
    orders = event["orders"]

    existing = delivery_table.get_item(Key={"delivery_id": delivery_id}).get("Item")
    if existing:
        print(f"[SKIP] Delivery {delivery_id} exists.")
        return

    # delivery_table.put_item(Item={
    #     "delivery_id": delivery_id,
    #     "order_id": order_id,
    #     "customer_id": event["customer_id"],
    #     "restaurant_id": event["restaurant_id"],
    #     "items": normalize_decimals(event.get("items", [])),
    #     "amount": normalize_decimals(event.get("amount", 0)),
    #     "delivery_location": normalize_decimals(event.get("delivery_location", {})),
    #     "restaurant_location": normalize_decimals(event.get("restaurant_location", {})),
    #     "status": "dp_pending",
    #     "created_at": now_utc,
    #     "last_modified": now_utc 
    # })

    delivery_table.put_item(Item={
        "delivery_id": delivery_id,
        "partner_id": partner_id,
        "status": "dp_assigned",
        "created_at": now_utc,
        "last_modified": now_utc ,
        "orders": normalize_decimals(orders)
    })


    print(f"[CREATE] Delivery {delivery_id} recorded with status: dp_assigned")

def handle_dp_confirmed(event, now_utc):
    print(event)
    delivery_id = event["delivery_id"]
    partner_id = event["partner_id"]
    orders = event["orders"]

    existing = delivery_table.get_item(Key={"delivery_id": delivery_id}).get("Item")
    if not existing:
        print(f"[SKIP] Delivery {delivery_id} does not exist.")
        return

    delivery_table.update_item(
        Key={"delivery_id": delivery_id},
        UpdateExpression="SET #status = :status, #last_modified = :last_modified",
        ExpressionAttributeNames={
            "#status": "status",
            "#last_modified": "last_modified"
        },
        ExpressionAttributeValues={
            ":status": "dp_confirmed",
            ":last_modified": now_utc
        }
    )

    for order in orders:
        message_body = {
            "order_id": order["order_id"],
            "delivery_id": delivery_id,
            "status": "dp_confirmed"
        }
        sqs.send_message(
            QueueUrl=ORDERS_QUEUE,
            MessageBody=json.dumps(message_body),
            MessageGroupId=f"{order['order_id']}|dp_confirmed"
        )

    print(f"[UPDATE] Delivery {delivery_id} updated with status: dp_confirmed")

def handle_dp_order_received(event, now_utc):
    print(event)
    delivery_id = event["delivery_id"]
    partner_id = event["partner_id"]
    orders = event["orders"]

    existing = delivery_table.get_item(Key={"delivery_id": delivery_id}).get("Item")
    if not existing:
        print(f"[SKIP] Delivery {delivery_id} does not exist.")
        return

    delivery_table.update_item(
        Key={"delivery_id": delivery_id},
        UpdateExpression="SET #status = :status, #last_modified = :last_modified",
        ExpressionAttributeNames={
            "#status": "status",
            "#last_modified": "last_modified"
        },
        ExpressionAttributeValues={
            ":status": "dp_order_received",
            ":last_modified": now_utc
        }
    )

    for order in orders:
        message_body = {
            "order_id": order["order_id"],
            "status": "dp_order_received"
        }
        sqs.send_message(
            QueueUrl=ORDERS_QUEUE,
            MessageBody=json.dumps(message_body),
            MessageGroupId=f"{order['order_id']}|dp_order_received"
        )

    print(f"[UPDATE] Delivery {delivery_id} updated with status: dp_order_received")

def handle_dp_delivered(event, now_utc):
    print(event)
    delivery_id = event["delivery_id"]
    partner_id = event["partner_id"]
    orders = event["orders"]

    existing = delivery_table.get_item(Key={"delivery_id": delivery_id}).get("Item")
    if not existing:
        print(f"[SKIP] Delivery {delivery_id} does not exist.")
        return

    delivery_table.update_item(
        Key={"delivery_id": delivery_id},
        UpdateExpression="SET #status = :status, #last_modified = :last_modified",
        ExpressionAttributeNames={
            "#status": "status",
            "#last_modified": "last_modified"
        },
        ExpressionAttributeValues={
            ":status": "dp_delivered",
            ":last_modified": now_utc
        }
    )

    # Update Redis with status online here
    response = lambda_client.invoke(
        FunctionName='Grubdash_deliveries_update_location',
        InvocationType='RequestResponse', 
        Payload=json.dumps({
            "deliveryPartnerId": partner_id,
            "status": "offline",
        }).encode("utf-8")
    )

    response_payload = json.load(response['Payload'])
    print("Redis Update Response:", response_payload)

    for order in orders:
        message_body = {
            "order_id": order["order_id"],
            "status": "delivered"
        }
        sqs.send_message(
            QueueUrl=ORDERS_QUEUE,
            MessageBody=json.dumps(message_body),
            MessageGroupId=f"{order['order_id']}|delivered"
        )

    print(f"[UPDATE] Delivery {delivery_id} updated with status: delivered")

# === Dispatcher ===

delivery_status_handlers = {
    "dp_assigned": handle_dp_assigned,
    "dp_confirmed": handle_dp_confirmed,
    "dp_order_received": handle_dp_order_received,
    "dp_delivered": handle_dp_delivered,
    # ...
}

# === Lambda Entry Point ===

def lambda_handler(event, context):
    for record in event["Records"]:
        try:
            body = json.loads(record["body"])
            status = body.get("status")
            now_utc = datetime.now(timezone.utc).isoformat()

            if not status or status not in delivery_status_handlers:
                print(f"[SKIP] Unhandled or missing status: {status}")
                continue

            # Route to handler
            delivery_status_handlers[status](body, now_utc)

        except Exception as e:
            print(f"[ERROR] Failed processing message {record.get('messageId')}: {e}")
            raise e  # Ensure failure is visible to trigger retry or DLQ

