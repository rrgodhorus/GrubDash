import json
import boto3
import urllib3
from botocore.awsrequest import AWSRequest
from botocore.auth import SigV4Auth
import base64
from collections import defaultdict

# Configuration
region = 'us-east-1'
service = 'es'
index_name = 'grubhub_menu'
opensearch_url = 'https://search-restaurantsearch-b2jdmtdnimpz6ovyac7i3wv5te.us-east-1.es.amazonaws.com'

http = urllib3.PoolManager()

# Basic auth for OpenSearch
username = 'ccadmin'
password = 'Ccadmin25@'
auth_string = f"{username}:{password}"
encoded_auth = base64.b64encode(auth_string.encode('utf-8')).decode('utf-8')

def lambda_handler(event, context):
    print("Received event:")
    print(json.dumps(event, indent=2))

    params = event.get('queryStringParameters') or {}
    query_string = params.get('q', '').lower().strip()
    lat = params.get('lat')
    lon = params.get('lon')

    if not lat or not lon:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Missing lat/lon in query parameters"})
        }

    try:
        lat = float(lat)
        lon = float(lon)
    except ValueError:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "lat and lon must be numbers"})
        }

    print(f"Query: '{query_string}', Location: lat={lat}, lon={lon}")

    geo_filter = {
        "geo_distance": {
            "distance": "10mi",
            "location": {
                "lat": lat,
                "lon": lon
            }
        }
    }

    if query_string:
        query = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "bool": {
                                "should": [
                                    {
                                        "nested": {
                                            "path": "menu",
                                            "query": {
                                                "bool": {
                                                    "should": [
                                                        {
                                                            "match": {
                                                                "menu.name": {
                                                                    "query": query_string,
                                                                    "fuzziness": "AUTO"
                                                                }
                                                            }
                                                        },
                                                        {
                                                            "match": {
                                                                "menu.category": {
                                                                    "query": query_string,
                                                                    "fuzziness": "AUTO"
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        }
                                    },
                                    {
                                        "match": {
                                            "name": {
                                                "query": query_string,
                                                "fuzziness": "AUTO"
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    ],
                    "filter": geo_filter
                }
            }
        }
    else:
        query = {
            "query": {
                "bool": {
                    "must": {
                        "match_all": {}
                    },
                    "filter": geo_filter
                }
            }
        }

    body = json.dumps(query)
    print("Final OpenSearch query being sent:")
    print(json.dumps(query, indent=2))

    url = f"{opensearch_url}/{index_name}/_search"

    # Sign request using SigV4
    session = boto3.Session()
    credentials = session.get_credentials()
    request = AWSRequest(method="POST", url=url, data=body, headers={"Content-Type": "application/json"})
    SigV4Auth(credentials, service, region).add_auth(request)
    headers = dict(request.headers)

    try:
        response = http.request("POST", url, body=body.encode("utf-8"), headers=headers)
    except Exception as e:
        print(f"Request error: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }

    print("Raw response from OpenSearch:")
    print(response.data.decode("utf-8"))

    response_body = json.loads(response.data.decode("utf-8"))
    hits = response_body.get("hits", {}).get("hits", [])

    restaurants = defaultdict(lambda: {
        "userId": "",
        "name": "",
        "email": "",
        "address": "",
        "rating": None,
        "location_coordinates": {
            "latitude": "",
            "longitude": ""
        },
        "createdAt": "",
        "menu": []
    })

    for hit in hits:
        src = hit["_source"]
        user_id = src.get("userId")
        if not user_id:
            continue

        rest = restaurants[user_id]
        rest["userId"] = user_id
        rest["name"] = src.get("name", "")
        rest["email"] = src.get("email", "")
        rest["address"] = src.get("address", "")
        rest["rating"] = src.get("rating")
        rest["location_coordinates"] = {
            "latitude": str(src.get("location", {}).get("lat", src.get("latitude", ""))),
            "longitude": str(src.get("location", {}).get("lon", src.get("longitude", "")))
        }
        rest["createdAt"] = src.get("createdAt", "")

        for item in src.get("menu", []):
            menu_item = {
                "name": item.get("name", ""),
                "description": item.get("description", ""),
                "category": item.get("category", ""),
                "item_id": item.get("item_id", ""),
                "image_url": item.get("image_url", ""),
                "price": str(item.get("price", ""))
            }
            rest["menu"].append(menu_item)

    final_response = list(restaurants.values())
    print(f"Formatted restaurant documents: {len(final_response)}")

    return {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Content-Type": "application/json"
        },
        "body": json.dumps(final_response)
    }
