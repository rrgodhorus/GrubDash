import { LatLngLiteral } from "@react-google-maps/api";

// Default map center (NYC)
export const defaultCenter = {
  lat: 40.7128,
  lng: -74.0060
};

// Default map container style
export const containerStyle = {
  width: '100%',
  height: '400px'
};

// Safe conversion to number
export const toNumber = (value: any): number | null => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return !isNaN(num) ? num : null;
};

// Convert location format for Google Maps safely
export const convertToGoogleLatLng = (location: any): LatLngLiteral | null => {
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

// Extract route coordinates from directions result
export const extractRouteCoordinates = (
  result: google.maps.DirectionsResult | null
): Array<LatLngLiteral> => {
  if (!result || !result.routes || !result.routes[0]) {
    return [];
  }
  
  const route = result.routes[0];
  const points: Array<LatLngLiteral> = [];
  
  // For smoother animation, use the overview_path if available
  if (route.overview_path) {
    for (let i = 0; i < route.overview_path.length; i++) {
      const point = route.overview_path[i];
      points.push({
        lat: point.lat(),
        lng: point.lng()
      });
    }
    return points;
  }
  
  // Fall back to extracting from legs and steps if overview_path isn't available
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
  
  return points;
};