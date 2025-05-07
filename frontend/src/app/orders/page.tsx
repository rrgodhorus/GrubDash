"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { OrderMessage, isValidOrderMessage } from "../utils/messageTemplates";
import { useAuth } from "react-oidc-context";

const WEBSOCKET_URL = "wss://5g5tej9zt6.execute-api.us-east-1.amazonaws.com/production";
const HEARTBEAT_INTERVAL = 30000; // Send heartbeat every 30 seconds
const LOCAL_STORAGE_KEY = "grubdash_orders";

// Define order status options
const ORDER_STATUS = {
  PENDING_CONFIRMATION: "PENDING_CONFIRMATION",
  CONFIRMED: "CONFIRMED",  // This now represents the preparing stage
  READY: "READY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED"
};

// Function to get item name from localStorage
const getItemNameFromLocalStorage = (itemId: string | undefined): string | null => {
  if (!itemId) return null;
  try {
    // Get user details from localStorage with the key "user_details"
    const userDetailsString = localStorage.getItem("user_details");
    
    if (userDetailsString) {
      const userDetails = JSON.parse(userDetailsString);
      // Check if this user data contains menu information
      if (userDetails.menu && Array.isArray(userDetails.menu)) {
        // Find the menu item by ID
        const menuItem = userDetails.menu.find(item => item.item_id === itemId);
        if (menuItem && menuItem.name) {
          return menuItem.name;
        }
      }
    }
  } catch (error) {
    console.error("Error retrieving item name from localStorage:", error);
  }
  return null;
};

export default function OrderUpdatesPage() {
  const [orders, setOrders] = useState<OrderMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCountRef = useRef(0);
  
  // Get auth context at component level
  const auth = useAuth();
  // Store restaurantId in a ref to prevent unnecessary reconnections
  const restaurantIdRef = useRef<string>('');
  
  // Only update the ref when auth.user changes and has a valid sub
  useEffect(() => {
    if (auth.user?.profile.sub) {
      restaurantIdRef.current = auth.user.profile.sub;
    }
  }, [auth.user?.profile.sub]);

  // Load orders from localStorage on initial render
  useEffect(() => {
    try {
      const savedOrders = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedOrders) {
        setOrders(JSON.parse(savedOrders));
      }
    } catch (error) {
      console.error("Error loading orders from localStorage:", error);
    }
  }, []);

  // Save orders to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(orders));
  }, [orders]);

  // Function to connect WebSocket - no longer depends on restaurantId
  const connectWebSocket = useCallback(() => {
    // Clear any existing connection
    if (socketRef.current) {
      socketRef.current.close();
    }

    // Clear any previous error
    setConnectionError(null);
    
    try {
      // Use the ref value here instead of the prop
      const currentRestaurantId = restaurantIdRef.current;
      
      // Don't attempt connection without a valid restaurantId
      if (!currentRestaurantId) {
        console.log("No restaurant ID available yet, delaying connection");
        return;
      }

      // Ensure the restaurantId is properly URL encoded and included in query params
      const socket = new WebSocket(`${WEBSOCKET_URL}?restaurantId=${encodeURIComponent(currentRestaurantId)}`);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("WebSocket connected for restaurant:", currentRestaurantId);
        setIsConnected(true);
        reconnectCountRef.current = 0; // Reset reconnect counter on successful connection
        
        // Setup heartbeat to keep connection alive
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        
        heartbeatIntervalRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            console.log("Connection still open");
          }
        }, HEARTBEAT_INTERVAL);
      };

      socket.onmessage = (event) => {
        console.log("Message from server:", event.data);
        try {
          const msg = JSON.parse(event.data);
          
          // Check for error messages from the server
          if (msg.message === "Forbidden") {
            console.error("Forbidden error from WebSocket server:", msg);
            setConnectionError("Authentication failed. Please check your credentials.");
            socket.close();
            return;
          }
          
          if (isValidOrderMessage(msg)) {
            // Set all new orders to PENDING_CONFIRMATION status
            const newOrder = {
              ...msg,
              status: ORDER_STATUS.PENDING_CONFIRMATION,
              timestamp: new Date().toLocaleTimeString()
            };
            
            // Check if order already exists to avoid duplicates
            setOrders(prev => {
              const orderExists = prev.some(order => order.orderId === newOrder.orderId);
              if (orderExists) {
                return prev;
              }
              return [newOrder, ...prev];
            });
          } else {
            console.log("Received non-order message:", msg);
          }
        } catch (err) {
          console.error("Error parsing message:", err);
        }
      };

      socket.onclose = (e) => {
        console.log("WebSocket closed", e);
        setIsConnected(false);
        
        // Clear heartbeat interval
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        
        // Show a connection error but don't automatically reconnect
        setConnectionError("Connection closed. Click 'Reconnect' to try again.");
        
        // No longer scheduling automatic reconnection
        // Rely on manual reconnect button instead
      };

      socket.onerror = (err) => {
        console.error("WebSocket error", err);
        setIsConnected(false);
        setConnectionError("Connection error. The server may be unreachable. Click 'Reconnect' to try again.");
      };
    } catch (err) {
      console.error("Error creating WebSocket:", err);
      setConnectionError("Failed to establish connection. Please try again later.");
    }
  }, []); // No dependencies for more stability

  // Connect or reconnect when restaurant ID changes or user logs in
  useEffect(() => {
    if (auth.user?.profile.sub && auth.user.profile.sub !== restaurantIdRef.current) {
      // Only reconnect if the ID actually changed
      console.log("Restaurant ID changed, reconnecting WebSocket");
      restaurantIdRef.current = auth.user.profile.sub;
      connectWebSocket();
    }
  }, [auth.user?.profile.sub, connectWebSocket]);

  // Initial connection effect
  useEffect(() => {
    // Only connect if we have a valid restaurant ID
    if (restaurantIdRef.current) {
      connectWebSocket();
    }

    // Clean up when component unmounts
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [connectWebSocket]);

  // Function to handle order confirmation
  const confirmOrder = (orderId: string) => {
    // Get the API base URL from environment variable with fallback
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    
    // Send PUT request to update order status
    fetch(`${apiBaseUrl}/orders/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: "order_confirmed" }),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to update order status: ${response.status} ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Order status updated successfully:', data);
        // Update local state after successful API call
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order.orderId === orderId 
              ? { ...order, status: ORDER_STATUS.CONFIRMED } 
              : order
          )
        );
      })
      .catch(error => {
        console.error('Error updating order status:', error);
        alert('Failed to update order status. Please try again.');
      });
  };

  // Function to update order status (READY, etc.)
  const updateOrderStatus = (orderId: string, newStatus: string) => {
    // Get the API base URL from environment variable with fallback
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    
    // Map internal status to API status format
    let apiStatus = "";
    switch(newStatus) {
      case ORDER_STATUS.READY:
        apiStatus = "ready_for_delivery";
        break;
      case ORDER_STATUS.DELIVERED:
        apiStatus = "delivered";
        break;
      default:
        apiStatus = newStatus.toLowerCase();
    }
    
    // Send PUT request to update order status
    fetch(`${apiBaseUrl}/orders/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: apiStatus }),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to update order status: ${response.status} ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Order status updated successfully:', data);
        // Update local state after successful API call
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order.orderId === orderId 
              ? { ...order, status: newStatus } 
              : order
          )
        );
      })
      .catch(error => {
        console.error('Error updating order status:', error);
        alert('Failed to update order status. Please try again.');
      });
  };

  // Function to handle order cancellation
  const cancelOrder = (orderId: string) => {
    // Get the API base URL from environment variable with fallback
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    
    // Send PUT request to update order status
    fetch(`${apiBaseUrl}/orders/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: "order_cancelled" }),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to cancel order: ${response.status} ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Order cancelled successfully:', data);
        // Update local state after successful API call
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order.orderId === orderId 
              ? { ...order, status: ORDER_STATUS.CANCELLED } 
              : order
          )
        );
      })
      .catch(error => {
        console.error('Error cancelling order:', error);
        alert('Failed to cancel order. Please try again.');
      });
  };

  // Function to get status color based on status
  const getStatusColor = (status: string) => {
    switch(status) {
      case ORDER_STATUS.PENDING_CONFIRMATION: return "bg-yellow-100 text-yellow-800";
      case ORDER_STATUS.CONFIRMED: return "bg-indigo-100 text-indigo-800";
      case ORDER_STATUS.READY: return "bg-green-100 text-green-800";
      case ORDER_STATUS.DELIVERED: return "bg-purple-100 text-purple-800";
      case ORDER_STATUS.CANCELLED: return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Calculate total items in an order
  const getTotalItems = (items?: { quantity?: number }[]) => {
    if (!items || items.length === 0) return 0;
    return items.reduce((total, item) => total + (item.quantity || 1), 0);
  };

  return (
    <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Live Orders Dashboard</h1>
          <div className="flex items-center">
            <span className={`inline-block w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-sm font-medium text-gray-700">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            {!isConnected && (
              <button 
                className="ml-3 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                onClick={() => {
                  reconnectCountRef.current = 0; // Reset counter on manual reconnect
                  connectWebSocket();
                }}
              >
                Reconnect
              </button>
            )}
          </div>
        </div>
        
        {connectionError && (
          <div className="bg-red-50 rounded-md p-4 border border-red-100 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  {connectionError}
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="bg-orange-50 rounded-md p-4 border border-orange-100 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-orange-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-orange-700">
                Showing live order updates. New orders will appear at the top and require confirmation.
              </p>
            </div>
          </div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 bg-white shadow rounded-lg">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">No orders yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            New orders will appear here as they come in.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {orders.map((order, idx) => {
            const status = order.status || ORDER_STATUS.PENDING_CONFIRMATION;
            const statusClass = getStatusColor(status);
            const totalItems = getTotalItems(order.items);
            const isPending = status === ORDER_STATUS.PENDING_CONFIRMATION;
            
            return (
              <div key={idx} className="bg-white rounded-lg shadow overflow-hidden transition-all hover:shadow-md">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">
                      Order #{order.orderId}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClass}`}>
                      {status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {order.timestamp || "Just now"} • {totalItems} {totalItems === 1 ? 'item' : 'items'}
                  </p>
                </div>
                
                <div className="px-4 py-4 sm:px-6">
                  {order.items && order.items.length > 0 ? (
                    <div className="space-y-3">
                      {order.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 font-medium mr-3">
                              {item.quantity || 1}
                            </div>
                            <span className="font-medium">{getItemNameFromLocalStorage(item.id) || item.name || "Unnamed item"}</span>
                          </div>
                          {item.id && <span className="text-xs text-gray-500">ID: {item.id}</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No item details available</p>
                  )}
                </div>
                
                <div className="bg-gray-50 px-4 py-3 sm:px-6 border-t border-gray-200">
                  {isPending ? (
                    <div className="flex justify-between items-center">
                      <div className="flex space-x-2">
                        <button 
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 transition-colors"
                          onClick={() => confirmOrder(order.orderId)}
                        >
                          Confirm Order
                        </button>
                        <button 
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 transition-colors"
                          onClick={() => cancelOrder(order.orderId)}
                        >
                          Cancel Order
                        </button>
                      </div>
                    </div>
                  ) : status === ORDER_STATUS.CONFIRMED ? (
                    <div className="flex space-x-2">
                      <button 
                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 transition-colors"
                        onClick={() => updateOrderStatus(order.orderId, ORDER_STATUS.READY)}
                      >
                        Mark Ready for Delivery
                      </button>
                      <button 
                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 transition-colors"
                        onClick={() => cancelOrder(order.orderId)}
                      >
                        Cancel Order
                      </button>
                    </div>
                  ) : status === ORDER_STATUS.READY ? (
                    <div className="flex items-center">
                      <span className="text-sm text-green-700 font-medium">
                        Order is ready for delivery
                      </span>
                    </div>
                  ) : status === ORDER_STATUS.DELIVERED ? (
                    <div className="flex items-center">
                      <span className="text-sm text-purple-700 font-medium">
                        Order has been delivered
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">
                        {status === ORDER_STATUS.CANCELLED 
                          ? "This order has been cancelled" 
                          : `Order ${status.toLowerCase().replace('_', ' ')}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
