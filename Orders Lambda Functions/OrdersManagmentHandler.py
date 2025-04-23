import json
import boto3
import uuid
import os
from boto3.dynamodb.conditions import Key

# Environment variables
QUEUE_URL = os.environ["QUEUE_URL"]
TABLE_NAME = os.environ["ORDERS_TABLE"]

# AWS clients
sqs = boto3.client("sqs")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)

# Reusable CORS-enabled response
def respond(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        },
        "body": json.dumps(body, default=str)
    }

def lambda_handler(event, context):
    method = event.get("httpMethod")
    path = event.get("path", "")
    path_params = event.get("pathParameters") or {}

    # POST /orders
    if method == "POST" and path.endswith("/orders"):
        try:
            body = json.loads(event.get("body", "{}"))
            order_id = str(uuid.uuid4())

            message = {
                "order_id": order_id,
                "user_id": body["user_id"],
                "restaurant_id": body["restaurant_id"],
                "items": body["items"]
            }

            sqs.send_message(
                QueueUrl=QUEUE_URL,
                MessageBody=json.dumps(message)
            )

            return respond(200, {"message": "Order received", "order_id": order_id})
        except Exception as e:
            return respond(400, {"error": str(e)})

    # GET /orders/{id}
    elif method == "GET" and "id" in path_params:
        order_id = path_params["id"]
        response = table.get_item(Key={"order_id": order_id})
        item = response.get("Item")
        return respond(200, item) if item else respond(404, {"error": "Order not found"})

    # PUT /orders/{id}/status
    elif method == "PUT" and path.endswith("/status") and "id" in path_params:
        order_id = path_params["id"]
        body = json.loads(event.get("body", "{}"))
        new_status = body.get("status")

        table.update_item(
            Key={"order_id": order_id},
            UpdateExpression="SET #s = :s",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":s": new_status}
        )
        return respond(200, {"message": "Order status updated"})

    # PUT /orders/{id}/cancel
    elif method == "PUT" and path.endswith("/cancel") and "id" in path_params:
        order_id = path_params["id"]
        result = table.get_item(Key={"order_id": order_id})
        order = result.get("Item")

        if not order:
            return respond(404, {"error": "Order not found"})

        if order["status"] in ["Placed", "Accepted"]:
            table.update_item(
                Key={"order_id": order_id},
                UpdateExpression="SET #s = :s",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={":s": "Cancelled"}
            )
            return respond(200, {"message": "Order cancelled"})
        else:
            return respond(403, {"error": "Too late to cancel"})

    # GET /orders/user/{user_id}
    elif method == "GET" and "user_id" in path_params:
        customer_id = path_params["user_id"]
        result = table.query(
            IndexName="customer_id-index",
            KeyConditionExpression=Key("customer_id").eq(customer_id)
        )
        return respond(200, result["Items"])

    # GET /orders/restaurant/{restaurant_id}
    elif method == "GET" and "restaurant_id" in path_params:
        restaurant_id = path_params["restaurant_id"]
        result = table.query(
            IndexName="restaurant_id-index",
            KeyConditionExpression=Key("restaurant_id").eq(restaurant_id)
        )
        return respond(200, result["Items"])

    # Fallback for unmatched routes
    return respond(404, {"error": "Route not found"})
