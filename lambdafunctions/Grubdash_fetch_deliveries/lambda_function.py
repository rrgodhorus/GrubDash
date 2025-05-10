import json
import boto3
from datetime import datetime, timezone, timedelta
from boto3.dynamodb.conditions import Key
import os
from decimal import Decimal

dynamodb = boto3.resource("dynamodb")
DELIVERY_TABLE = os.environ["DELIVERY_TABLE"]
delivery_table = dynamodb.Table(DELIVERY_TABLE)

def json_safe(data):
    if isinstance(data, list):
        return [json_safe(i) for i in data]
    elif isinstance(data, dict):
        return {k: json_safe(v) for k, v in data.items()}
    elif isinstance(data, Decimal):
        return float(data) if data % 1 else int(data)
    return data

def lambda_handler(event, context):
    raw_path = event.get("rawPath", "")
    path_parts = raw_path.strip("/").split("/")

    if path_parts == ["partners"]:
        # GET /partners → recent deliveries
        now = datetime.now(timezone.utc)
        ten_minutes_ago = now - timedelta(minutes=10)

        statuses = ["dp_assigned", "dp_confirmed", "dp_order_received"]
        items = []

        for status in statuses:
            resp = delivery_table.query(
                IndexName="created_at-index",
                KeyConditionExpression=Key("status").eq(status) &
                                    Key("created_at").between(
                                        ten_minutes_ago.isoformat(),
                                        now.isoformat()
                                    )
            )
            items.extend(resp["Items"])
        items = json_safe(items)
        return {
            "statusCode": 200,
            "body": json.dumps(items)
        }

    elif len(path_parts) == 2 and path_parts[0] == "partners":
        # GET /partners/{delivery_id}
        delivery_id = path_parts[1]
        response = delivery_table.get_item(Key={"delivery_id": delivery_id})
        item = response.get("Item")

        if not item:
            return {"statusCode": 404, "body": json.dumps({"error": "Delivery not found"})}

        return {
            "statusCode": 200,
            "body": json.dumps(json_safe(item))
        }

    else:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Unsupported route"})
        }
