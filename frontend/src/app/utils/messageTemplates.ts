// Message template definitions for order communications

export interface Item {
  id?: string;
  name?: string;
  quantity?: number;
}

export interface OrderMessage {
  orderId: string;       
  restaurantId?: string;  
  items?: Item[];
}

/**
 * Creates a new order message with the required orderId
 * @param orderId - The unique identifier for the order (required)
 * @param restaurantId - The restaurant identifier (optional)
 * @param items - Array of order items (optional)
 * @returns A properly formatted order message
 */
export function createOrderMessage(
  orderId: string,
  restaurantId?: string,
  items?: Item[]
): OrderMessage {
  const message: OrderMessage = {
    orderId: orderId
  };

  if (restaurantId) {
    message.restaurantId = restaurantId;
  }

  if (items && items.length > 0) {
    message.items = items;
  }

  return message;
}

/**
 * Validates if a message has the required fields
 * @param message - The message to validate
 * @returns True if the message is valid (has at least an orderId)
 */
export function isValidOrderMessage(message: any): message is OrderMessage {
  return message && typeof message.orderId === 'string';
}