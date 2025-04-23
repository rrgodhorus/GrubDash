import json
import uuid
import boto3

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('MenuItems')

def lambda_handler(event, context):
    try:
        path_parameters = event.get("pathParameters", {})
        restaurant_id = path_parameters.get("id")
        raw_body = event.get('body')
        body = json.loads(raw_body) if isinstance(raw_body, str) else raw_body

        item_id = str(uuid.uuid4())

        item = {
            'restaurant_id': restaurant_id,
            'item_id': item_id,
            'name': body.get('name'),
            'description': body.get('description'),
            'cost': body.get('cost'),
            'image_url': body.get('image_url', '')
        }

        table.put_item(Item=item)

        return {
            'statusCode': 201,
            'body': json.dumps({'message': 'Menu item added', 'item_id': item_id})
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Failed to add menu item', 'details': str(e)})
        }
