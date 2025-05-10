"use client";

import { useState, useEffect } from 'react';
import { Switch } from '@headlessui/react';
import { useAuth } from "react-oidc-context";

// Define the delivery type
interface Delivery {
  id: string;
  restaurant: string;
  destination: string;
  estimatedTime: string;
}

// Define location data types
interface OnlineLocationData {
  deliveryPartnerId: string;
  latitude: number;
  longitude: number;
  status: "online";
}

interface OfflineLocationData {
  deliveryPartnerId: string;
  status: "offline";
}

type LocationData = OnlineLocationData | OfflineLocationData;

export default function DeliveriesPage() {
  const auth = useAuth();
  const userId = auth.user?.profile.sub;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [isAvailable, setIsAvailable] = useState(false);
  const [pendingDeliveries, setPendingDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [locationError, setLocationError] = useState("");

  // Load saved availability state on initial render
  useEffect(() => {
    const savedAvailability = localStorage.getItem('deliveryAvailability');
    if (savedAvailability) {
      const isAvailable = JSON.parse(savedAvailability);
      setIsAvailable(isAvailable);
      
      // If was available, fetch pending deliveries
      if (isAvailable) {
        fetchPendingDeliveries();
      }
    }
  }, []);

  // Get current location and send to API when going online
  const sendLocationUpdate = (status: string) => {
    if (!userId) {
      console.error('No user ID available for location update');
      return;
    }
    
    // If going offline, send the simplified payload
    if (status === 'offline') {
      const locationData: OfflineLocationData = {
        deliveryPartnerId: userId,
        status: "offline"
      };
      
      sendUpdateToAPI(locationData);
      return;
    }
    
    // Otherwise, get geolocation and send full payload
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData: OnlineLocationData = {
            deliveryPartnerId: userId,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            status: "online"
          };
          
          sendUpdateToAPI(locationData);
        },
        (error) => {
          console.error('Error getting location:', error);
          setLocationError("Failed to get current location");
        }
      );
    } else {
      setLocationError("Geolocation is not supported by this browser");
    }
  };
  
  // Helper function to send data to API
  const sendUpdateToAPI = (data: LocationData) => {
    fetch(`${apiBaseUrl}/update-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to update location');
        }
        return response.json();
      })
      .then(data => {
        console.log('Location status updated successfully:', data);
      })
      .catch(error => {
        console.error('Error updating location status:', error);
        setLocationError("Failed to send location to server");
      });
  };

  // Mock function to fetch pending deliveries
  const fetchPendingDeliveries = () => {
    setTimeout(() => {
      setPendingDeliveries([
        { id: '1', restaurant: 'Pizza Place', destination: '123 Main St', estimatedTime: '30 min' },
        { id: '2', restaurant: 'Burger Joint', destination: '456 Elm St', estimatedTime: '25 min' },
      ]);
    }, 2000);
  };

  // This function would be connected to your backend in a real implementation
  const toggleAvailability = async (newState: boolean) => {
    setIsLoading(true);
    setLocationError(""); // Reset any previous location errors
    
    try {
      // Simulating API call with timeout
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Store delivery partner ID in localStorage when setting availability
      if (userId) {
        localStorage.setItem('deliveryPartnerId', userId);
      } else {
        console.error('No user ID available from auth when setting availability');
        return; // Don't proceed if no user ID is available
      }
      
      // Here you would make an API call to update the delivery partner's status
      console.log(`Delivery partner is now ${newState ? 'available' : 'unavailable'} for deliveries`);
      
      // Save to localStorage for persistence
      localStorage.setItem('deliveryAvailability', JSON.stringify(newState));
      
      setIsAvailable(newState);
      
      // Toggle based on availability status
      if (newState) {
        // Send location update when becoming available with status online
        sendLocationUpdate('online');
        fetchPendingDeliveries();
      } else {
        // Send update with status offline when toggling off
        sendLocationUpdate('offline');
        setPendingDeliveries([]);
      }
    } catch (error) {
      console.error('Error toggling availability status:', error);
      // Handle error - perhaps show a notification
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Delivery Dashboard</h1>
      
      {/* Availability Toggle */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Delivery Availability</h2>
            <p className="text-gray-600">
              {isAvailable 
                ? "You're currently receiving delivery requests" 
                : "You're currently not receiving any delivery requests"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${isAvailable ? 'text-green-600' : 'text-gray-500'}`}>
              {isAvailable ? 'Available' : 'Unavailable'}
            </span>
            <Switch
              checked={isAvailable}
              onChange={toggleAvailability}
              className={`${
                isAvailable ? 'bg-green-600' : 'bg-gray-300'
              } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              disabled={isLoading}
            >
              <span
                className={`${
                  isAvailable ? 'translate-x-6' : 'translate-x-1'
                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isLoading ? 'animate-pulse' : ''}`}
              />
            </Switch>
          </div>
        </div>
        {isLoading && (
          <div className="mt-2 flex items-center text-sm text-gray-500">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Updating availability status...
          </div>
        )}
        {locationError && (
          <div className="mt-2 text-sm text-red-500">
            {locationError}
          </div>
        )}
      </div>
      
      {/* Status Indicator */}
      <div className={`mb-6 p-4 rounded-lg ${isAvailable ? 'bg-green-100 border border-green-300' : 'bg-gray-100 border border-gray-300'}`}>
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full mr-2 ${isAvailable ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
          <p className="font-medium">
            {isAvailable 
              ? "You're online and can receive delivery requests" 
              : "You're offline. Toggle the switch to start receiving delivery requests"}
          </p>
        </div>
      </div>
      
      {/* Pending Deliveries Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Pending Deliveries</h2>
          {pendingDeliveries.length > 0 && (
            <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {pendingDeliveries.length} Available
            </span>
          )}
        </div>
        
        {isAvailable && pendingDeliveries.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40">
            <svg className="animate-spin mb-3 h-8 w-8 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-500">Waiting for delivery requests...</p>
          </div>
        )}
        
        {!isAvailable && (
          <div className="flex flex-col items-center justify-center h-40 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            <p className="text-gray-500 mb-1">You&apos;re currently offline</p>
            <p className="text-sm text-gray-400">Toggle the switch above to go online and receive delivery requests</p>
          </div>
        )}
        
        {pendingDeliveries.length > 0 && (
          <div className="space-y-4">
            {pendingDeliveries.map((delivery: Delivery) => (
              <div key={delivery.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition duration-150">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-lg">{delivery.restaurant}</h3>
                    <div className="mt-2 space-y-1">
                      <p className="text-gray-600 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {delivery.destination}
                      </p>
                      <p className="text-gray-600 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Est. Time: {delivery.estimatedTime}
                      </p>
                    </div>
                  </div>
                  <button className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition duration-150 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
                    Accept
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}