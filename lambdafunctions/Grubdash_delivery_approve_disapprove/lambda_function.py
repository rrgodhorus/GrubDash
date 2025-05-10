import json
import boto3
import os
from boto3.dynamodb.conditions import Key
from decimal import Decimal

# Setup clients and environment variables
dynamodb = boto3.resource("dynamodb")
sqs = boto3.client("sqs")

DELIVERY_TABLE = os.environ["DELIVERY_TABLE"]
DELIVERY_QUEUE_URL = os.environ["DELIVERY_QUEUE_URL"]

delivery_table = dynamodb.Table(DELIVERY_TABLE)


def normalize_decimals(obj):
    if isinstance(obj, list):
        return [normalize_decimals(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: normalize_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        return float(obj) if obj % 1 else int(obj)
    return obj

def lambda_handler(event, context):
    body = json.loads(event['body'])
    delivery_id = body['delivery_id']
    status = body['status']

    # Fetch delivery from DynamoDB
    try:
        response = delivery_table.get_item(Key={"delivery_id": delivery_id})
        delivery_item = response.get("Item")
        
        if not delivery_item:
            return {
                'statusCode': 404,
                'body': json.dumps(f"Delivery ID {delivery_id} not found.")
            }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps(f"Error fetching from DynamoDB: {str(e)}")
        }

    # Update status field
    delivery_item["status"] = status

    # Push to SQS queue
    try:
        sqs.send_message(
            QueueUrl=DELIVERY_QUEUE_URL,
            MessageBody=json.dumps(normalize_decimals(delivery_item)),
            MessageGroupId=delivery_id,
            MessageDeduplicationId=f"{delivery_id}|{status}"
        )
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps(f"Error sending to SQS: {str(e)}")
        }

    return {
        'statusCode': 200,
        'body': json.dumps(f"Delivery {delivery_id} updated and pushed to queue.")
    }
