import boto3
import os

dynamodb = boto3.resource('dynamodb')
TABLE_NAME = os.environ['TABLE_NAME']
table = dynamodb.Table(TABLE_NAME)

def lambda_handler(event, context):
    print("disconnecting...")
    print(event)
    connection_id = event['requestContext']['connectionId']

    table.delete_item(Key={
        'connectionId': connection_id
    })

    return { 'statusCode': 200 }