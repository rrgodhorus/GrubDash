"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "react-oidc-context";
import { useRouter, useSearchParams } from "next/navigation";
import { GoogleMap, LoadScript, Marker, DirectionsService, DirectionsRenderer } from "@react-google-maps/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Define order status options
const ORDER_STATUS = {
  PENDING_CONFIRMATION: "PENDING_CONFIRMATION",
  CONFIRMED: "CONFIRMED",  // This represents the preparing stage
  READY: "READY",
  IN_DELIVERY: "IN_DELIVERY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED"
};

// Map component constants
const containerStyle = {
  width: '100%',
  height: '400px'
};

const defaultCenter = {
  lat: 40.7128, // NYC default coordinates
  lng: -74.0060
};

// Map component
const MapComponent = ({ restaurantLocation, userLocation }: { 
  restaurantLocation: any, 
  userLocation: any 
}) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [directionsError, setDirectionsError] = useState<string | null>(null);

  // Safe conversion to number
  const toNumber = (value: any): number | null => {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return !isNaN(num) ? num : null;
  };

  // Convert location format for Google Maps safely
  const convertToGoogleLatLng = (location: any) => {
    if (!location) return null;
    
    // Try to extract latitude and longitude from the location object
    // Handle different possible formats from the API
    let latitude = toNumber(location.latitude) || toNumber(location.lat);
    let longitude = toNumber(location.longitude) || toNumber(location.lng);
    
    // If we have valid coordinates, return a LatLngLiteral
    if (latitude !== null && longitude !== null) {
      return {
        lat: latitude,
        lng: longitude
      };
    }
    
    return null;
  };

  const restaurantLatLng = convertToGoogleLatLng(restaurantLocation);
  const userLatLng = convertToGoogleLatLng(userLocation);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Get directions between restaurant and user location
  useEffect(() => {
    if (restaurantLatLng && userLatLng) {
      const directionsService = new google.maps.DirectionsService();
      directionsService.route(
        {
          origin: restaurantLatLng,
          destination: userLatLng,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK) {
            setDirections(result);
            setDirectionsError(null);
          } else {
            setDirectionsError(`Directions request failed: ${status}`);
            console.error(`Directions request failed: ${status}`);
          }
        }
      );
    }
  }, [restaurantLocation, userLocation]);

  // If either location is invalid, show error message
  if (!restaurantLatLng || !userLatLng) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center bg-gray-100 rounded-lg text-gray-600">
        <div className="text-center p-4">
          <p className="font-semibold">Invalid location data</p>
          <p className="text-sm mt-2">Location information is missing or in an incorrect format.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[400px] relative rounded-lg overflow-hidden shadow-md my-6">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={restaurantLatLng || defaultCenter}
        zoom={13}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {/* Markers for restaurant and user */}
        {restaurantLatLng && (
          <Marker
            position={restaurantLatLng}
            label="R"
            title="Restaurant Location"
          />
        )}
        {userLatLng && (
          <Marker
            position={userLatLng}
            label="U"
            title="Your Location"
          />
        )}
        
        {/* Display directions if available */}
        {directions && (
          <DirectionsRenderer directions={directions} />
        )}
      </GoogleMap>
      
      {directionsError && (
        <div className="absolute bottom-0 left-0 right-0 bg-red-500 text-white p-2 text-sm">
          {directionsError}
        </div>
      )}
    </div>
  );
};

// Map component for delivery partner view with optimized route
const DeliveryRouteMap = ({ deliveryDetails }: { deliveryDetails: any }) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [directionsError, setDirectionsError] = useState<string | null>(null);
  
  // Delivery partner current location (can be updated with real data)
  const deliveryPartnerLocation = {
    lat: 40.68303738371292,
    lng: -73.96486127243192
  };

  // Safe conversion to number
  const toNumber = (value: any): number | null => {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return !isNaN(num) ? num : null;
  };

  // Convert location format for Google Maps safely
  const convertToGoogleLatLng = (location: any) => {
    if (!location) return null;
    
    let latitude = toNumber(location.latitude) || toNumber(location.lat);
    let longitude = toNumber(location.longitude) || toNumber(location.lng);
    
    if (latitude !== null && longitude !== null) {
      return {
        lat: latitude,
        lng: longitude
      };
    }
    
    return null;
  };

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Process locations for waypoints
  useEffect(() => {
    if (!deliveryDetails || !deliveryDetails.orders || deliveryDetails.orders.length === 0) {
      return;
    }

    try {
      // Create array of all locations (restaurants and delivery locations)
      const waypoints: google.maps.DirectionsWaypoint[] = [];
      const restaurants: google.maps.LatLngLiteral[] = [];
      const deliveryLocations: google.maps.LatLngLiteral[] = [];
      
      // Process each order and extract locations
      deliveryDetails.orders.forEach((order: any) => {
        // Restaurant location
        const restaurantLoc = convertToGoogleLatLng(order.restaurant_location);
        if (restaurantLoc) {
          restaurants.push(restaurantLoc);
          waypoints.push({
            location: restaurantLoc,
            stopover: true
          });
        }
        
        // Delivery location
        const deliveryLoc = convertToGoogleLatLng(order.delivery_location);
        if (deliveryLoc) {
          deliveryLocations.push(deliveryLoc);
          waypoints.push({
            location: deliveryLoc,
            stopover: true
          });
        }
      });
      
      // If we have waypoints, calculate optimized route
      if (waypoints.length > 0) {
        const directionsService = new google.maps.DirectionsService();
        
        // Start from delivery partner's current location
        const origin = new google.maps.LatLng(
          deliveryPartnerLocation.lat,
          deliveryPartnerLocation.lng
        );
        
        // End at the last delivery location 
        const allWaypoints = [...waypoints];
        const destination = allWaypoints.pop()?.location || origin;
        
        directionsService.route(
          {
            origin: origin,
            destination: destination,
            waypoints: waypoints,
            optimizeWaypoints: true, // Optimize the route order
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
              setDirections(result);
              setDirectionsError(null);
            } else {
              setDirectionsError(`Couldn't calculate optimized route: ${status}`);
              console.error(`Directions request failed: ${status}`);
            }
          }
        );
      }
    } catch (error) {
      console.error("Error calculating directions:", error);
      setDirectionsError("Error calculating directions");
    }
  }, [deliveryDetails]);

  // Render the map
  return (
    <div className="w-full h-[500px] relative rounded-lg overflow-hidden shadow-md my-6">
      <GoogleMap
        mapContainerStyle={{
          width: '100%',
          height: '100%'
        }}
        center={deliveryPartnerLocation}
        zoom={12}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {/* Delivery Partner Current Location - only showing this custom marker, letting DirectionsRenderer handle the rest */}
        <Marker
          position={deliveryPartnerLocation}
          icon={{
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
            scaledSize: new google.maps.Size(40, 40)
          }}
          title="Delivery Partner's Current Location"
        />
        
        {/* Display optimized route */}
        {directions && (
          <DirectionsRenderer 
            directions={directions}
            options={{
              suppressMarkers: false, // Allow Google to show their default A, B, C markers
              polylineOptions: {
                strokeColor: '#4285F4',
                strokeWeight: 5
              }
            }}
          />
        )}
      </GoogleMap>
      
      {directionsError && (
        <div className="absolute bottom-0 left-0 right-0 bg-red-500 text-white p-2 text-sm">
          {directionsError}
        </div>
      )}
      
      {/* Updated legend to match Google Maps DirectionsRenderer markers */}
      <div className="absolute top-2 left-2 bg-white p-2 rounded shadow-md text-sm">
        <div className="flex items-center mb-1">
          <div className="h-5 w-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2">
            <span>•</span>
          </div>
          <span>Delivery Partner&apos;s Current Location</span>
        </div>
        <div className="flex items-center mb-1 text-xs">
          <div className="flex items-center justify-center h-5 w-5 rounded-full bg-white border border-gray-300 text-red-600 font-bold mr-2">
            A
          </div>
          <span>Starting Point</span>
        </div>
        <div className="flex items-center mb-1 text-xs">
          <div className="flex items-center justify-center h-5 w-5 rounded-full bg-white border border-gray-300 text-red-600 font-bold mr-2">
            B
          </div>
          <span>Pickup Location</span>
        </div>
        <div className="flex items-center mb-1 text-xs">
          <div className="flex items-center justify-center h-5 w-5 rounded-full bg-white border border-gray-300 text-red-600 font-bold mr-2">
            C+
          </div>
          <span>Delivery Locations</span>
        </div>
        <div className="flex items-center text-xs">
          <div className="flex items-center justify-center h-5 w-5 rounded-full bg-white border border-gray-300 text-red-600 font-bold mr-2">
            F
          </div>
          <span>Final Destination</span>
        </div>
      </div>
    </div>
  );
};

export default function OrderTrackingPage() {
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

  // Function to fetch delivery details for an order
  const fetchDeliveryDetails = async (deliveryId: string) => {
    try {
      const response = await fetch(`https://hasbgxp22pykmsxgmrripwf73m0nvhdh.lambda-url.us-east-1.on.aws/partners/${deliveryId}`);
      
      if (!response.ok) {
        console.error(`Error fetching delivery details: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      console.log("Delivery details:", data);
      setDeliveryDetails({ ...data, lastFetchTime: Date.now() });
    } catch (err: any) {
      console.error("Error fetching delivery details:", err);
      // Don't set error state here, we'll just have partial data
    }
  };

  // Function to fetch restaurant details
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
      // Don't set error state here, we'll just have partial data
    }
  };

  // Function to fetch order details
  const fetchOrderDetails = async (id: string, userId: string | undefined) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/orders/${id}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching order: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Verify this order belongs to the current user
      if (userId && data.customer_id !== userId) {
        setError("You don't have permission to view this order");
        setOrder(null);
      } else {
        setOrder(data);
        setError(null);
        
        // Fetch restaurant details if we have a restaurant_id
        if (data.restaurant_id) {
          await fetchRestaurantDetails(data.restaurant_id);
        }

        // If order has a delivery_id and status is ready for delivery, fetch delivery details
        // Only fetch if we don't already have delivery details or it's been more than 60 seconds since last fetch
        const shouldFetchDeliveryDetails = data.delivery_id && 
          (data.status === 'ready_for_delivery' || getDisplayStatus(data.status) === ORDER_STATUS.READY) &&
          (!deliveryDetails || !deliveryDetails.lastFetchTime || (Date.now() - deliveryDetails.lastFetchTime) > 60000);
        
        if (shouldFetchDeliveryDetails) {
          await fetchDeliveryDetails(data.delivery_id);
        } else if (!data.delivery_id || !(data.status === 'ready_for_delivery' || getDisplayStatus(data.status) === ORDER_STATUS.READY)) {
          // Reset delivery details if not applicable
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
      
      // If we have orders, set the most recent one
      if (data && data.length > 0) {
        // Sort by date descending
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

  // Initial load of order details
  useEffect(() => {
    // Redirect non-customers to appropriate pages
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

    // Fetch the order data if we have an order ID
    if (orderId && auth.isAuthenticated) {
      const userId = auth.user?.profile["cognito:username"];
      fetchOrderDetails(orderId, userId);
    } else if (!orderId) {
      // If no order ID, try to get recent orders
      fetchRecentOrders();
    }
  }, [orderId, auth.isAuthenticated, auth.user?.profile]);

  // Set up polling for order status updates
  useEffect(() => {
    // Don't set up polling if we don't have an order or user authentication
    if (!orderId || !auth.isAuthenticated) return;
    
    const userId = auth.user?.profile["cognito:username"];

    // Clear any existing interval first to prevent duplicates
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
    }

    // Only poll if the order is in an active state
    if (order && !isOrderCompleted(order.status)) {
      // Set up interval to refresh order data every 30 seconds
      const interval = setInterval(() => {
        fetchOrderDetails(orderId, userId);
      }, 30000); // 30 seconds
      
      refreshInterval.current = interval;
    } else if (refreshInterval.current && isOrderCompleted(order?.status)) {
      // Clear polling when order is in a completed state
      clearInterval(refreshInterval.current);
      refreshInterval.current = null;
    }
    
    // Clean up on unmount
    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [orderId, auth.isAuthenticated, order?.status]); // Reduced dependencies

  // Helper function to check if order is in a final state
  const isOrderCompleted = (status: string) => {
    const displayStatus = getDisplayStatus(status);
    return displayStatus === ORDER_STATUS.DELIVERED || 
           displayStatus === ORDER_STATUS.CANCELLED;
  };

  // Helper function to map API status to display status
  const getDisplayStatus = (status: string) => {
    switch(status) {
      case "pending": return ORDER_STATUS.PENDING_CONFIRMATION;
      case "payment_confirmed": return ORDER_STATUS.PENDING_CONFIRMATION;
      case "order_confirmed": return ORDER_STATUS.CONFIRMED;
      case "ready_for_delivery": return ORDER_STATUS.READY;
      case "in_delivery": return ORDER_STATUS.IN_DELIVERY;
      case "delivered": return ORDER_STATUS.DELIVERED;
      case "order_cancelled": return ORDER_STATUS.CANCELLED;
      default: return status;
    }
  };

  // Calculate the progress percentage based on order status
  const getProgressPercentage = (status: string) => {
    const displayStatus = getDisplayStatus(status);
    switch(displayStatus) {
      case ORDER_STATUS.PENDING_CONFIRMATION: return 10;
      case ORDER_STATUS.CONFIRMED: return 40;
      case ORDER_STATUS.READY: return 60;
      case ORDER_STATUS.IN_DELIVERY: return 80;
      case ORDER_STATUS.DELIVERED: return 100;
      case ORDER_STATUS.CANCELLED: return 0;
      default: return 0;
    }
  };

  // Function to get status color based on status
  const getStatusColor = (status: string) => {
    const displayStatus = getDisplayStatus(status);
    switch(displayStatus) {
      case ORDER_STATUS.PENDING_CONFIRMATION: return "text-yellow-500";
      case ORDER_STATUS.CONFIRMED: return "text-indigo-500";
      case ORDER_STATUS.READY: return "text-green-500";
      case ORDER_STATUS.IN_DELIVERY: return "text-blue-500";
      case ORDER_STATUS.DELIVERED: return "text-purple-500";
      case ORDER_STATUS.CANCELLED: return "text-red-500";
      default: return "text-gray-500";
    }
  };

  // Function to get status text
  const getStatusText = (status: string) => {
    const displayStatus = getDisplayStatus(status);
    switch(displayStatus) {
      case ORDER_STATUS.PENDING_CONFIRMATION: return "Awaiting Restaurant Confirmation";
      case ORDER_STATUS.CONFIRMED: return "Order Confirmed - Preparing Your Food";
      case ORDER_STATUS.READY: return "Ready for Delivery";
      case ORDER_STATUS.IN_DELIVERY: return "Out for Delivery";
      case ORDER_STATUS.DELIVERED: return "Delivered";
      case ORDER_STATUS.CANCELLED: return "Cancelled";
      default: return "Unknown Status";
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

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

  // Calculate progress percentage
  const progressPercentage = getProgressPercentage(order.status);
  
  return (
    <main className="max-w-4xl mx-auto py-8 px-4">
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="bg-orange-500 p-6 text-white">
          <h1 className="text-2xl font-bold">Order Tracking</h1>
          <p className="opacity-90">Order #{order.order_id || order.orderId}</p>
        </div>
        
        {/* Progress bar */}
        <div className="p-6">
          Debug info
          <div className="bg-gray-100 p-2 mb-4 rounded">
            <p className="text-xs font-mono">Debug - Status: {order.status}</p>
            <p className="text-xs font-mono">Debug - Display Status: {getDisplayStatus(order.status)}</p>
            <p className="text-xs font-mono">Debug - Has Delivery Details: {deliveryDetails ? 'Yes' : 'No'}</p>
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
          
          {/* Order details */}
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
                      : '30-45 minutes'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Payment</p>
                <p className="font-medium text-green-600">Paid</p>
              </div>
            </div>
          </div>
          
          {/* Order items */}
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
        
        {/* Map component */}
        <div className="p-6 border-t border-gray-200">
          <h2 className="text-xl font-bold mb-4">Order Location Tracking</h2>
          
          {(getDisplayStatus(order.status) === ORDER_STATUS.IN_DELIVERY || getDisplayStatus(order.status) === ORDER_STATUS.READY) && deliveryDetails ? (
            <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
              <DeliveryRouteMap deliveryDetails={deliveryDetails} />
            </LoadScript>
          ) : getDisplayStatus(order.status) === ORDER_STATUS.IN_DELIVERY || getDisplayStatus(order.status) === ORDER_STATUS.READY ? (
            <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
              {/* Use restaurant location data from the restaurant object if available */}
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