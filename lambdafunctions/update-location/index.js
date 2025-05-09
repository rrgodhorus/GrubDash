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

    const { deliveryPartnerId, latitude, longitude, status } = event;

    if (!deliveryPartnerId || !status) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing deliveryPartnerId or status" }),
      };
    }

    const key = deliveryPartnerId;

    if (status === "offline") {
      await client.del(key);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Delivery partner is offline" }),
      };
  
    }

    if (!latitude || !longitude) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing fields" }),
      };
    }

    if (status === "online") {
      // Only set if key does not exist (first time coming online)
      const exists = await client.exists(key);
      if (!exists) {
        const timestamp = new Date().toISOString();
        await client.hSet(key, {
          latitude,
          longitude,
          timestamp,
        });
      } else {
        await client.hSet(key, {
          latitude,
          longitude,
        });
      }
      await client.expire(key, 60);
      return { statusCode: 200, body: JSON.stringify({ message: "Delivery partner is online and location updated" }) };
    }

  } catch (err) {
    console.error("Error occurred:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message || "Internal server error" }),
    };
  }
};
