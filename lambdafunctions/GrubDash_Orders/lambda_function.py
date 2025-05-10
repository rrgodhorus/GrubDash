import json
import boto3
import uuid
import os
from boto3.dynamodb.conditions import Key
from decimal import Decimal
from datetime import datetime, timezone
from errors import ClientInputError
from stripe_utils import create_payment_intent
from stripe_utils import get_or_create_stripe_customer

# Environment variables
QUEUE_URL = os.environ["QUEUE_URL"]
ORDERS_TABLE = os.environ["ORDERS_TABLE"]
USERS_TABLE = os.environ["USERS_TABLE"]
ORDER_EVENTS_QUEUE = os.environ["ORDER_EVENTS_QUEUE_URL"]

# AWS clients
sqs = boto3.client("sqs")
dynamodb = boto3.resource("dynamodb")
orders_table = dynamodb.Table(ORDERS_TABLE)
users_table = dynamodb.Table(USERS_TABLE)

# Util to convert to Decimal
def normalize_decimals(obj):
    if isinstance(obj, list):
        return [normalize_decimals(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: normalize_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, float):
        return Decimal(str(obj))
    else:
        return obj

def floatify(obj):
    if isinstance(obj, list):
        return [floatify(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: floatify(v) for k, v in obj.items()}
    try:
        return float(obj)
    except (TypeError, ValueError):
        return obj

def sanitize_coordinates(coords):
    return {
        "latitude": float(coords.get("latitude", 0)),
        "longitude": float(coords.get("longitude", 0))
    }

# Reusable CORS-enabled response
def respond(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Content-Type": "application/json"
        },
        "body": json.dumps(body, default=str)
    }

def lambda_handler(event, context):
    method = event.get("httpMethod")
    path = event.get("path", "")
    path_params = event.get("pathParameters") or {}
    # print(event)

    # POST /orders
    if method == "POST" and path.endswith("/orders"):
        try:
            body = json.loads(event.get("body", "{}"))
            print(body)
            order_id = str(uuid.uuid4())
            internal_user_id = body["customer_id"]
            restaurant_id = body["restaurant_id"]
            incoming_items = body["items"]
            raw_location = body.get("delivery_location") or {}
            delivery_location = {
                "latitude": raw_location.get("latitude") or 40.65794939649306,
                "longitude": raw_location.get("longitude") or -73.95206346931113
            }

            save_card = body.get("save_card", False)

            # 0. Fetch restaurant data from Users table
            restaurant = users_table.get_item(Key={"userId": restaurant_id}).get("Item")
            if not restaurant:
                raise ClientInputError(f"Invalid restaurant ID: {restaurant_id}")

            menu = restaurant.get("menu", [])
            if not menu or not isinstance(menu, list):
                raise ClientInputError("Restaurant menu is missing or malformed")

            menu_lookup = {
                item["item_id"]: {
                    "name": item["name"],
                    "price": Decimal(item["price"])
                }
                for item in menu
            }

            restaurant_location = restaurant.get("location_coordinates")
            if not restaurant_location or "latitude" not in restaurant_location or "longitude" not in restaurant_location:
                raise ClientInputError("Restaurant location is missing or invalid")

            validated_items = []
            items_total = Decimal("0.00")

            # 1. Validate and total all items
            for item in incoming_items:
                item_id = item["id"]
                quantity = item["quantity"]

                if item_id not in menu_lookup:
                    raise ClientInputError(f"Invalid menu item: {item_id}")
                if quantity <= 0:
                    raise ClientInputError(f"Invalid quantity: {quantity} for item {item_id}")

                item_data = menu_lookup[item_id]
                unit_price = item_data["price"]

                validated_items.append({
                    "item_id": item_id,
                    "name": item_data["name"],
                    "quantity": quantity,
                    "unit_price": float(unit_price)
                })

                items_total += unit_price * quantity

            # 2. Calculate total amount
            amount_total = (items_total).quantize(Decimal("0.01"))
            amount_cents = int(amount_total * 100)

            # 3. Resolve or create Stripe customer ID
            stripe_customer_id = get_or_create_stripe_customer(internal_user_id)

            # 4. Create PaymentIntent using stripe_utils
            client_secret = create_payment_intent(
                amount_cents=amount_cents,
                customer_id=stripe_customer_id,
                order_id=order_id,
                save_card=save_card
            )
            payment_intent_id = client_secret.split("_secret")[0]

            # 5. Publish to FIFO SQS queue
            status = "payment_pending"
            now_utc = datetime.now(timezone.utc).isoformat()
            sqs_payload = {
                "order_id": order_id,
                "customer_id": internal_user_id,
                "restaurant_id": restaurant_id,
                "items": validated_items,
                "amount": float(amount_total),
                "stripe_customer_id": stripe_customer_id,
                "payment_intent_id": payment_intent_id,
                "status": status,
                "created_at": now_utc,
                "delivery_location": floatify(delivery_location),
                "restaurant_location": floatify(restaurant_location)
            }
            sqs.send_message(
                QueueUrl=ORDER_EVENTS_QUEUE,
                MessageBody=json.dumps(sqs_payload),
                MessageGroupId=order_id,
                MessageDeduplicationId=f"{order_id}|{status}"
            )

            # 6. Return info to frontend
            return respond(200, {
                "order_id": order_id,
                "clientSecret": client_secret
            })

        except ClientInputError as e:
            return respond(400, {"error": str(e)})
        except Exception as e:
            return respond(500, {"error": "Internal server error", "details": str(e)})

    # GET /orders/{id}
    elif method == "GET" and "id" in path_params:
        order_id = path_params["id"]
        response = orders_table.get_item(Key={"order_id": order_id})
        item = response.get("Item")
        return respond(200, item) if item else respond(404, {"error": "Order not found"})

    # PUT /orders/{id}/status
    elif method == "PUT" and path.endswith("/status") and "id" in path_params:
        try:
            order_id = path_params["id"]
            body = json.loads(event.get("body", "{}"))
            new_status = body.get("status")

            if not new_status:
                return respond(400, {"error": "Missing 'status' in request body"})

            now_utc = datetime.now(timezone.utc).isoformat()

            # Push status update to FIFO SQS queue
            sqs.send_message(
                QueueUrl=ORDER_EVENTS_QUEUE,
                MessageBody=json.dumps({
                    "order_id": order_id,
                    "status": new_status,
                    "updated_from_api": True,
                    "last_modified": now_utc
                }),
                MessageGroupId=order_id,
                MessageDeduplicationId=f"{order_id}|{new_status}"
            )
            return respond(200, {"message": f"Order {order_id} status update queued: {new_status}"})
        except Exception as e:
            return respond(500, {"error": "Internal server error", "details": str(e)})


    # GET /orders/user/{user_id}
    elif method == "GET" and "user_id" in path_params:
        customer_id = path_params["user_id"]
        result = orders_table.query(
            IndexName="customer_id-index",
            KeyConditionExpression=Key("customer_id").eq(customer_id)
        )
        return respond(200, result["Items"])

    # GET /orders/restaurant/{restaurant_id}
    elif method == "GET" and "restaurant_id" in path_params:
        restaurant_id = path_params["restaurant_id"]
        result = orders_table.query(
            IndexName="restaurant_id-index",
            KeyConditionExpression=Key("restaurant_id").eq(restaurant_id)
        )
        return respond(200, result["Items"])

    # Fallback for unmatched routes
    return respond(404, {"error": "Route not found"})