"use client";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { GoogleMap, Marker, DirectionsRenderer } from "@react-google-maps/api";
import { convertToGoogleLatLng, extractRouteCoordinates } from "../../utils/mapHelpers";
import { useAuth } from "react-oidc-context"; // Add this import at the top with other imports

interface DeliveryRouteMapProps {
  deliveryDetails: any;
  onEstimatedDeliveryTimeChange?: (time: string) => void;
}

const DeliveryRouteMap: React.FC<DeliveryRouteMapProps> = ({ 
  deliveryDetails,
  onEstimatedDeliveryTimeChange
}) => {
  const auth = useAuth(); // Add this line to access auth context
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [directionsError, setDirectionsError] = useState<string | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{lat: number, lng: number}>>([]);
  const [currentPositionIndex, setCurrentPositionIndex] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const simulationRef = useRef<NodeJS.Timeout | null>(null);
  // Add estimated delivery time state
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState<string>('Calculating...');
  const [remainingDistance, setRemainingDistance] = useState<string>('');
  
  // Use ref to store delivery partner location to avoid unnecessary re-renders
  const [deliveryPartnerLocation, setDeliveryPartnerLocation] = useState({
    lat: 40.68303738371292,
    lng: -73.96486127243192
  });
  
  // Add WebSocket connection reference
  const websocketRef = useRef<WebSocket | null>(null);
  const [isLiveTracking, setIsLiveTracking] = useState<boolean>(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  
  // Refs to store processed route data to avoid recalculation
  const processedDeliveryDetails = useRef<any>(null);
  const directionsCalculated = useRef<boolean>(false);

  // Ensure we have a specific reference for the driver marker
  const [driverMarker, setDriverMarker] = useState<google.maps.Marker | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    
    // Create a driver marker when the map loads
    if (map && !driverMarker) {
      const newDriverMarker = new google.maps.Marker({
        position: deliveryPartnerLocation,
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#4285F4',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
        title: "Delivery Driver",
        zIndex: 1000, // Ensure it's on top of other markers
      });
      
      setDriverMarker(newDriverMarker);
    }
  }, [deliveryPartnerLocation, driverMarker]);

  const onUnmount = useCallback(() => {
    // Clean up the driver marker when unmounting
    if (driverMarker) {
      driverMarker.setMap(null);
      setDriverMarker(null);
    }
    setMap(null);
  }, [driverMarker]);

  // Simulate the delivery driver moving through the route
  const startSimulation = useCallback(() => {
    // Clear any existing simulation
    if (simulationRef.current) {
      clearInterval(simulationRef.current);
      simulationRef.current = null;
    }

    // Make sure we have coordinates and a marker
    if (routeCoordinates.length === 0 || !driverMarker) {
      console.error("Can't start simulation: missing coordinates or driver marker");
      return;
    }

    // Reset position to start
    setCurrentPositionIndex(0);
    setIsSimulating(true);
    
    // Set the initial position
    const initialPos = routeCoordinates[0];
    setDeliveryPartnerLocation(initialPos);
    driverMarker.setPosition(initialPos);
    
    // If map is available, center it on the driver position initially
    if (map) {
      map.panTo(initialPos);
      map.setZoom(15); // Set a closer zoom for better visibility
    }
    
    let currentIndex = 0;
    
    // Start the simulation with a smoother animation
    simulationRef.current = setInterval(() => {
      currentIndex++;
      
      // If we've reached the end of the route, stop the simulation
      if (currentIndex >= routeCoordinates.length - 1) {
        if (simulationRef.current) {
          clearInterval(simulationRef.current);
          simulationRef.current = null;
        }
        setIsSimulating(false);
        return;
      }
      
      // Update the position index for UI
      setCurrentPositionIndex(currentIndex);
      
      // Get the next position
      const nextPos = routeCoordinates[currentIndex];
      
      // Update the state
      setDeliveryPartnerLocation(nextPos);
      
      // Update the marker position (this is key for the animation)
      if (driverMarker) {
        driverMarker.setPosition(nextPos);
      }
      
      // Only pan the map if the driver position gets close to the edge of the viewport
      if (map) {
        const bounds = map.getBounds();
        if (bounds) {
          // Add some padding so we don't wait until the marker is exactly at the edge
          const padding = 0.2; // 20% of the viewport
          const ne = bounds.getNorthEast();
          const sw = bounds.getSouthWest();
          
          // Calculate the inner bounds (with padding)
          const innerNorth = sw.lat() + (ne.lat() - sw.lat()) * (1 - padding);
          const innerSouth = sw.lat() + (ne.lat() - sw.lat()) * padding;
          const innerEast = sw.lng() + (ne.lng() - sw.lng()) * (1 - padding);
          const innerWest = sw.lng() + (ne.lng() - sw.lng()) * padding;
          
          // Check if driver is outside the inner bounds, then pan the map
          if (nextPos.lat > innerNorth || 
              nextPos.lat < innerSouth || 
              nextPos.lng > innerEast || 
              nextPos.lng < innerWest) {
            map.panTo(nextPos);
          }
        }
      }
    }, 500); // 0.5 second delay
  }, [routeCoordinates, map, driverMarker]);

  // Stop the simulation
  const stopSimulation = useCallback(() => {
    if (simulationRef.current) {
      clearInterval(simulationRef.current);
      simulationRef.current = null;
    }
    setIsSimulating(false);
  }, []);

  // Initialize WebSocket connection
  const connectToWebSocket = useCallback(() => {
    // Close any existing connection
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }

    // Get userId from auth context
    const userId = auth.user?.profile["cognito:username"];
    if (!userId) {
      alert("User ID not available. Please make sure you're logged in.");
      return;
    }

    // Create a new WebSocket connection with customerId parameter
    const socket = new WebSocket(`wss://5g5tej9zt6.execute-api.us-east-1.amazonaws.com/production?customerId=${userId}`);
    
    socket.onopen = () => {
      console.log('WebSocket connection established');
      setIsLiveTracking(true);
      
      // Stop simulation if it's running
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
        simulationRef.current = null;
        setIsSimulating(false);
      }
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Check if it's a location update
        if (data.type === 'location_update' && data.lat && data.lng) {
          const newLocation = {
            lat: data.lat,
            lng: data.lng
          };
          
          // Update the delivery partner's location
          setDeliveryPartnerLocation(newLocation);
          
          // Auto-pan the map if the driver is near the edge
          if (map && driverMarker) {
            const bounds = map.getBounds();
            if (bounds) {
              const padding = 0.2;
              const ne = bounds.getNorthEast();
              const sw = bounds.getSouthWest();
              
              const innerNorth = sw.lat() + (ne.lat() - sw.lat()) * (1 - padding);
              const innerSouth = sw.lat() + (ne.lat() - sw.lat()) * padding;
              const innerEast = sw.lng() + (ne.lng() - sw.lng()) * (1 - padding);
              const innerWest = sw.lng() + (ne.lng() - sw.lng()) * padding;
              
              if (newLocation.lat > innerNorth || 
                  newLocation.lat < innerSouth || 
                  newLocation.lng > innerEast || 
                  newLocation.lng < innerWest) {
                map.panTo(newLocation);
              }
            }
          }
          
          // Format and set the last update time
          if (data.timestamp) {
            const date = new Date(data.timestamp);
            setLastUpdateTime(date.toLocaleTimeString());
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsLiveTracking(false);
    };
    
    socket.onclose = () => {
      console.log('WebSocket connection closed');
      setIsLiveTracking(false);
    };
    
    websocketRef.current = socket;
  }, [map, driverMarker, auth.user]);
  
  // Disconnect from WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
      setIsLiveTracking(false);
    }
  }, []);

  // Clean up WebSocket connection on unmount
  useEffect(() => {
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);

  // Clean up interval and marker on unmount
  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
      }
      if (driverMarker) {
        driverMarker.setMap(null);
      }
    };
  }, [driverMarker]);

  // Update driver marker position when deliveryPartnerLocation changes
  useEffect(() => {
    if (driverMarker) {
      driverMarker.setPosition(deliveryPartnerLocation);
    }
  }, [deliveryPartnerLocation, driverMarker]);

  // Calculate optimized route ONLY when deliveryDetails changes or first mounts
  useEffect(() => {
    if (!deliveryDetails || !deliveryDetails.orders || deliveryDetails.orders.length === 0) {
      return;
    }

    // Skip if we've already processed this exact delivery details object
    if (
      processedDeliveryDetails.current === deliveryDetails &&
      directionsCalculated.current
    ) {
      return;
    }

    // Skip route recalculation if there's an active live tracking or simulation
    // This prevents the route from being redrawn during active tracking
    if (isLiveTracking || isSimulating) {
      return;
    }

    // Store reference to this delivery details object for future comparison
    processedDeliveryDetails.current = deliveryDetails;

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
              
              // Extract and store route coordinates for distance calculations
              const coordinates = extractRouteCoordinates(result);
              setRouteCoordinates(coordinates);
              
              // Mark that we've calculated directions
              directionsCalculated.current = true;
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
  }, [deliveryDetails, isLiveTracking, isSimulating, deliveryPartnerLocation]);

  // Function to send simulation payload to the endpoint
  const sendSimulationPayload = useCallback(async () => {
    try {
      if (!directions || !directions.routes || directions.routes.length === 0) {
        alert("No route data available for simulation");
        return;
      }

      // Get the userId from authentication
      const userId = auth.user?.profile["cognito:username"];
      if (!userId) {
        alert("User ID not available. Please make sure you're logged in.");
        return;
      }

      // Extract route coordinates
      const coordinates = extractRouteCoordinates(directions);
      
      // Prepare the payload
      const payload = {
        userId: userId,
        routeCoordinates: coordinates
      };

      // Send the POST request
      const response = await fetch("https://e334ywse4htnefrculb2yf2usy0rjzip.lambda-url.us-east-1.on.aws/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        alert("Simulation payload sent successfully!");
        console.log("Simulation response:", data);
      } else {
        throw new Error(`Error: ${response.status} - ${response.statusText}`);
      }
    } catch (error) {
      console.error("Error sending simulation payload:", error);
      alert(`Failed to send simulation payload: ${error}`);
    }
  }, [directions, auth.user]);

  // Calculate estimated delivery time based on driver position
  const calculateEstimatedDeliveryTime = useCallback(() => {
    if (!directions || !directions.routes || directions.routes.length === 0) {
      return;
    }

    try {
      // Get the route information
      const route = directions.routes[0];
      
      // Get total route duration in seconds
      const totalDuration = route.legs.reduce(
        (total, leg) => total + leg.duration!.value,
        0
      );
      
      // Get total distance in meters
      const totalDistance = route.legs.reduce(
        (total, leg) => total + leg.distance!.value,
        0
      );
      
      // Calculate progress based on current position index
      const progress = currentPositionIndex / routeCoordinates.length;
      
      // Estimate remaining time (in seconds)
      const remainingTime = totalDuration * (1 - progress);
      
      // Estimate remaining distance (in meters)
      const remainingDistanceValue = totalDistance * (1 - progress);
      
      // Format remaining distance
      setRemainingDistance(
        remainingDistanceValue > 1000
          ? `${(remainingDistanceValue / 1000).toFixed(1)} km`
          : `${Math.round(remainingDistanceValue)} m`
      );
      
      // Calculate estimated arrival time
      const now = new Date();
      const arrivalTime = new Date(now.getTime() + remainingTime * 1000);
      
      // Format delivery time string
      const timeString = arrivalTime.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      // Format duration in minutes
      const minutesRemaining = Math.ceil(remainingTime / 60);
      
      setEstimatedDeliveryTime(
        `${timeString} (in ${minutesRemaining} min)`
      );
    } catch (error) {
      console.error("Error calculating estimated delivery time:", error);
      setEstimatedDeliveryTime("Estimation failed");
    }
  }, [directions, currentPositionIndex, routeCoordinates.length]);

  // Update estimated time whenever position changes
  useEffect(() => {
    if (directions && routeCoordinates.length > 0) {
      calculateEstimatedDeliveryTime();
      
      // Call the callback function to update the parent component's state
      if (onEstimatedDeliveryTimeChange) {
        onEstimatedDeliveryTimeChange(estimatedDeliveryTime);
      }
    }
  }, [calculateEstimatedDeliveryTime, directions, currentPositionIndex, routeCoordinates.length, estimatedDeliveryTime, onEstimatedDeliveryTimeChange]);

  // Update estimated time for live tracking
  useEffect(() => {
    if (isLiveTracking && directions && routeCoordinates.length > 0) {
      // Find the closest point on the route to the current delivery partner location
      let closestPointIndex = 0;
      let closestDistance = Number.MAX_VALUE;
      
      routeCoordinates.forEach((coord, index) => {
        const distance = Math.sqrt(
          Math.pow(coord.lat - deliveryPartnerLocation.lat, 2) +
          Math.pow(coord.lng - deliveryPartnerLocation.lng, 2)
        );
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPointIndex = index;
        }
      });
      
      // Update position index based on real location
      setCurrentPositionIndex(closestPointIndex);
    }
  }, [isLiveTracking, deliveryPartnerLocation, directions, routeCoordinates]);

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
        options={{
          fullscreenControl: false, // Disable fullscreen control to make UI cleaner
          streetViewControl: false, // Disable street view for cleaner UI
          mapTypeControl: false,   // Disable map type controls
          zoomControl: true,       // Keep zoom control
        }}
      >
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
      
      {/* Buttons */}
      {directions && (
        <div className="absolute top-2 right-2 flex flex-col space-y-2">
          <button 
            onClick={sendSimulationPayload}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm shadow"
          >
            Send Simulation Payload
          </button>
          
          {/* Live Tracking buttons */}
          {!isLiveTracking ? (
            <button 
              onClick={connectToWebSocket}
              className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded-md text-sm shadow"
            >
              Start Live Tracking
            </button>
          ) : (
            <button 
              onClick={disconnectWebSocket}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm shadow"
            >
              Stop Live Tracking
            </button>
          )}
        </div>
      )}
      
      {/* Display live tracking status */}
      {isLiveTracking && (
        <div className="absolute top-2 left-2 bg-white p-3 rounded shadow-md text-sm z-20">
          <div className="font-semibold mb-2 text-purple-600">Live Driver Tracking</div>
          <div className="mb-1">Last Update: {lastUpdateTime || 'Waiting...'}</div>
          <div className="text-xs text-gray-600">Coordinates: {JSON.stringify(deliveryPartnerLocation)}</div>
        </div>
      )}
      
      {/* Display simulation status - only show if simulating */}
      {isSimulating && (
        <div className="absolute top-2 left-2 bg-white p-3 rounded shadow-md text-sm z-20">
          <div className="font-semibold mb-2 text-blue-600">Live Delivery Simulation</div>
          <div className="mb-1">Position: {currentPositionIndex + 1} / {routeCoordinates.length}</div>
          <div className="text-xs text-gray-600">Coordinates: {JSON.stringify(deliveryPartnerLocation)}</div>
        </div>
      )}
      
      {/* Display estimated delivery time */}
      {directions && (
        <div className="absolute bottom-16 left-2 bg-white p-3 rounded shadow-md text-sm z-20">
          <div className="font-semibold mb-1 text-green-600">Estimated Delivery</div>
          <div className="mb-1">Time: {estimatedDeliveryTime}</div>
          {remainingDistance && (
            <div className="text-xs text-gray-600">Remaining: {remainingDistance}</div>
          )}
        </div>
      )}
      
      {/* Legend */}
      <div className="absolute bottom-2 left-2 bg-white p-2 rounded shadow-md text-sm">
        <div className="flex items-center mb-1">
          <div className="h-5 w-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2">
            <span>•</span>
          </div>
          <span>Delivery Driver</span>
        </div>
        {/* <div className="flex items-center mb-1 text-xs">
          <div className="flex items-center justify-center h-5 w-5 rounded-full bg-white border border-gray-300 text-red-600 font-bold mr-2">
            A
          </div>
          <span>Starting Point</span>
        </div> */}
        {/* <div className="flex items-center mb-1 text-xs">
          <div className="flex items-center justify-center h-5 w-5 rounded-full bg-white border border-gray-300 text-red-600 font-bold mr-2">
            B
          </div>
          <span>Pickup Location</span>
        </div> */}
        {/* <div className="flex items-center mb-1 text-xs">
          <div className="flex items-center justify-center h-5 w-5 rounded-full bg-white border border-gray-300 text-red-600 font-bold mr-2">
            C+
          </div>
          <span>Delivery Locations</span>
        </div> */}
        {/* <div className="flex items-center text-xs">
          <div className="flex items-center justify-center h-5 w-5 rounded-full bg-white border border-gray-300 text-red-600 font-bold mr-2">
            F
          </div>
          <span>Final Destination</span>
        </div> */}
      </div>
    </div>
  );
};

export default DeliveryRouteMap;