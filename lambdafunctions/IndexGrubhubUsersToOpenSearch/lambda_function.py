import boto3 
import json
from decimal import Decimal
from botocore.awsrequest import AWSRequest
from botocore.auth import SigV4Auth
from botocore.httpsession import URLLib3Session

region = 'us-east-1'
service = 'es'
opensearch_url = 'https://search-restaurantsearch-b2jdmtdnimpz6ovyac7i3wv5te.us-east-1.es.amazonaws.com'
index_name = 'grubhub_menu'

credentials = boto3.Session().get_credentials()
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('grubdash_users')

# Handle Decimal encoding
class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)

# Sign and send HTTP request to OpenSearch
def sign_and_send_request(endpoint, method, body):
    request = AWSRequest(
        method=method,
        url=endpoint,
        data=body,
        headers={'Content-Type': 'application/json'}
    )
    SigV4Auth(credentials, service, region).add_auth(request)
    session = URLLib3Session()
    response = session.send(request.prepare())
    return response

def lambda_handler(event, context):
    response = table.scan()
    items = response['Items']
    results = []
    errors = []

    for restaurant in items:
        try:
            if 'address' not in restaurant or 'location_coordinates' not in restaurant or 'menu' not in restaurant:
                continue  # skip incomplete data

            doc = {
                "userId": restaurant.get("userId", ""),
                "name": restaurant.get("name", ""),
                "email": restaurant.get("email", ""),
                "address": restaurant.get("address", ""),
                "rating": restaurant.get("rating", None),
                "createdAt": restaurant.get("createdAt", ""),
                "location": {
                    "lat": float(restaurant["location_coordinates"].get("latitude", 0)),
                    "lon": float(restaurant["location_coordinates"].get("longitude", 0))
                },
                "menu": []
            }

            for item in restaurant.get("menu", []):
                menu_item = {
                    "name": item.get("name", ""),
                    "description": item.get("description", ""),
                    "category": item.get("category", ""),
                    "item_id": item.get("item_id", ""),
                    "image_url": item.get("image_url", ""),
                    "price": str(item.get("price", ""))
                }
                doc["menu"].append(menu_item)

            endpoint = f"{opensearch_url}/{index_name}/_doc/{doc['userId']}"  # use userId as document ID to avoid duplication
            body = json.dumps(doc, cls=DecimalEncoder)
            res = sign_and_send_request(endpoint, "PUT", body)

            print(f"Indexed restaurant: {doc['name']}")
            print(f"Status: {res.status_code}, Response: {res.text}")

            results.append(res.status_code)
            if res.status_code >= 400:
                errors.append(res.text)

        except Exception as e:
            print(f"Error indexing restaurant: {restaurant.get('userId')}")
            print(str(e))
            results.append(500)
            errors.append(str(e))

    return {
        "statusCode": 200,
        "body": json.dumps({
            "indexed": len(results),
            "responses": results,
            "errors": errors
        })
    }
