"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { OrderMessage, isValidOrderMessage } from "../utils/messageTemplates";

const WEBSOCKET_URL = "wss://5g5tej9zt6.execute-api.us-east-1.amazonaws.com/production";
const RECONNECT_INTERVAL = 3000; // Try to reconnect every 3 seconds
const HEARTBEAT_INTERVAL = 30000; // Send heartbeat every 30 seconds

// Order status for visual indication - we'll randomly assign these for now
const STATUS_OPTIONS = ["Received", "Preparing", "Ready", "Delivered"];

export default function OrderUpdatesPage() {
  const [orders, setOrders] = useState<OrderMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCountRef = useRef(0);

  // Function to connect WebSocket
  const connectWebSocket = useCallback(() => {
    // Clear any existing connection
    if (socketRef.current) {
      socketRef.current.close();
    }

    // Clear any previous error
    setConnectionError(null);
    
    try {
      // In a real app, the restaurant ID would come from authentication
      const restaurantId = "r1"; // This would be dynamically set from auth
      
      // Ensure the restaurantId is properly URL encoded and included in query params
      const socket = new WebSocket(`${WEBSOCKET_URL}?restaurantId=${encodeURIComponent(restaurantId)}`);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("WebSocket connected");
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
            // Assign a random status for visualization purposes
            const enhancedMsg = {
              ...msg,
              status: STATUS_OPTIONS[Math.floor(Math.random() * STATUS_OPTIONS.length)],
              timestamp: new Date().toLocaleTimeString()
            };
            setOrders(prev => [enhancedMsg, ...prev]);
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
        
        // If we've tried to reconnect too many times, show an error
        if (reconnectCountRef.current >= 5) {
          setConnectionError("Unable to connect after multiple attempts. The server may be down or unreachable.");
        }
        
        // Schedule reconnection with exponential backoff
        const backoffTime = Math.min(RECONNECT_INTERVAL * Math.pow(1.5, reconnectCountRef.current), 30000);
        console.log(`Scheduling reconnection attempt in ${backoffTime}ms...`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectCountRef.current++;
          console.log(`Attempting to reconnect (attempt ${reconnectCountRef.current})...`);
          connectWebSocket();
        }, backoffTime);
      };

      socket.onerror = (err) => {
        console.error("WebSocket error", err);
        setIsConnected(false);
        setConnectionError("Connection error. The server may be unreachable.");
      };
    } catch (err) {
      console.error("Error creating WebSocket:", err);
      setConnectionError("Failed to establish connection. Please try again later.");
    }
  }, []);

  useEffect(() => {
    // Connect when the component mounts
    connectWebSocket();

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

  // Function to get status color based on status
  const getStatusColor = (status: string) => {
    switch(status) {
      case "Received": return "bg-blue-100 text-blue-800";
      case "Preparing": return "bg-yellow-100 text-yellow-800";
      case "Ready": return "bg-green-100 text-green-800";
      case "Delivered": return "bg-purple-100 text-purple-800";
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
                Showing live order updates. New orders will appear at the top.
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
            const status = order.status || "Received";
            const statusClass = getStatusColor(status);
            const totalItems = getTotalItems(order.items);
            
            return (
              <div key={idx} className="bg-white rounded-lg shadow overflow-hidden transition-all hover:shadow-md">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">
                      Order #{order.orderId}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClass}`}>
                      {status}
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
                            <span className="font-medium">{item.name || "Unnamed item"}</span>
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
                  <div className="flex justify-between items-center">
                    <div className="flex space-x-2">
                      <button 
                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 transition-colors"
                        onClick={() => {
                          alert(`Update status for order #${order.orderId}`);
                        }}
                      >
                        Update Status
                      </button>
                      <button 
                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 transition-colors"
                        onClick={() => {
                          alert(`Cancel order #${order.orderId}`);
                        }}
                      >
                        Cancel Order
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
