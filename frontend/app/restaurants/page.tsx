"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import "../globals.css";
import { useAuth } from 'react-oidc-context';

// Define types for restaurant data
interface Restaurant {
  userId: string;
  name: string;
  image?: string;
  cuisine?: string;
  rating?: number;
  time?: string;
  email?: string;
  address?: string;
  createdAt?: string;
}

// API response interfaces
interface ApiRestaurant {
  userId: string;
  name: string;
  email: string;
  address?: string;
  rating?: number;
  location_coordinates?: {
    latitude: string;
    longitude: string;
  };
  createdAt?: string;
  menu?: Array<{
    name: string;
    description: string;
    category: string;
    item_id: string;
    image_url: string;
    price: string;
  }>;
}

// API Gateway configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// Modal component for address input
function AddressModal({
  isOpen,
  onClose,
  onSubmit
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (address: string) => void;
}) {
  const [addressInput, setAddressInput] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Enter Your Address</h3>
        <input
          type="text"
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
          placeholder="123 Main St, City, State, Zip"
          className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg mb-4 focus:outline-none focus:border-orange-500"
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (addressInput.trim()) {
                onSubmit(addressInput);
                onClose();
              }
            }}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

// Service for API calls
const restaurantService = {
  async getRestaurantById(restaurantId: string): Promise<Restaurant | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${restaurantId}`);
      if (!response.ok) throw new Error(`Error fetching restaurant: ${response.statusText}`);
      const data: ApiRestaurant = await response.json();
      return {
        userId: data.userId,
        name: data.name || 'Unknown Restaurant',
        image: data.menu && data.menu.length > 0 ? data.menu[0].image_url : '/sample-image-1.jpg',
        cuisine: data.menu && data.menu.length > 0 ? data.menu[0].category : 'Various',
        rating: data.rating || 0.0,
        time: '30-45 min',
        email: data.email,
        address: data.address,
        createdAt: data.createdAt
      };
    } catch (error) {
      console.error(`Failed to fetch restaurant with ID ${restaurantId}:`, error);
      return null;
    }
  },

  async searchRestaurants(query: string, location: { lat: number; lng: number } | null): Promise<Restaurant[]> {
    try {
      const lat = location?.lat ?? 40.7057;  // fallback if location is null
      const lon = location?.lng ?? -74.0124;
      const response = await fetch(`${API_BASE_URL}/users/search?lat=${lat}&lon=${lon}&q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error(`Search failed: ${response.statusText}`);
      const data: ApiRestaurant[] = await response.json();
      return data.map((r) => ({
        userId: r.userId,
        name: r.name,
        image: r.menu && r.menu.length > 0 ? r.menu[0].image_url : '/sample-image-1.jpg',
        cuisine: r.menu && r.menu.length > 0 ? r.menu[0].category : 'Various',
        rating: r.rating || 0,
        time: '30-45 min',
        email: r.email,
        address: r.address,
      }));
    } catch (err) {
      console.error('Search error:', err);
      return [];
    }
  },
  async getTopPicks(userId: string): Promise<Restaurant[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/users/recommendations?userId=${userId}`);
      if (!response.ok) throw new Error("Failed to fetch recommendations");
      const { recommendedRestaurantIds } = await response.json();

      const results = await Promise.all(
        recommendedRestaurantIds.map((id: string) => restaurantService.getRestaurantById(id))
      );

      return results.filter(r => r !== null) as Restaurant[];
    } catch (err) {
      console.error("Top picks fetch failed:", err);
      return [];
    }
  }
};

const restaurantIds = [
  "uvQM9dckyv8RZB3hQYrKKw",
  "WZLhPYaYSFy7M_-Jh1VuNw",
  "54e83468-3021-7050-01e5-12a82c111031",
  "g7h8i9j0-k1l2-m3n4-o5p6-q7r8s9t0u1v2",
  "e1a73f8e-2d47-4d2b-a4f2-921c9e0f9e61",
  "i9j0k1l2-m3n4-o5p6-q7r8-s9t0u1v2w3x4",
  "a3dc7f1c-babc-4d30-9b73-9b5b0ff5d678"
];

const restaurantsFallback = [
  {
    userId: "r1",
    name: 'Italian Bistro',
    image: '/sample-image-1.jpg',
    cuisine: 'Italian',
    rating: 4.7,
    time: '30-40 min',
  },
  {
    userId: "r2",
    name: 'Pizza Palace',
    image: '/sample-image-2.jpg',
    cuisine: 'Italian',
    rating: 4.5,
    time: '20-30 min',
  },
  {
    userId: "r3",
    name: 'Burger Joint',
    image: '/sample-image-3.png',
    cuisine: 'American',
    rating: 4.6,
    time: '25-35 min',
  },
];

const newArrivalsFallback = [
  {
    userId: "r4",
    name: 'Taco Town',
    image: '/grubdash-image-1.png',
    cuisine: 'Mexican',
    rating: 4.4,
    time: '30-40 min',
  },
  {
    userId: "r5",
    name: 'Curry House',
    image: '/grubdash-image-1.png',
    cuisine: 'Indian',
    rating: 4.8,
    time: '35-45 min',
  },
  {
    userId: "r6",
    name: 'Vegan Delight',
    image: '/grubdash-image-1.png',
    cuisine: 'Vegan',
    rating: 4.3,
    time: '20-30 min',
  },
];


function RestaurantCard({ restaurant, userId }: { restaurant: Restaurant; userId: string; }) {
  return (
    <div className="bg-white rounded-xl shadow-lg w-72 min-w-72 hover:scale-105 transition-transform cursor-pointer border border-orange-100">
      <div className="relative h-40 w-full rounded-t-xl overflow-hidden">
        <Image src={restaurant.image || '/sample-image-1.jpg'} alt={restaurant.name} fill className="object-cover" />
      </div>
      <div className="p-4">
        <h3 className="text-lg font-bold text-gray-900 mb-1">{restaurant.name}</h3>
        <div className="text-sm text-gray-600 mb-2">{restaurant.cuisine || 'Various'}</div>
        <div className="flex items-center text-sm text-gray-700 mb-1">
          <span className="mr-2">⭐ {restaurant.rating}</span>
          <span>• {restaurant.time || '30-40 min'}</span>
        </div>
        <Link
            href={`/restaurants/menu?id=${restaurant.userId}`}
            onClick={async () => {
              if (userId) {
                await fetch(`${API_BASE_URL}/interactions`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId,
                    itemId: restaurant.userId,
                    eventType: "CLICK"
                  })
                });
              }
            }}
            passHref
          >
          <button className="mt-2 w-full bg-orange-600 text-white py-1.5 rounded-lg font-semibold hover:bg-orange-700 transition">
            View Menu
          </button>
        </Link>
      </div>
    </div>
  );
}

export default function Restaurants() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [address, setAddress] = useState<string>('');
  const [recommendedRestaurants, setRecommendedRestaurants] = useState<Restaurant[]>([]);
  const auth = useAuth();
  const userId = auth.user?.profile?.sub || '';

  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'none' | 'detected' | 'manual'>('none');

  const [searchQuery, setSearchQuery] = useState('');
  const [newArrivals, setNewArrivals] = useState<Restaurant[]>([]);

  // New state to track if search results are being displayed
  const [isDisplayingSearchResults, setIsDisplayingSearchResults] = useState(false);


  // Update location in both state and localStorage
  const updateLocationData = (newLocation: { lat: number; lng: number } | null, newAddress: string) => {
    setLocation(newLocation);
    setAddress(newAddress);

    // Save to localStorage for use in checkout
    if (newLocation) {
      localStorage.setItem('deliveryLocation', JSON.stringify(newLocation));
      localStorage.setItem('deliveryAddress', newAddress);
    } else {
      localStorage.removeItem('deliveryLocation');
      localStorage.removeItem('deliveryAddress');
    }
  };

  // Load location from localStorage on initial render
  useEffect(() => {
    const savedLocation = localStorage.getItem('deliveryLocation');
    const savedAddress = localStorage.getItem('deliveryAddress');

    if (savedLocation && savedAddress) {
      try {
        const parsedLocation = JSON.parse(savedLocation);
        setLocation(parsedLocation);
        setAddress(savedAddress);
        setLocationStatus(savedAddress ? 'manual' : 'none');
      } catch (error) {
        console.error('Error parsing saved location:', error);
      }
    }

    refreshRestaurants(); // This will set isDisplayingSearchResults to false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getLocation = () => {
    setLocationStatus('detected');
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = { lat: position.coords.latitude, lng: position.coords.longitude };

        // Call reverseGeocode when location is updated
        reverseGeocode(newLocation.lat, newLocation.lng)
          .then(formattedAddress => {
            updateLocationData(newLocation, formattedAddress);
            // If search results are displayed, re-run search with new location
            // Otherwise, refresh popular list (which also considers new location indirectly via `location` state)
            if (isDisplayingSearchResults && searchQuery.trim() !== '') {
                 handleSearchSubmit(undefined, newLocation); // Pass event as undefined, newLocation
            } else {
                refreshRestaurants();
            }
          })
          .catch(err => {
            console.error("Geocoding error:", err);
            updateLocationData(newLocation, "Address unavailable");
          });
      },
      () => {
        setLocError('Unable to retrieve your location.');
        setLocationStatus('none');
      }
    );
  };

  const geocodeAddress = async (address: string): Promise<void> => {
    const apiKey = process.env.NEXT_PUBLIC_Maps_API_KEY;
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
      );
      const data = await response.json();

      if (data.status === "OK" && data.results && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        const formattedAddress = data.results[0].formatted_address;

        updateLocationData({ lat, lng }, formattedAddress);
        setLocationStatus('manual');
        setLocError(null);
      } else {
        throw new Error("Geocoding failed");
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      setLocError('Could not find coordinates for this address');
      setLocationStatus('none');
    }
  };

  const reverseGeocode = (lat: number, lng: number): Promise<string> => {
    const apiKey = process.env.NEXT_PUBLIC_Maps_API_KEY;
    return fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
    )
      .then(res => res.json())
      .then(data => {
        if (data.status === "OK") {
          return data.results[0].formatted_address;
        } else {
          throw new Error("Geocoding failed");
        }
      });
  }

  const handleAddressModalSubmitInternal = (submittedAddress: string) => { // Renamed to avoid conflict
    setIsLoading(true);
    geocodeAddress(submittedAddress)
      .finally(() => {
        // If search results were displayed, re-run search for new address
        // Otherwise, refresh popular list
        if (isDisplayingSearchResults && searchQuery.trim() !== '') {
            handleSearchSubmit(undefined, location); // Use current location state which should be updated by geocodeAddress
        } else {
            refreshRestaurants();
        }
      });
  };

  const refreshRestaurants = async () => {
    setIsLoading(true);
    setIsDisplayingSearchResults(false); // Reset to default view
    try {
      const fetchPromises = restaurantIds.map(id => restaurantService.getRestaurantById(id));
      const results = await Promise.all(fetchPromises);
      const fetchedRestaurants = results.filter(r => r !== null) as Restaurant[];
      const sortedByRating = [...fetchedRestaurants]
        .filter(r => r.rating !== undefined && r.rating !== null)
        .sort((a, b) => b.rating! - a.rating!);

        setRestaurants(sortedByRating.slice(0, 3)); // This is for "Popular Restaurants"

        const sortedByDate = [...fetchedRestaurants]
          .filter(r => r.createdAt)
          .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
          .slice(0, 3);
        setNewArrivals(sortedByDate.length > 0 ? sortedByDate : newArrivalsFallback); // Ensure fallback if API returns empty
    } catch (error) {
      console.error('Error fetching restaurants:', error);
      setRestaurants(restaurantsFallback);
      setNewArrivals(newArrivalsFallback); // Set fallback for new arrivals on error too
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchTopPicks = async () => {
      if (!auth.isAuthenticated || !auth.user) {
        setRecommendedRestaurants([]); // Clear if not authenticated
        return;
      }
      try {
        const personalized = await restaurantService.getTopPicks(auth.user.profile.sub);
        setRecommendedRestaurants(personalized);
      } catch (error) {
        console.error('Failed to fetch top picks:', error);
        setRecommendedRestaurants([]); // Clear on error
      }
    };

    fetchTopPicks();
  }, [auth.isAuthenticated, auth.user]);

  // Renamed the form submit handler to avoid conflicts if any, and to be more specific
  const handleSearchSubmit = async (event?: React.FormEvent<HTMLFormElement>, searchLocation = location) => {
    if (event) event.preventDefault(); // Prevent default form submission if event is passed

    if (!searchQuery.trim()) { // If search query is empty, show popular restaurants
        refreshRestaurants();
        return;
    }

    setIsLoading(true);
    setIsDisplayingSearchResults(true); // Indicate that search results are being shown
    try {
      const results = await restaurantService.searchRestaurants(searchQuery, searchLocation);
      setRestaurants(results.length > 0 ? results : []); // If no results, show empty or a message
    } catch (error) {
      console.error("Search failed, using fallback:", error);
      setRestaurants(restaurantsFallback); // Or set to [] to show "no results" message
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <main className="bg-orange-50 min-h-screen px-4 md:px-16 py-8">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-8 text-center">Explore Restaurants</h1>

      <div className="mb-8 flex flex-col items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            className="bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-orange-700 transition flex items-center justify-center gap-2"
            onClick={getLocation}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            Use My Current Location
          </button>
          <button
            className="bg-white text-orange-600 border-2 border-orange-600 px-4 py-2 rounded-lg font-semibold hover:bg-orange-50 transition flex items-center justify-center gap-2"
            onClick={() => setIsAddressModalOpen(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
              <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
            </svg>
            Enter Address Manually
          </button>
        </div>
        {locationStatus !== 'none' && address && ( // Show address only if available
          <div className="text-green-700 px-4 py-2 bg-green-50 rounded-lg border border-green-200">
            <span className="font-semibold">Delivery Location:</span> {address}
          </div>
        )}
        {locError && <div className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg border border-red-200">{locError}</div>}
      </div>

      <AddressModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        onSubmit={handleAddressModalSubmitInternal} // Use the renamed handler
      />

      <div className="mb-10 max-w-xl mx-auto">
        <form onSubmit={handleSearchSubmit} >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
                setSearchQuery(e.target.value);
                // If search query is cleared, revert to popular restaurants view
                if (e.target.value.trim() === '') {
                    refreshRestaurants();
                }
            }}
            placeholder="Search for restaurants..."
            className="w-full px-5 py-3 border-2 border-orange-200 rounded-xl shadow focus:outline-none focus:border-orange-500 text-lg"
          />
        </form>
      </div>

      <section className="space-y-14">
        <div>
          {/* Conditional Header */}
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            {isDisplayingSearchResults ? 'Search Results' : 'Popular Restaurants'}
          </h2>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
          ) : (
            <>
              {restaurants.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 justify-items-center">
                  {restaurants.map((r) => (
                    <RestaurantCard key={r.userId} restaurant={r} userId={userId}/>
                  ))}
                </div>
              ) : (
                // Show this message if displaying search results and no results found
                // Or if popular list is empty (and not loading)
                <p className="text-center text-gray-500">
                    {isDisplayingSearchResults ? "No restaurants found matching your search." : "No popular restaurants to display at the moment."}
                </p>
              )}
            </>
          )}
        </div>

        {/* Conditional rendering for Top Picks and New Arrivals */}
        {!isDisplayingSearchResults && (
          <>
            {recommendedRestaurants.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Top Picks for You</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 justify-items-center">
                  {recommendedRestaurants.slice(0,3).map((r) => (
                    <RestaurantCard key={r.userId} restaurant={r} userId={userId} />
                  ))}
                </div>
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">New Arrivals</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 justify-items-center">
                {(newArrivals.length > 0 ? newArrivals : newArrivalsFallback).map((r) => ( // Added slice for consistency if needed
                  <RestaurantCard key={r.userId} restaurant={r} userId={userId}/>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}