import boto3
import os
import json
import time

dynamodb = boto3.resource('dynamodb')
apigw = boto3.client('apigatewaymanagementapi', endpoint_url=os.environ['WEBSOCKET_ENDPOINT'])

TABLE_NAME = os.environ['TABLE_NAME']
table = dynamodb.Table(TABLE_NAME)

def lambda_handler(event, context):
    for record in event['Records']:
        print("Processing record:", record)
        try:
            body = json.loads(record['body'])
            customer_id = body.get('customerId')
            # partner_id = body.get('partnerId')
            lat = body.get('lat')
            lng = body.get('lng')
            timestamp = body.get('timestamp') or int(time.time() * 1000)

            if not customer_id or lat is None or lng is None:
                print("Missing required fields:", body)
                continue

            # Lookup WebSocket connection for customerId
            response = table.query(
                IndexName='customerId-index',
                KeyConditionExpression=boto3.dynamodb.conditions.Key('customerId').eq(customer_id)
            )

            for item in response.get('Items', []):
                connection_id = item['connectionId']

                message = {
                    "type": "location_update",
                    # "partnerId": partner_id,
                    "lat": lat,
                    "lng": lng,
                    "timestamp": timestamp
                }

                try:
                    apigw.post_to_connection(
                        ConnectionId=connection_id,
                        Data=json.dumps(message).encode('utf-8')
                    )
                    print(f"Sent location update to customer {customer_id}")
                except apigw.exceptions.GoneException:
                    print(f"Stale connection {connection_id}, deleting...")
                    table.delete_item(Key={'connectionId': connection_id})

        except Exception as e:
            print("Error processing record:", e)
