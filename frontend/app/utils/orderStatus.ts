// Define order status options
export const ORDER_STATUS = {
  PENDING_CONFIRMATION: "PENDING_CONFIRMATION",
  CONFIRMED: "CONFIRMED",  // This represents the preparing stage
  READY: "READY",
  DELIVERY_PARTNER_ASSIGNED: "DELIVERY_PARTNER_ASSIGNED",
  ORDER_PICKED_UP: "ORDER_PICKED_UP",
  IN_DELIVERY: "IN_DELIVERY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED"
};

// Helper function to map API status to display status
export const getDisplayStatus = (status: string) => {
  switch(status) {
    case "pending": return ORDER_STATUS.PENDING_CONFIRMATION;
    case "payment_confirmed": return ORDER_STATUS.PENDING_CONFIRMATION;
    case "order_confirmed": return ORDER_STATUS.CONFIRMED;
    case "ready_for_delivery": return ORDER_STATUS.READY;
    case "delivery_partner_assigned": return ORDER_STATUS.DELIVERY_PARTNER_ASSIGNED;
    case "order_picked_up": return ORDER_STATUS.ORDER_PICKED_UP;
    case "in_delivery": return ORDER_STATUS.IN_DELIVERY;
    case "delivered": return ORDER_STATUS.DELIVERED;
    case "order_cancelled": return ORDER_STATUS.CANCELLED;
    default: return status;
  }
};

// Helper function to check if order is in a final state
export const isOrderCompleted = (status: string) => {
  const displayStatus = getDisplayStatus(status);
  return displayStatus === ORDER_STATUS.DELIVERED || 
         displayStatus === ORDER_STATUS.CANCELLED;
};

// Calculate the progress percentage based on order status
export const getProgressPercentage = (status: string) => {
  const displayStatus = getDisplayStatus(status);
  switch(displayStatus) {
    case ORDER_STATUS.PENDING_CONFIRMATION: return 10;
    case ORDER_STATUS.CONFIRMED: return 40;
    case ORDER_STATUS.READY: return 60;
    case ORDER_STATUS.DELIVERY_PARTNER_ASSIGNED: return 70;
    case ORDER_STATUS.ORDER_PICKED_UP: return 75;
    case ORDER_STATUS.IN_DELIVERY: return 80;
    case ORDER_STATUS.DELIVERED: return 100;
    case ORDER_STATUS.CANCELLED: return 0;
    default: return 0;
  }
};

// Function to get status color based on status
export const getStatusColor = (status: string) => {
  const displayStatus = getDisplayStatus(status);
  switch(displayStatus) {
    case ORDER_STATUS.PENDING_CONFIRMATION: return "text-yellow-500";
    case ORDER_STATUS.CONFIRMED: return "text-indigo-500";
    case ORDER_STATUS.READY: return "text-green-500";
    case ORDER_STATUS.DELIVERY_PARTNER_ASSIGNED: return "text-orange-500";
    case ORDER_STATUS.ORDER_PICKED_UP: return "text-teal-500";
    case ORDER_STATUS.IN_DELIVERY: return "text-blue-500";
    case ORDER_STATUS.DELIVERED: return "text-purple-500";
    case ORDER_STATUS.CANCELLED: return "text-red-500";
    default: return "text-gray-500";
  }
};

// Function to get status text
export const getStatusText = (status: string) => {
  const displayStatus = getDisplayStatus(status);
  switch(displayStatus) {
    case ORDER_STATUS.PENDING_CONFIRMATION: return "Awaiting Restaurant Confirmation";
    case ORDER_STATUS.CONFIRMED: return "Order Confirmed - Preparing Your Food";
    case ORDER_STATUS.READY: return "Ready for Delivery";
    case ORDER_STATUS.DELIVERY_PARTNER_ASSIGNED: return "Delivery Partner Assigned";
    case ORDER_STATUS.ORDER_PICKED_UP: return "Order Picked Up";
    case ORDER_STATUS.IN_DELIVERY: return "Out for Delivery";
    case ORDER_STATUS.DELIVERED: return "Delivered";
    case ORDER_STATUS.CANCELLED: return "Cancelled";
    default: return "Unknown Status";
  }
};