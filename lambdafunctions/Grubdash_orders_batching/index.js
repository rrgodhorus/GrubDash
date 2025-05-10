const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const { createClient } = require("redis");
const { v4: uuidv4 } = require("uuid");

const redis = createClient({
  url: `redis://${process.env.VALKEY_HOST}:6379`
});
const sqs = new SQSClient({});
const ORDER_BATCHING_QUEUE = process.env.ORDER_BATCHING_QUEUE;
const DELIVERY_QUEUE = process.env.DELIVERY_QUEUE;
const MAX_ATTEMPTS = 5;
const TTL_SECONDS = 120;
const PICKUP_DISTANCE_THRESHOLD = 0.5;
const DROPOFF_DISTANCE_THRESHOLD = 2.0;
const MAX_ALLOWED_ORDERS = 2

function haversine([lat1, lon1], [lat2, lon2]) {
  const toRad = (d) => d * (Math.PI / 180);
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function assignPartner(orderIds, allOrderData) {
  if (!allOrderData?.[0]) {
    console.error("assignPartner() called with invalid order data");
    return;
  }

  const { restaurant_location } = allOrderData[0];
  const now = Date.now();

  const geoResults = await redis.sendCommand([
    "GEOSEARCH",
    "active:delivery-partners",
    "FROMLONLAT",
    restaurant_location.longitude.toString(),
    restaurant_location.latitude.toString(),
    "BYRADIUS",
    "3",
    "km",
    "ASC",
    "WITHDIST"
  ]);

  const scoredPartners = [];

  for (const [partnerId, distStr] of geoResults) {
    const distance = parseFloat(distStr); // in km
    const [status, lastSeenStr] = await redis.hmGet(`partner:${partnerId}`, "status", "lastSeen");

    if (status !== "online") continue;

    const activeOrders = await redis.hLen(`partner:${partnerId}:orders`);
    if (activeOrders >= MAX_ALLOWED_ORDERS) continue;

    const lastSeen = parseInt(lastSeenStr || now);
    const lastAssigned = await redis.zScore("partner:assignments", partnerId) || 0;

    // Weighted scoring
    const score =
      0.5 * (1 / Math.max(distance, 0.01)) +             // closer is better
      0.2 * (1 / (1 + activeOrders)) +                   // less busy is better
      0.2 * ((now - lastAssigned) / now) +               // not recently assigned is better
      0.1 * ((now - lastSeen) / now);                    // recently active is better

    scoredPartners.push({ partnerId, score });
  }

  scoredPartners.sort((a, b) => b.score - a.score);

  // let partnerId;

  // for (const { partnerId: pid } of scoredPartners) {
  //   const lockKey = `partner:${pid}:lock`;
  //   const lockAcquired = await redis.set(lockKey, "1", { NX: true, EX: 5 });
  //   if (lockAcquired) {
  //     partnerId = pid;
  //     break;
  //   }
  // }

  // if (!partnerId) {
  //   console.log("No delivery partner could be locked. Skipping assignment.");
  //   return;
  // }
  const best = scoredPartners[0];

  if (!best) {
    console.log("No valid delivery partner found after scoring.");
    return;
  }

  const partnerId = best.partnerId;

  for (const orderId of orderIds) {
    await redis.set(`order:${orderId}:assigned`, "1", { EX: 300 });
    await redis.hSet(`partner:${partnerId}:orders`, orderId, "assigned");
  }

  await redis.hSet(`partner:${partnerId}`, "status", "in_delivery");

  await redis.zAdd("partner:assignments", [{ score: now, value: partnerId }]);

  const deliveryPayload = {
    delivery_id: uuidv4(),
    partner_id: partnerId,
    orders: allOrderData,
    status: "dp_assigned",
    timestamp: now
  };

  await sqs.send(new SendMessageCommand({
    QueueUrl: DELIVERY_QUEUE,
    MessageBody: JSON.stringify(deliveryPayload),
    MessageGroupId: partnerId,
    MessageDeduplicationId: `${deliveryPayload.delivery_id}|${deliveryPayload.status}`
  }));

  console.log(`Partner ${partnerId} assigned to`, orderIds);
}


exports.handler = async (event) => {
  if (!redis.isOpen) await redis.connect();

  for (const record of event.Records) {
    const order = typeof(record.body) == 'string' ? JSON.parse(record.body) : record.body;
    const {
      order_id,
      attempt,
      restaurant_location,
      delivery_location,
      pickup_zone,
    } = order;
    
    console.log(`Processing ${order_id} (attempt ${attempt})`)
    console.log(order);

    const alreadyAssigned = await redis.get(`order:${order_id}:assigned`);

    if (alreadyAssigned) {
      console.log(`Skipping ${order_id}: already assigned`);
      continue;
    }

    const redisKey = `pending:zone:${pickup_zone}`;

    // 1. Write current order to Redis
    await redis.hSet(redisKey, order_id, JSON.stringify(order));
    await redis.expire(redisKey, TTL_SECONDS);

    // 2. Load all orders in the same zone
    const all = await redis.hGetAll(redisKey);
    const pending = Object.entries(all).map(([oid, raw]) => ({
      order_id: oid,
      ...JSON.parse(raw),
    }));

    let batched = false;

    for (const other of pending) {
      if (other.order_id === order_id) continue;

      const pickupDist = haversine(
        [restaurant_location.latitude, restaurant_location.longitude],
        [other.restaurant_location.latitude, other.restaurant_location.longitude]
      );

      const dropoffDist = haversine(
        [delivery_location.latitude, delivery_location.longitude],
        [other.delivery_location.latitude, other.delivery_location.longitude]
      );

      if (pickupDist <= PICKUP_DISTANCE_THRESHOLD && dropoffDist <= DROPOFF_DISTANCE_THRESHOLD) {
        await assignPartner([order_id, other.order_id], [order, other]);
        await redis.hDel(redisKey, order_id);
        await redis.hDel(redisKey, other.order_id);
        batched = true;
        break;
      }
    }

    if (!batched) {
      console.log(`Not batched: ${order_id}; attempt: ${attempt}`)
      order.attempt = attempt + 1;
      console.log(`Order updated with attempt:`)
      console.log(order);
      if (attempt < MAX_ATTEMPTS) {
        await sqs.send(new SendMessageCommand({
          QueueUrl: ORDER_BATCHING_QUEUE,
          MessageBody: JSON.stringify(order),
          MessageGroupId: pickup_zone,
          MessageDeduplicationId: `${order_id}|attempt-${attempt + 1}`,
        }));
        console.log(`Requeued ${order_id} (attempt ${attempt + 1})`);
      } else {
        await assignPartner([order_id], [order]);
        await redis.hDel(redisKey, order_id);
        console.log(`Assigned solo: ${order_id}`);
      }
    }
  }
};
