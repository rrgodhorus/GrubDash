const { createClient } = require("redis");

const redis = createClient({
  url: `redis://${process.env.VALKEY_HOST}`
});

exports.handler = async () => {
  if (!redis.isOpen) await redis.connect();

  // Scan all partner keys
  const rawKeys = await redis.keys("partner:dp_*");
  const keys = rawKeys.filter(k => (k.match(/^partner:dp_[^:]+$/)));
  const results = [];

  for (const key of keys) {
    const partnerId = key.split(":")[1];
    const [status, lastSeen] = await redis.hmGet(key, "status", "lastSeen");
    const lastAssigned = await redis.zScore("partner:assignments", partnerId);

    let lat = null;
    let lng = null;

    if (status === "online" || status == "in_delivery") {
      const coords = await redis.sendCommand(["GEOPOS", "active:delivery-partners", partnerId]);
      if (coords && coords[0]) {
        lng = parseFloat(coords[0][0]);
        lat = parseFloat(coords[0][1]);
      }
    }

    results.push({
      partner_id: partnerId,
      status: status || "unknown",
      lastSeen: parseInt(lastSeen || 0, 10),
      lastAssigned: parseInt(lastAssigned || 0, 10),
      lat,
      lng
    });
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(results)
  };
};
