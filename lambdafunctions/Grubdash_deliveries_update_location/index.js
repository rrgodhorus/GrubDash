import { createClient } from "redis";

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

    const { deliveryPartnerId, latitude, longitude, status, lastAssigned } = event;

    if (!deliveryPartnerId || !status) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing deliveryPartnerId or status" }),
      };
    }

    const hashKey = `partner:${deliveryPartnerId}`;
    const geoKey = "active:delivery-partners";

    const now = Date.now();

    if (status === "offline") {
      await client.zRem(geoKey, deliveryPartnerId);
      await client.del(hashKey);
      await client.zRem("partner:assignments", deliveryPartnerId);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Delivery partner is offline" }),
      };
    }

    if (!latitude || !longitude) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing latitude or longitude" }),
      };
    }

    if (status === "online" || status === "in_delivery") {
      await client.geoAdd(geoKey, {
        member: deliveryPartnerId,
        longitude: parseFloat(longitude),
        latitude: parseFloat(latitude)
      });
    }

    await client.hSet(hashKey, {
      status,
      lastSeen: now
    });

    if (lastAssigned) {
      await client.zAdd("partner:assignments", [{
        score: parseInt(lastAssigned),
        value: deliveryPartnerId
      }]);
    }

    // await client.expire(hashKey, 60); // optional TTL
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Delivery partner updated" }),
    };

  } catch (err) {
    console.error("Error occurred:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message || "Internal server error" }),
    };
  }
};
