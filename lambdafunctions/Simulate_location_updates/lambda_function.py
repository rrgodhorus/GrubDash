import json
import time
import os
import boto3

sqs = boto3.client("sqs")
QUEUE_URL = os.environ['QUEUE_URL']

def lambda_handler(event, context):
    body = json.loads(event['body'])
    user_id = body['userId']
    route_coordinates = body['routeCoordinates']  # List of {'lat': ..., 'lng': ...}

    print(f"Simulating movement for user: {user_id}")

    for point in route_coordinates:
        message = {
            "customerId": user_id,
            "lat": point['lat'],
            "lng": point['lng'],
            "timestamp": int(time.time() * 1000)
        }

        response = sqs.send_message(
            QueueUrl=QUEUE_URL,
            MessageBody=json.dumps(message)
        )

        print(f"Sent point to SQS: {message}")
        time.sleep(0.4)

    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Route simulation complete'})
    }
