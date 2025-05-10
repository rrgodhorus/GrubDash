import boto3
import os
import json

personalize_runtime = boto3.client('personalize-runtime', region_name=os.environ['REGION'])
CAMPAIGN_ARN = os.environ['CAMPAIGN_ARN']

def lambda_handler(event, context):
    try:
        print("EVENT:", json.dumps(event))  # For debugging in CloudWatch

        user_id = event.get("queryStringParameters", {}).get("userId")
        if not user_id:
            return {
                "statusCode": 400,
                "headers": {"Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "Missing userId"})
            }

        response = personalize_runtime.get_recommendations(
            campaignArn=CAMPAIGN_ARN,
            userId=user_id,
            numResults=10
        )

        recommendations = [item["itemId"] for item in response.get("itemList", [])]

        print("RECOMMENDATIONS:", recommendations)

        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            "body": json.dumps({"recommendedRestaurantIds": recommendations})
        }

    except Exception as e:
        print("ERROR:", str(e))
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({"error": "Internal server error", "details": str(e)})
        }
