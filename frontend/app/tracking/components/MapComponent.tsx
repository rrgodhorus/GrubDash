"use client";
import React, { useState, useEffect } from "react";
import { GoogleMap, Marker, DirectionsRenderer } from "@react-google-maps/api";
import { convertToGoogleLatLng, containerStyle, defaultCenter } from "../../utils/mapHelpers";

interface MapComponentProps {
  restaurantLocation: any;
  userLocation: any;
}

const MapComponent: React.FC<MapComponentProps> = ({ 
  restaurantLocation, 
  userLocation 
}) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [directionsError, setDirectionsError] = useState<string | null>(null);

  const restaurantLatLng = convertToGoogleLatLng(restaurantLocation);
  const userLatLng = convertToGoogleLatLng(userLocation);

  // Calculate route between restaurant and user
  useEffect(() => {
    // Only run if we have both coordinates
    if (!restaurantLatLng || !userLatLng) {
      return;
    }
    
    // Define the directions request
    try {
      // Make sure window and google are defined
      if (typeof window === 'undefined' || !window.google || !window.google.maps) {
        return;
      }
      
      const directionsService = new window.google.maps.DirectionsService();
      
      directionsService.route(
        {
          origin: restaurantLatLng,
          destination: userLatLng,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === window.google.maps.DirectionsStatus.OK) {
            setDirections(result);
          } else {
            setDirectionsError(`Directions request failed: ${status}`);
          }
        }
      );
    } catch (error) {
      console.error("Error in directions request:", error);
    }
  }, [restaurantLatLng, userLatLng]);
  
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
        onLoad={(map) => setMap(map)}
        onUnmount={() => setMap(null)}
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
      
      {/* Extract Route Button */}
      {directions && (
        <button 
          onClick={() => {
            try {
              // Extract route coordinates from the directions result
              if (directions && directions.routes && directions.routes.length > 0) {
                const route = directions.routes[0];
                const points: Array<{lat: number, lng: number}> = [];
                
                // Extract from legs and steps
                if (route.legs) {
                  route.legs.forEach(leg => {
                    if (leg.steps) {
                      leg.steps.forEach(step => {
                        if (step.path) {
                          step.path.forEach(point => {
                            points.push({
                              lat: point.lat(),
                              lng: point.lng()
                            });
                          });
                        }
                      });
                    }
                  });
                }
                
                // Log in the main window context
                console.log("Route coordinates:", points);
                alert(`Extracted ${points.length} coordinate points. Check browser console.`);
              } else {
                console.log("No route data available");
                alert("No route data available");
              }
            } catch (error) {
              console.error("Error extracting route:", error);
              alert(`Error extracting route: ${error}`);
            }
          }}
          className="absolute top-2 right-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm shadow"
        >
          Extract Route Coordinates
        </button>
      )}
    </div>
  );
};

export default MapComponent;