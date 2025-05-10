# lambda_send_update.py
import boto3
import json
import os

TABLE_NAME = os.environ['TABLE_NAME']
API_GW_ENDPOINT = os.environ['API_GW_ENDPOINT']

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)

apigw = boto3.client(
    'apigatewaymanagementapi',
    endpoint_url=API_GW_ENDPOINT
)

def lambda_handler(event, context):
    print(event)
    # data = json.loads(event)  # e.g., {"restaurantId": "r1", "orderId": "...", "status": "NEW_ORDER"}
    data = event
    restaurant_id = data['restaurantId']
    # order_id = data['orderId']
    # status = data['status']

    # Query connections for that restaurantId
    response = table.query(
        IndexName='restaurantId-index',
        KeyConditionExpression=boto3.dynamodb.conditions.Key('restaurantId').eq(restaurant_id)
    )

    for conn in response['Items']:
        try:
            apigw.post_to_connection(
                ConnectionId=conn['connectionId'],
                Data=json.dumps(data).encode('utf-8')
            )
        except apigw.exceptions.GoneException:
            table.delete_item(Key={'connectionId': conn['connectionId']})

    return { 'statusCode': 200 }