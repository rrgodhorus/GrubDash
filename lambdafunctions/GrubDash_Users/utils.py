import os
import boto3
import json
from decimal import Decimal


# Shared encoder for Decimal serialization
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)

# Optional: utility shortcut for serialization
def to_json(data):
    return json.dumps(data, cls=DecimalEncoder)


def get_table():
    table_name = os.environ["USERS_TABLE"]
    dynamodb = boto3.resource('dynamodb')
    return dynamodb.Table(table_name)