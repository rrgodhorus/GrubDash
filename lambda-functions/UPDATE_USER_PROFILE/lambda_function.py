import json
from utils import get_table

def lambda_handler(event, context):
    user_id = event.get('pathParameters', {}).get('id')
    if not user_id:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Missing user_id in pathParameters'})
        }
    data = json.loads(event['body'])

    update_expr_parts = []
    expr_attr_values = {}
    expr_attr_names = {}

    reserved_words = {'name', 'user', 'status', 'type', 'role'}  # extend as needed

    for key, value in data.items():
        if key in reserved_words:
            alias = f"#{key[:1]}"
            expr_attr_names[alias] = key
            update_expr_parts.append(f"{alias} = :{key}")
        else:
            update_expr_parts.append(f"{key} = :{key}")
        expr_attr_values[f":{key}"] = value

    update_expr = "SET " + ", ".join(update_expr_parts)

    kwargs = {
        'Key': {'user_id': user_id},
        'UpdateExpression': update_expr,
        'ExpressionAttributeValues': expr_attr_values
    }

    if expr_attr_names:
        kwargs['ExpressionAttributeNames'] = expr_attr_names

    table = get_table()
    table.update_item(**kwargs)

    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'User updated successfully'})
    }


# note: update a field in address will change the entire row in dynamo table
# TODO: add/remove address?
