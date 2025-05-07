import { createClient } from "redis";

// Read Valkey host from environment
const valkeyHost = process.env.VALKEY_HOST;
if (!valkeyHost) {
  throw new Error("VALKEY_HOST environment variable is not set");
}

const client = createClient({
  url: `redis://${valkeyHost}:6379`
});

let isConnected = false;

export const handler = async (event) => {
  try {
    if (!isConnected) {
      await client.connect();
      isConnected = true;
    }

    const { deliveryPartnerId, latitude, longitude, timestamp } = event;

    if (!deliveryPartnerId || !latitude || !longitude || !timestamp) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing fields" }),
      };
    }

    const key = `${deliveryPartnerId}`;
    const value = JSON.stringify({ latitude, longitude, timestamp });

    const result = await client.set(key, value);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Location updated", result }),
    };

  } catch (err) {
    console.error("Error occurred:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message || "Internal server error" }),
    };
  }
};
