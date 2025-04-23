import json
import uuid
import boto3

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('Restaurants')

def lambda_handler(event, context):
    try:
        # Handles both API Gateway proxy and test input
        raw_body = event.get('body')
        if raw_body:
            if isinstance(raw_body, str):
                body = json.loads(raw_body)
            else:
                body = raw_body  # already a dict
        else:
            body = event  # Fallback: raw event is the payload
    except Exception as e:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Invalid input', 'details': str(e)})
        }

    restaurant_id = str(uuid.uuid4())
    item = {
        'id': restaurant_id,
        'name': body.get('name'),
        'email': body.get('email'),
        'mobile_number': body.get('mobile_number'),
        'address': body.get('address')
    }

    try:
        table.put_item(Item=item)
        return {
            'statusCode': 201,
            'body': json.dumps({'message': 'Restaurant created', 'id': restaurant_id})
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Failed to save restaurant', 'details': str(e)})
        }
