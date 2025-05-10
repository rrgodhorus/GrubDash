import boto3
import json
import os
from datetime import datetime

personalize_events = boto3.client('personalize-events', region_name=os.environ['REGION'])

def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])
        user_id = body.get("userId")
        item_id = body.get("itemId")
        event_type = body.get("eventType")
        session_id = user_id

        if not user_id or not item_id or not event_type:
            return { "statusCode": 400, "body": json.dumps({ "error": "Missing fields" }) }

        personalize_events.put_events(
            trackingId=os.environ['TRACKING_ID'],
            userId=user_id,
            sessionId=session_id,
            eventList=[{
                'eventType': event_type,
                'itemId': item_id,
                'sentAt': datetime.utcnow()
            }]
        )
        print("Event sent to Personalize successfully")
        print("EVENT PAYLOAD:", {
            "userId": user_id,
            "itemId": item_id,
            "eventType": event_type
        })

        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            "body": json.dumps({ "message": "Event sent" })
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({ "error": str(e) })
        }
