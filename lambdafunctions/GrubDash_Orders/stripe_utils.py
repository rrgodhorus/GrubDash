import stripe
import os
import boto3
from boto3.dynamodb.conditions import Key

stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
USERS_TABLE = os.environ["USERS_TABLE"]
dynamodb = boto3.resource("dynamodb")
users_table = dynamodb.Table(USERS_TABLE)

# DOC: https://docs.stripe.com/api/payment_intents
def create_payment_intent(amount_cents, customer_id, order_id, save_card=False):
    intent = stripe.PaymentIntent.create(
        amount=amount_cents,
        currency="usd",
        customer=customer_id,
        setup_future_usage="off_session" if save_card else None,
        automatic_payment_methods={"enabled": True},
        metadata={"order_id": order_id}
    )
    return intent.client_secret

def get_or_create_stripe_customer(user_id, user_email=None):
    # Step 1: Try to fetch from DynamoDB
    response = users_table.get_item(Key={"userId": user_id})
    user = response.get("Item")

    if user and "stripe_customer_id" in user:
        return user["stripe_customer_id"]

    # Step 2: Create new Stripe customer
    customer = stripe.Customer.create(
        metadata={"user_id": user_id},
        email=user_email or None
    )

    # Step 3: Update into DynamoDB
    users_table.update_item(
        Key={"userId": user_id},
        UpdateExpression="SET stripe_customer_id = :scid",
        ExpressionAttributeValues={":scid": customer.id}
    )


    return customer.id
