import boto3
import json

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('Users')

def lambda_handler(event, context):
    user_id = event['pathParameters']['id']

    table.delete_item(Key={'user_id': user_id})

    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'User deleted successfully'})
    }
