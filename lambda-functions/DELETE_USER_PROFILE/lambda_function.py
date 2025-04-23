import json
from utils import get_table

def lambda_handler(event, context):
    user_id = event['pathParameters']['id']
    table = get_table()

    table.delete_item(Key={'user_id': user_id})

    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'User deleted successfully'})
    }