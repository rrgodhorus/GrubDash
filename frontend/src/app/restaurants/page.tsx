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
        address: data.address
      };
    } catch (error) {
      console.error(`Failed to fetch restaurant with ID ${restaurantId}:`, error);
      return null;
    }
  },

  // Added: Search API call
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
  "54e83468-3021-7050-01e5-12a82c111031"
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
    const handleClick = async () => {
      if (!userId) return;
  
      await fetch(`${API_BASE_URL}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          itemId: restaurant.userId,
          eventType: "CLICK"
        })
      });
    };
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
        {/* <Link href={`/restaurants/menu?id=${restaurant.userId}`} passHref>
          <button className="mt-2 w-full bg-orange-600 text-white py-1.5 rounded-lg font-semibold hover:bg-orange-700 transition">View Menu</button>
        </Link> */}
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

  // Added: Search state
  const [searchQuery, setSearchQuery] = useState('');

  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
        setLocation(newLocation);
        
        // Call reverseGeocode when location is updated
        reverseGeocode(newLocation.lat, newLocation.lng)
          .then(formattedAddress => {
            setAddress(formattedAddress);
          })
          .catch(err => {
            console.error("Geocoding error:", err);
            setAddress("Address unavailable");
          });
      },
      () => setLocError('Unable to retrieve your location.')
    );
  };

  const reverseGeocode = (lat: number, lng: number): Promise<string> => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
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

  useEffect(() => {
    if (!auth.isAuthenticated || !auth.user) return;
  
    const fetchRestaurants = async () => {
      setIsLoading(true);
      try {
        // Top Picks (once user is ready)
        const personalized = await restaurantService.getTopPicks(auth.user.profile.sub);
        setRecommendedRestaurants(personalized);
        // Popular restaurants
        const results = await Promise.all(restaurantIds.map(id => restaurantService.getRestaurantById(id)));
        const fetchedRestaurants = results.filter(r => r !== null) as Restaurant[];
        setRestaurants(fetchedRestaurants.length > 0 ? fetchedRestaurants : restaurantsFallback);
      } catch (error) {
        console.error('Error fetching restaurants:', error);
      } finally {
        setIsLoading(false);
      }
    };
  
    fetchRestaurants();
  }, [auth.isAuthenticated, auth.user]);  
  
  return (
    <main className="bg-orange-50 min-h-screen px-4 md:px-16 py-8">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-8 text-center">Explore Restaurants</h1>

      <div className="mb-6 flex flex-col items-center gap-2">
        {/* <button
          className="bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-orange-700 transition"
          onClick={getLocation}
        >
          Get My Location
        </button> */}
        {/* {location && <div className="text-green-700 text-sm">Location: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</div>} */}
        {location && <div className="text-green-700 text-sm">Location: {address}</div>}
        {locError && <div className="text-red-600 text-sm">{locError}</div>}
      </div>

      {/* Added: Search input */}
      <div className="mb-10 max-w-xl mx-auto">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setIsLoading(true);
            try {
              const results = await restaurantService.searchRestaurants(searchQuery, location);
              setRestaurants(results);
            } catch (error) {
              console.error("Search failed, using fallback:", error);
              setRestaurants(restaurantsFallback);
            } finally {
              setIsLoading(false);
            }
          }}
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for restaurants..."
            className="w-full px-5 py-3 border-2 border-orange-200 rounded-xl shadow focus:outline-none focus:border-orange-500 text-lg"
          />
        </form>
      </div>

      <section className="space-y-14">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Popular Restaurants</h2>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 justify-items-center">
              {/* {restaurants.map((r) => (
                <RestaurantCard key={r.userId} restaurant={r} />
              ))} */}
              {restaurants.map((r) => (
                <RestaurantCard key={r.userId} restaurant={r} userId={userId} />
              ))}
            </div>
          )}
        </div>
        {recommendedRestaurants.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Top Picks for You</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 justify-items-center">
              {recommendedRestaurants.map((r) => (
                // <RestaurantCard key={r.userId} restaurant={r} />
                <RestaurantCard key={r.userId} restaurant={r} userId={userId} />
              ))}
            </div>
          </div>
        )}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">New Arrivals</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 justify-items-center">
            {newArrivalsFallback.map((r) => (
              <RestaurantCard key={r.userId} restaurant={r} userId={userId} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
