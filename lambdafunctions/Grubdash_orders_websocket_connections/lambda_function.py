import boto3
import time
import json
import os

dynamodb = boto3.resource('dynamodb')
TABLE_NAME = os.environ['TABLE_NAME']
table = dynamodb.Table(TABLE_NAME)

def lambda_handler(event, context):
    print("Connecting...")
    print(event)
    connection_id = event['requestContext']['connectionId']
    
    query_params = event.get('queryStringParameters', {})
    restaurant_id = query_params.get('restaurantId')
    customer_id = query_params.get('customerId')

    if not restaurant_id and not customer_id:
        return { 'statusCode': 400, 'body': 'Missing restaurantId or customerId' }

    user_type = 'restaurant' if restaurant_id else 'customer'
    user_id = restaurant_id or customer_id
    index_name = f"{user_type}Id-index"
    id_key = f"{user_type}Id"
    
    response = table.query(
        IndexName=index_name,
        KeyConditionExpression=boto3.dynamodb.conditions.Key(id_key).eq(user_id)
    )

    for item in response.get('Items', []):
        old_id = item['connectionId']
        if old_id != connection_id:
            table.delete_item(Key={'connectionId': old_id})
            print(f"Deleted old connection: {old_id}")

    response = table.put_item(Item={
        'connectionId': connection_id,
        id_key: user_id,
        'timestamp': int(time.time() * 1000)
    })
    print("Connection saved to DynamoDB:", response)
    return { 'statusCode': 200 }
