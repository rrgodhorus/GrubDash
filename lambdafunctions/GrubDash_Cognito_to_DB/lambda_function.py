import boto3
import os
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
table_name = 'grubdash_users'
table = dynamodb.Table(table_name)

def lambda_handler(event, context):
    user = event['request']['userAttributes']

    item = {
        'userId': user['sub'],
        'email': user.get('email', ''),
        'name': user.get('name', ''),
        'createdAt': datetime.utcnow().isoformat(),
    }

    table.put_item(Item=item)

    return event
