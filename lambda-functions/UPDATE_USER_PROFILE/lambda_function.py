import boto3
import json

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('Users')

def lambda_handler(event, context):
    user_id = event['pathParameters']['id']
    data = json.loads(event['body'])

    update_expr = "SET " + ", ".join([f"{k}=:{k}" for k in data])
    expr_vals = {f":{k}": v for k, v in data.items()}

    table.update_item(
        Key={'user_id': user_id},
        UpdateExpression=update_expr,
        ExpressionAttributeValues=expr_vals
    )

    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'User updated successfully'})
    }
