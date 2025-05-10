"use client";
import React, { useEffect, useState, useRef, Suspense } from "react";
import { useAuth } from "react-oidc-context";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadScript } from "@react-google-maps/api";
import MapComponent from "./components/MapComponent";
import DeliveryRouteMap from "./components/DeliveryRouteMap";
import { 
  ORDER_STATUS, 
  getDisplayStatus, 
  isOrderCompleted, 
  getProgressPercentage, 
  getStatusColor,
  getStatusText 
} from "../utils/orderStatus";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Format date for display
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString();
};

// Create a separate component to use the useSearchParams hook
function OrderTracker() {
  const router = useRouter();
  const auth = useAuth();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');
  
  const [order, setOrder] = useState<any>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);
  const [deliveryDetails, setDeliveryDetails] = useState<any>(null);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState<string>('30-45 minutes');

  const fetchDeliveryDetails = async (deliveryId: string) => {
    try {
      const response = await fetch(`https://hasbgxp22pykmsxgmrripwf73m0nvhdh.lambda-url.us-east-1.on.aws/partners/${deliveryId}`);
      
      if (!response.ok) {
        console.error(`Error fetching delivery details: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      setDeliveryDetails({ ...data, lastFetchTime: Date.now() });
    } catch (err: any) {
      console.error("Error fetching delivery details:", err);
    }
  };

  const fetchRestaurantDetails = async (restaurantId: string) => {
    try {
      const response = await fetch(`${API_BASE}/users/${restaurantId}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching restaurant: ${response.statusText}`);
      }
      
      const data = await response.json();
      setRestaurant(data);
    } catch (err: any) {
      console.error("Error fetching restaurant:", err);
    }
  };

  const fetchOrderDetails = async (id: string, userId: string | undefined) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/orders/${id}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching order: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (userId && data.customer_id !== userId) {
        setError("You don't have permission to view this order");
        setOrder(null);
      } else {
        setOrder(data);
        setError(null);
        
        if (data.restaurant_id) {
          await fetchRestaurantDetails(data.restaurant_id);
        }

        const shouldFetchDeliveryDetails = data.delivery_id && 
          (data.status === 'ready_for_delivery' || getDisplayStatus(data.status) === ORDER_STATUS.READY) &&
          (!deliveryDetails || !deliveryDetails.lastFetchTime || (Date.now() - deliveryDetails.lastFetchTime) > 60000);
        
        if (shouldFetchDeliveryDetails) {
          await fetchDeliveryDetails(data.delivery_id);
        } else if (!data.delivery_id || !(data.status === 'ready_for_delivery' || getDisplayStatus(data.status) === ORDER_STATUS.READY)) {
          setDeliveryDetails(null);
        }
      }
    } catch (err: any) {
      console.error("Error fetching order:", err);
      setError(err.message || "Failed to load order details");
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentOrders = async () => {
    if (!auth.isAuthenticated) return;
    
    setLoading(true);
    try {
      const userId = auth.user?.profile["cognito:username"];
      const response = await fetch(`${API_BASE}/orders/user/${userId}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching orders: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const sortedOrders = data.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setOrder(sortedOrders[0]);
        setError(null);
      } else {
        setError("No recent orders found");
      }
    } catch (err: any) {
      console.error("Error fetching recent orders:", err);
      setError(err.message || "Failed to load your recent orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auth.isAuthenticated) {
      const role = auth.user?.profile["custom:user_role"];
      if (role === "restaurant") {
        router.push('/orders');
        return;
      } else if (role === "delivery_partner") {
        router.push('/deliveries');
        return;
      }
    }

    if (orderId && auth.isAuthenticated) {
      const userId = auth.user?.profile["cognito:username"] as string | undefined;
      fetchOrderDetails(orderId, userId);
    } else if (!orderId) {
      fetchRecentOrders();
    }
  }, [orderId, auth.isAuthenticated, auth.user?.profile]);

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Order Tracking</h1>
          <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
            {error}
          </div>
          <button 
            onClick={() => router.push('/restaurants')}
            className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition"
          >
            Browse Restaurants
          </button>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Order Tracking</h1>
          <p className="text-gray-600 mb-4">No order information found.</p>
          <button 
            onClick={() => router.push('/restaurants')}
            className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition"
          >
            Browse Restaurants
          </button>
        </div>
      </main>
    );
  }

  const progressPercentage = getProgressPercentage(order.status);
  
  return (
    <main className="max-w-4xl mx-auto py-8 px-4">
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="bg-orange-500 p-6 text-white">
          <h1 className="text-2xl font-bold">Order Tracking</h1>
          <p className="opacity-90">Order #{order.order_id || order.orderId}</p>
        </div>
        
        <div className="p-6">
          <div className="mb-4">
            <button 
              onClick={() => setShowDebug(!showDebug)}
              className="text-xs text-gray-500 underline"
            >
              {showDebug ? 'Hide Debug Info' : 'Show Debug Info'}
            </button>
            
            {showDebug && (
              <div className="bg-gray-100 p-2 mt-2 rounded">
                <p className="text-xs font-mono">Status: {order.status}</p>
                <p className="text-xs font-mono">Display Status: {getDisplayStatus(order.status)}</p>
                <p className="text-xs font-mono">Has Delivery Details: {deliveryDetails ? 'Yes' : 'No'}</p>
              </div>
            )}
          </div>
          
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-500">Order Progress</span>
              <span className={`font-medium ${getStatusColor(order.status)}`}>
                {getStatusText(order.status)}
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${order.status === 'order_cancelled' ? 'bg-red-500' : 'bg-green-500'}`} 
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
          
          <div className="border-t border-gray-200 pt-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Order Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Ordered on</p>
                <p className="font-medium">{order.created_at ? formatDate(order.created_at) : 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Restaurant</p>
                <p className="font-medium">{restaurant?.name || order.restaurant_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Estimated Delivery</p>
                <p className="font-medium">
                  {order.status === 'order_cancelled' 
                    ? 'Cancelled'
                    : order.status === 'delivered'
                      ? 'Delivered'
                      : estimatedDeliveryTime}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Payment</p>
                <p className="font-medium text-green-600">Paid</p>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-bold mb-4">Order Items</h2>
            {order.items && order.items.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {order.items.map((item: any, idx: number) => (
                  <div key={idx} className="py-3 flex justify-between">
                    <div className="flex">
                      <div className="mr-4 text-gray-700">
                        {item.quantity || 1} ×
                      </div>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.description && (
                          <p className="text-sm text-gray-500">{item.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="font-medium">
                      ${((item.unit_price || 0) * (item.quantity || 1)).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No item details available</p>
            )}
            
            <div className="border-t border-gray-200 mt-4 pt-4">
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>${order.amount ? order.amount : '0.00'}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-gray-200">
          <h2 className="text-xl font-bold mb-4">Order Location Tracking</h2>
          
          {(getDisplayStatus(order.status) === ORDER_STATUS.IN_DELIVERY || getDisplayStatus(order.status) === ORDER_STATUS.READY) && deliveryDetails ? (
            <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
              <DeliveryRouteMap 
                deliveryDetails={deliveryDetails} 
                onEstimatedDeliveryTimeChange={setEstimatedDeliveryTime}
              />
            </LoadScript>
          ) : getDisplayStatus(order.status) === ORDER_STATUS.IN_DELIVERY || getDisplayStatus(order.status) === ORDER_STATUS.READY ? (
            <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
              {((restaurant && restaurant.location) || order.restaurant_location) && order.delivery_location ? (
                <MapComponent 
                  restaurantLocation={restaurant?.location || order.restaurant_location} 
                  userLocation={order.delivery_location} 
                />
              ) : (
                <div className="bg-yellow-50 text-yellow-700 p-4 rounded-md">
                  Location information not available for tracking
                </div>
              )}
            </LoadScript>
          ) : getDisplayStatus(order.status) === ORDER_STATUS.DELIVERED ? (
            <div className="bg-green-50 text-green-700 p-4 rounded-md">
              Your order has been delivered! Thank you for using GrubDash.
            </div>
          ) : getDisplayStatus(order.status) === ORDER_STATUS.CANCELLED ? (
            <div className="bg-red-50 text-red-700 p-4 rounded-md">
              This order has been cancelled.
            </div>
          ) : (
            <div className="bg-blue-50 text-blue-700 p-4 rounded-md">
              Location tracking will be available when your order is ready for delivery.
            </div>
          )}
        </div>
      </div>
    </main> 
  )
}

export default function OrderTrackingPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OrderTracker />
    </Suspense>
  );
}