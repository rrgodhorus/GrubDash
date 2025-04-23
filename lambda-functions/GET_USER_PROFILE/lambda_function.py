from utils import get_table, to_json

def lambda_handler(event, context):
    user_id = event['pathParameters']['id']
    table = get_table()

    response = table.get_item(Key={'user_id': user_id})

    if 'Item' in response:
        return {
            'statusCode': 200,
            'body': to_json(response['Item'])  # 🔥 Clean and consistent
        }
    else:
        return {
            'statusCode': 404,
            'body': to_json({'message': 'User not found'})
        }
