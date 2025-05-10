'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';

// Define a type for the driver data with the updated schema
type DriverData = {
  partner_id: string;
  status: 'online' | 'offline' | 'in_delivery';
  lastSeen: number;
  lastAssigned: number;
  lat: number | null;
  lng: number | null;
};

// Define a type for delivery data based on the actual API response
type OrderItem = {
  quantity: number;
  item_id: string;
  name: string;
  unit_price: number;
};

type Location = {
  latitude: number;
  longitude: number;
};

type Order = {
  amount: number;
  pickup_zone: string;
  restaurant_id: string;
  restaurant_location: Location;
  customer_id: string;
  order_id: string;
  delivery_location: Location;
};

type DeliveryData = {
  delivery_id: string;
  partner_id?: string;
  created_at: string;
  orders: Order[];
  last_modified: string;
  status: string;
};

// Store addresses cache to avoid repeated API calls
type AddressCache = {
  [key: string]: string;
};

// Map container style
const mapContainerStyle = {
  width: '100%',
  height: '500px'
};

// Status colors
const statusColors = {
  online: '#4CAF50', // green
  offline: '#9E9E9E', // gray
  in_delivery: '#2196F3' // blue
};

// Format timestamp to human-readable date
const formatTimestamp = (timestamp: number): string => {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleString();
};

export default function DeliveryDriversPage() {
  const [driverData, setDriverData] = useState<DriverData[]>([]);
  const [deliveryData, setDeliveryData] = useState<DeliveryData[]>([]);
  const [loading, setLoading,] = useState<boolean>(true);
  const [error, setError,] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<DriverData | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 40.678, lng: -73.969 });
  const [pendingDeliveries, setPendingDeliveries] = useState<Set<string>>(new Set());
  const [addressCache, setAddressCache] = useState<AddressCache>({});
  const [loadingAddresses, setLoadingAddresses] = useState<Set<string>>(new Set());
  // State to track which deliveries are expanded
  const [expandedDelivery, setExpandedDelivery] = useState<string | null>(null);
  
  // Toggle delivery expansion
  const toggleDeliveryExpansion = (deliveryId: string) => {
    if (expandedDelivery === deliveryId) {
      setExpandedDelivery(null);
    } else {
      setExpandedDelivery(deliveryId);
    }
  };

  // Function to convert coordinates to address
  const fetchAddress = useCallback(async (lat: number, lng: number): Promise<string> => {
    // Create a cache key from coordinates
    const cacheKey = `${lat},${lng}`;
    
    // Check if we already have this address in cache
    if (addressCache[cacheKey]) {
      return addressCache[cacheKey];
    }
    
    // Check if we're already loading this address
    if (loadingAddresses.has(cacheKey)) {
      return "Loading address...";
    }
    
    // Mark this address as loading
    setLoadingAddresses(prev => new Set([...prev, cacheKey]));
    
    try {
      // Use Google Maps Geocoding API to convert coordinates to address
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch address');
      }
      
      const data = await response.json();
      
      // Extract the formatted address from the response
      let address = "Address not found";
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        address = data.results[0].formatted_address;
      }
      
      // Store in cache
      setAddressCache(prev => ({
        ...prev,
        [cacheKey]: address
      }));
      
      return address;
    } catch (error) {
      console.error('Error fetching address:', error);
      return "Error fetching address";
    } finally {
      // Remove from loading set
      setLoadingAddresses(prev => {
        const newSet = new Set([...prev]);
        newSet.delete(cacheKey);
        return newSet;
      });
    }
  }, [addressCache, loadingAddresses]);

  // Fetch driver data
  useEffect(() => {
    const fetchDriverData = async () => {
      try {
        setLoading(true);
        const response = await fetch('https://wtbrztp5jbjif2xt6xch5qnkjy0rsvzd.lambda-url.us-east-1.on.aws/');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.status}`);
        }
        
        const data = await response.json();
        setDriverData(data);
        
        // Find drivers with valid coordinates
        const driversWithCoordinates = data.filter((driver: DriverData) => 
          driver.lat !== null && driver.lng !== null
        );
        
        // If we have drivers with coordinates, center the map on their average location
        if (driversWithCoordinates.length > 0) {
          const avgLat = driversWithCoordinates.reduce((sum: number, driver: DriverData) => 
            sum + (driver.lat || 0), 0) / driversWithCoordinates.length;
          const avgLng = driversWithCoordinates.reduce((sum: number, driver: DriverData) => 
            sum + (driver.lng || 0), 0) / driversWithCoordinates.length;
          setMapCenter({ lat: avgLat, lng: avgLng });
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching driver data:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    // Fetch delivery data from API
    const fetchDeliveryData = async () => {
      try {
        const response = await fetch('https://hasbgxp22pykmsxgmrripwf73m0nvhdh.lambda-url.us-east-1.on.aws/partners');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch deliveries: ${response.status}`);
        }
        
        const data = await response.json();
        setDeliveryData(data);
        
      } catch (err) {
        console.error('Error fetching delivery data:', err);
        // Don't overwrite the driver data error if one exists
        if (!error) {
          setError(err instanceof Error ? err.message : 'An unknown error occurred');
        }
      }
    };

    fetchDriverData();
    fetchDeliveryData();
    
    // Set up polling to refresh data every 30 seconds
    const driverIntervalId = setInterval(fetchDriverData, 30000);
    const deliveryIntervalId = setInterval(fetchDeliveryData, 30000);
    
    // Clean up intervals on component unmount
    return () => {
      clearInterval(driverIntervalId);
      clearInterval(deliveryIntervalId);
    };
  }, []);

  // Fetch addresses when a delivery is expanded
  useEffect(() => {
    if (expandedDelivery) {
      // Find the expanded delivery
      const delivery = deliveryData.find(d => d.delivery_id === expandedDelivery);
      if (delivery) {
        // Fetch addresses for all orders in this delivery
        delivery.orders.forEach(order => {
          // Fetch restaurant address
          fetchAddress(
            order.restaurant_location.latitude,
            order.restaurant_location.longitude
          );
          
          // Fetch delivery address
          fetchAddress(
            order.delivery_location.latitude,
            order.delivery_location.longitude
          );
        });
      }
    }
  }, [expandedDelivery, deliveryData, fetchAddress]);

  // Handle marker click
  const handleMarkerClick = (driver: DriverData) => {
    setSelectedDriver(driver);
  };

  // Handle InfoWindow close
  const handleInfoWindowClose = () => {
    setSelectedDriver(null);
  };

  // Get icon URL based on driver status
  const getMarkerIcon = (status: string) => {
    return {
      url: `data:image/svg+xml,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="${statusColors[status as keyof typeof statusColors] || '#9E9E9E'}" stroke="white" stroke-width="2"/>
        </svg>
      `)}`
    };
  };

  // Handle confirm delivery
  const handleConfirmDelivery = async (deliveryId: string) => {
    setPendingDeliveries(prev => new Set([...prev, deliveryId]));
    try {
      // Send POST request to update the delivery status to confirmed
      const response = await fetch('https://oye2gwjcumaqxhstqyvszyjssy0mfroe.lambda-url.us-east-1.on.aws/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          delivery_id: deliveryId,
          status: "dp_confirmed"
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to confirm delivery: ${response.status}`);
      }
      
      // Refresh delivery data after confirmation
      const deliveriesResponse = await fetch('https://hasbgxp22pykmsxgmrripwf73m0nvhdh.lambda-url.us-east-1.on.aws/');
      if (deliveriesResponse.ok) {
        const data = await deliveriesResponse.json();
        setDeliveryData(data);
      }
    } catch (err) {
      console.error('Error confirming delivery:', err);
    } finally {
      setPendingDeliveries(prev => {
        const newSet = new Set([...prev]);
        newSet.delete(deliveryId);
        return newSet;
      });
    }
  };

  // Handle cancel delivery
  const handleCancelDelivery = async (deliveryId: string) => {
    setPendingDeliveries(prev => new Set([...prev, deliveryId]));
    try {
      // Send POST request to update the delivery status to cancelled
      const response = await fetch('https://oye2gwjcumaqxhstqyvszyjssy0mfroe.lambda-url.us-east-1.on.aws/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          delivery_id: deliveryId,
          status: "dp_cancelled"
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to cancel delivery: ${response.status}`);
      }
      
      // Refresh delivery data after cancellation
      const deliveriesResponse = await fetch('https://hasbgxp22pykmsxgmrripwf73m0nvhdh.lambda-url.us-east-1.on.aws/');
      if (deliveriesResponse.ok) {
        const data = await deliveriesResponse.json();
        setDeliveryData(data);
      }
    } catch (err) {
      console.error('Error cancelling delivery:', err);
    } finally {
      setPendingDeliveries(prev => {
        const newSet = new Set([...prev]);
        newSet.delete(deliveryId);
        return newSet;
      });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Delivery Drivers</h1>
      
      {loading && (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}
      
      {!loading && !error && (
        <div className="mb-6">
          <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}>
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={13}
            >
              {driverData
                .filter(driver => driver.lat !== null && driver.lng !== null)
                .map((driver) => (
                  <Marker
                    key={driver.partner_id}
                    position={{ lat: driver.lat!, lng: driver.lng! }}
                    onClick={() => handleMarkerClick(driver)}
                    icon={getMarkerIcon(driver.status)}
                  />
                ))}
              {selectedDriver && selectedDriver.lat !== null && selectedDriver.lng !== null && (
                <InfoWindow
                  position={{ lat: selectedDriver.lat, lng: selectedDriver.lng }}
                  onCloseClick={handleInfoWindowClose}
                >
                  <div className="p-2">
                    <h3 className="font-bold">{selectedDriver.partner_id}</h3>
                    <p>Status: <span className="font-semibold" style={{ color: statusColors[selectedDriver.status] }}>{selectedDriver.status.replace('_', ' ')}</span></p>
                    <p>Last Assigned: {formatTimestamp(selectedDriver.lastAssigned)}</p>
                    <p>Location: {selectedDriver.lat.toFixed(6)}, {selectedDriver.lng.toFixed(6)}</p>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          </LoadScript>
        </div>
      )}
      
      {!loading && !error && driverData.length > 0 && (
        <div className="bg-white shadow-md rounded-lg overflow-hidden mt-4">
          <h2 className="text-xl font-semibold p-4 bg-gray-50 border-b">Driver Status</h2>
          
          {/* Status summary */}
          <div className="p-4 border-b">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-100 p-3 rounded-lg shadow-sm">
                <div className="font-bold text-green-800">Online</div>
                <div className="text-xl">{driverData.filter(d => d.status === 'online').length}</div>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg shadow-sm">
                <div className="font-bold text-blue-800">In Delivery</div>
                <div className="text-xl">{driverData.filter(d => d.status === 'in_delivery').length}</div>
              </div>
              <div className="bg-gray-100 p-3 rounded-lg shadow-sm">
                <div className="font-bold text-gray-800">Offline</div>
                <div className="text-xl">{driverData.filter(d => d.status === 'offline').length}</div>
              </div>
            </div>
          </div>
          
          {/* Driver list */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Assigned</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {driverData.map((driver) => (
                  <tr key={driver.partner_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{driver.partner_id}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span 
                        className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" 
                        style={{ 
                          backgroundColor: `${statusColors[driver.status]}20`,
                          color: statusColors[driver.status] 
                        }}
                      >
                        {driver.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTimestamp(driver.lastAssigned)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {driver.lat !== null && driver.lng !== null 
                        ? `${driver.lat.toFixed(6)}, ${driver.lng.toFixed(6)}`
                        : 'No location data'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && deliveryData.length > 0 && (
        <div className="bg-white shadow-md rounded-lg overflow-hidden mt-4">
          <h2 className="text-xl font-semibold p-4 bg-gray-50 border-b">Deliveries</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery ID</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Partner ID</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {deliveryData.map((delivery) => (
                  <React.Fragment key={delivery.delivery_id}>
                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleDeliveryExpansion(delivery.delivery_id)}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">{delivery.delivery_id}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{delivery.partner_id || 'Unassigned'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{new Date(delivery.created_at).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {delivery.orders.length} orders
                        <span className="ml-2 text-blue-500">
                          {expandedDelivery === delivery.delivery_id ? '▼' : '▶'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          delivery.status === 'dp_assigned' ? 'bg-blue-100 text-blue-800' :
                          delivery.status === 'dp_completed' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {delivery.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {delivery.status === "dp_assigned" && delivery.partner_id && (
                          <>
                            <button
                              className="bg-green-500 text-white px-4 py-2 rounded mr-2 hover:bg-green-600 transition-colors"
                              disabled={pendingDeliveries.has(delivery.delivery_id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmDelivery(delivery.delivery_id);
                              }}
                            >
                              {pendingDeliveries.has(delivery.delivery_id) ? 'Processing...' : 'Confirm'}
                            </button>
                            <button
                              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
                              disabled={pendingDeliveries.has(delivery.delivery_id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelDelivery(delivery.delivery_id);
                              }}
                            >
                              {pendingDeliveries.has(delivery.delivery_id) ? 'Processing...' : 'Cancel'}
                            </button>
                          </>
                        )}
                        {(delivery.status !== "dp_assigned" || !delivery.partner_id) && (
                          <span className="text-gray-500">No actions available</span>
                        )}
                      </td>
                    </tr>
                    {expandedDelivery === delivery.delivery_id && (
                      <tr className="bg-gray-50">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="border rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Restaurant Location</th>
                                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Delivery Location</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {delivery.orders.map((order) => {
                                  // Get cached addresses or loading state
                                  const restaurantCacheKey = `${order.restaurant_location.latitude},${order.restaurant_location.longitude}`;
                                  const deliveryCacheKey = `${order.delivery_location.latitude},${order.delivery_location.longitude}`;
                                  
                                  const restaurantAddress = addressCache[restaurantCacheKey] || 
                                    (loadingAddresses.has(restaurantCacheKey) ? "Loading address..." : "Address not loaded");
                                  
                                  const deliveryAddress = addressCache[deliveryCacheKey] || 
                                    (loadingAddresses.has(deliveryCacheKey) ? "Loading address..." : "Address not loaded");
                                  
                                  return (
                                    <tr key={order.order_id} className="hover:bg-gray-50">
                                      <td className="px-4 py-2 whitespace-nowrap text-sm">{order.order_id}</td>
                                      <td className="px-4 py-2 whitespace-nowrap text-sm">${order.amount.toFixed(2)}</td>
                                      <td className="px-4 py-2 text-sm">
                                        <div>
                                          <span className="font-semibold">Coordinates:</span><br/>
                                          {order.restaurant_location.latitude.toFixed(6)}, {order.restaurant_location.longitude.toFixed(6)}
                                        </div>
                                        <div className="mt-2">
                                          <span className="font-semibold">Address:</span><br/>
                                          {restaurantAddress}
                                        </div>
                                      </td>
                                      <td className="px-4 py-2 text-sm">
                                        <div>
                                          <span className="font-semibold">Coordinates:</span><br/>
                                          {order.delivery_location.latitude.toFixed(6)}, {order.delivery_location.longitude.toFixed(6)}
                                        </div>
                                        <div className="mt-2">
                                          <span className="font-semibold">Address:</span><br/>
                                          {deliveryAddress}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}