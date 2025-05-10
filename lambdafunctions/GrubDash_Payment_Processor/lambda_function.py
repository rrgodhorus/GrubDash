import json
import os
import stripe
import boto3
from boto3.dynamodb.conditions import Key
from datetime import datetime, timezone

stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
USERS_TABLE = os.environ["USERS_TABLE"]
ORDERS_TABLE = os.environ.get("ORDERS_TABLE") 
ORDER_EVENTS_QUEUE = os.environ["ORDER_EVENTS_QUEUE_URL"]
WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")

sqs = boto3.client("sqs")
dynamodb = boto3.resource("dynamodb")
users_table = dynamodb.Table(USERS_TABLE)
orders_table = dynamodb.Table(ORDERS_TABLE) if ORDERS_TABLE else None

def respond(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Content-Type": "application/json"
        },
        "body": json.dumps(body)
    }

def lambda_handler(event, context):
    method = event.get("httpMethod")
    path_params = event.get("pathParameters") or {}
    resource_path = event.get("resource", "")

    # Handle: GET /payment/users/{user_id}
    if method == "GET" and "user_id" in path_params and "/payment/users/" in resource_path:
        user_id = path_params["user_id"]

        # 1. Lookup Stripe customer ID from USERS_TABLE
        response = users_table.get_item(Key={"userId": user_id})
        user = response.get("Item")

        if not user or "stripe_customer_id" not in user:
            return respond(200, {
                "cards": [],
                "info": "No Stripe customer found for this user."
            })

        customer_id = user["stripe_customer_id"]

        try:
            payment_methods = stripe.PaymentMethod.list(
                customer=customer_id,
                type="card"
            )

            cards = [
                {
                    "id": pm.id,
                    "brand": pm.card.brand,
                    "last4": pm.card.last4,
                    "exp_month": pm.card.exp_month,
                    "exp_year": pm.card.exp_year
                }
                for pm in payment_methods.auto_paging_iter()
            ]

            return respond(200, {"cards": cards})

        except Exception as e:
            return respond(500, {"error": str(e)})

    # Handle: POST /payment/events (Stripe webhook)
    elif method == "POST" and "/payment/events" in resource_path:
        payload = event.get("body", "")
        sig_header = event["headers"].get("Stripe-Signature")

        try:
            stripe_event = stripe.Webhook.construct_event(
                payload, sig_header, WEBHOOK_SECRET
            )
        except stripe.error.SignatureVerificationError:
            return respond(400, {"error": "Invalid Stripe signature"})

        event_type = stripe_event["type"]
        data = stripe_event["data"]["object"]
        order_id = data.get("metadata", {}).get("order_id")

        if not order_id:
            return respond(200, {"message": "No order_id in metadata"})

        if event_type == "payment_intent.succeeded":
            new_status = "payment_confirmed"
        elif event_type == "payment_intent.payment_failed":
            new_status = "payment_failed"
        else:
            return respond(200, {"message": f"Ignored event type: {event_type}"})

        try:
            # Imdempotency: check current order status to avoid duplicate state push
            order = orders_table.get_item(Key={"order_id": order_id}).get("Item")
            if order and order.get("status") == new_status:
                return respond(200, {"message": f"Order already in {new_status}"})

            now_utc = datetime.now(timezone.utc).isoformat()

            # Push to FIFO queue for state transition
            sqs.send_message(
                QueueUrl=ORDER_EVENTS_QUEUE,
                MessageBody=json.dumps({
                    "order_id": order_id,
                    "status": new_status,
                    "updated_from_webhook": True,
                    "last_modified": now_utc
                }),
                MessageGroupId=order_id,
                MessageDeduplicationId=f"{order_id}|{new_status}"
            )
            return respond(200, {"message": f"Event queued for order {order_id}: {new_status}"})
        except Exception as e:
            return respond(500, {"error": str(e)})

    return respond(404, {"error": "Route not found"})