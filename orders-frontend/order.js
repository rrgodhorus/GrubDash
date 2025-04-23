const apiBase = "https://d6qtquhddj.execute-api.us-east-2.amazonaws.com/dev";

document.getElementById('orderForm').onsubmit = async (e) => {
  e.preventDefault();

  const userId = document.getElementById('userId').value;
  const restaurantId = document.getElementById('restaurantId').value;
  const items = JSON.parse(document.getElementById('items').value);

  const res = await fetch(`${apiBase}/orders`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({user_id: userId, restaurant_id: restaurantId, items})
  });

  const data = await res.json();
  alert("Order placed. Order ID: " + data.order_id);
};

async function getOrderStatus() {
  const id = document.getElementById('statusOrderId').value;
  const res = await fetch(`${apiBase}/orders/${id}`);
  const data = await res.json();
  document.getElementById('statusResult').textContent = JSON.stringify(data, null, 2);
}

async function updateOrderStatus() {
  const id = document.getElementById('updateOrderId').value;
  const status = document.getElementById('newStatus').value;

  await fetch(`${apiBase}/orders/${id}/status`, {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({status})
  });

  alert("Order status updated.");
}

async function getOrdersByUser() {
    const userId = document.getElementById('getUserOrdersInput').value;
    const res = await fetch(`${apiBase}/orders/user/${userId}`,{method: 'GET',
        headers: {'Content-Type': 'application/json'}});
    const data = await res.json();
    document.getElementById('userOrdersResult').textContent = JSON.stringify(data, null, 2);
}
  
async function getOrdersByRestaurant() {
  const restId = document.getElementById('getRestaurantOrdersInput').value;
  const res = await fetch(`${apiBase}/orders/restaurant/${restId}`);
  const data = await res.json();
  document.getElementById('restaurantOrdersResult').textContent = JSON.stringify(data, null, 2);
}  

async function cancelOrder() {
  const id = document.getElementById('cancelOrderId').value;

  await fetch(`${apiBase}/orders/${id}/cancel`, {
    method: 'PUT'
  });

  alert("Order cancelled (if not already cooking).");
}
