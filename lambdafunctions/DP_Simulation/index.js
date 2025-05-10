const { createClient } = require("redis");

const redis = createClient({
  url: `redis://${process.env.VALKEY_HOST || "localhost"}:6379`
});

function randomOffset(maxMeters = 2000) {
  const delta = maxMeters / 111_000;
  return (Math.random() - 0.5) * 2 * delta;
}

exports.handler = async () => {
  if (!redis.isOpen) await redis.connect();

  const now = Date.now();
  const baseLat = 40.67836844973936; 
  const baseLon = -73.96550463805957;
  const statuses = ["online", "in_delivery", "offline"];

  for (let i = 1; i <= 20; i++) {
    const partnerId = `dp_${String(i).padStart(3, "0")}`;

    const lat = i === 1 ? baseLat : baseLat + randomOffset();
    const lon = i === 1 ? baseLon : baseLon + randomOffset();
    const status = i === 1 ? "online" : statuses[Math.floor(Math.random() * statuses.length)];

    const lastSeen = now - Math.floor(Math.random() * 120000);       // within 2 mins
    const lastAssigned = now - Math.floor(Math.random() * 300000);   // within 5 mins

    await redis.hSet(`partner:${partnerId}`, {
      status,
      lastSeen
    });

    await redis.zAdd("partner:assignments", [
      { score: lastAssigned, value: partnerId }
    ]);

    if (status === "online" || status == "in_delivery") {
      await redis.geoAdd("active:delivery-partners", {
        member: partnerId,
        longitude: lon,
        latitude: lat
      });
    }

    console.log(`Seeded ${partnerId} → ${status} @ (${lat.toFixed(6)}, ${lon.toFixed(6)})`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Seeded 20 delivery partners (dp_001 at base location)" })
  };
};
