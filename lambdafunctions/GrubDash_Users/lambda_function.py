import json
import boto3
import uuid
import os
from utils import get_table

table = get_table()

# Reusable CORS-enabled response
def respond(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        },
        "body": json.dumps(body, default=str)
    }

def lambda_handler(event, context):
    method = event.get("httpMethod")
    path = event.get("path", "")
    path_params = event.get("pathParameters") or {}

    print(event)
    # GET /users/{id}
    if method == "GET" and "id" in path_params:
        user_id = path_params["id"]
        response = table.get_item(Key={"userId": user_id})
        item = response.get("Item")
        return respond(200, item) if item else respond(404, {"error": "User not found"})
    
    elif method == "PUT" and "id" in path_params:
        user_id = path_params["id"]
        data = json.loads(event['body'])
        update_expr_parts = []
        expr_attr_values = {}
        expr_attr_names = {}

        reserved_words = {'name', 'user', 'status', 'type', 'role'}  # extend as needed
        print("data is", data)
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
            'Key': {'userId': user_id},
            'UpdateExpression': update_expr,
            'ExpressionAttributeValues': expr_attr_values
        }

        print(kwargs)

        if expr_attr_names:
            kwargs['ExpressionAttributeNames'] = expr_attr_names

        res = table.update_item(**kwargs)

        print(res)

        return respond(200, {"message": "User updated successfully"})

    # Fallback for unmatched routes
    return respond(404, {"error": "Route not found"})