"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import "../globals.css";

// Define types for restaurant data
interface Restaurant {
  userId: string; // This will be used as the ID
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
      
      if (!response.ok) {
        throw new Error(`Error fetching restaurant: ${response.statusText}`);
      }
      
      const data: ApiRestaurant = await response.json();
      
      // Transform API data to our Restaurant type
      return {
        userId: data.userId,
        name: data.name || 'Unknown Restaurant',
        // Use the first menu item's image as the restaurant image if available
        image: data.menu && data.menu.length > 0 
          ? data.menu[0].image_url 
          : '/sample-image-1.jpg',
        cuisine: data.menu && data.menu.length > 0 
          ? data.menu[0].category 
          : 'Various',
        rating: data.rating || 0.0,
        time: '30-45 min', // Default as not in API response
        email: data.email,
        address: data.address
      };
    } catch (error) {
      console.error(`Failed to fetch restaurant with ID ${restaurantId}:`, error);
      return null;
    }
  }
};

// Hardcoded restaurant IDs (normally these would come from OpenSearch)
const restaurantIds = [
  "uvQM9dckyv8RZB3hQYrKKw",
  "WZLhPYaYSFy7M_-Jh1VuNw",
  "54e83468-3021-7050-01e5-12a82c111031"
];

// Fallback sample data in case the API is not available
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

function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
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
        <Link href={`/restaurants/menu?id=${restaurant.userId}`} passHref>
          <button className="mt-2 w-full bg-orange-600 text-white py-1.5 rounded-lg font-semibold hover:bg-orange-700 transition">View Menu</button>
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

  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocError(null);
      },
      () => {
        setLocError('Unable to retrieve your location.');
      }
    );
  };

  useEffect(() => {
    const fetchRestaurants = async () => {
      setIsLoading(true);
      try {
        // Fetch each restaurant by ID
        const fetchPromises = restaurantIds.map(id => restaurantService.getRestaurantById(id));
        const results = await Promise.all(fetchPromises);
        
        // Filter out null results
        const fetchedRestaurants = results.filter(result => result !== null) as Restaurant[];
        
        if (fetchedRestaurants.length > 0) {
          setRestaurants(fetchedRestaurants);
        } else {
          // Fallback to sample data if no restaurants were successfully fetched
          setRestaurants(restaurantsFallback);
        }
      } catch (error) {
        console.error('Error fetching restaurants:', error);
        setRestaurants(restaurantsFallback);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  return (
    <main className="bg-orange-50 min-h-screen px-4 md:px-16 py-8">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-8 text-center">Explore Restaurants</h1>
      <div className="mb-6 flex flex-col items-center gap-2">
        <button
          className="bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-orange-700 transition"
          onClick={getLocation}
        >
          Get My Location
        </button>
        {location && (
          <div className="text-green-700 text-sm">Location: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</div>
        )}
        {locError && (
          <div className="text-red-600 text-sm">{locError}</div>
        )}
      </div>
      <div className="mb-10 max-w-xl mx-auto">
        <input
          type="text"
          placeholder="Search for restaurants..."
          className="w-full px-5 py-3 border-2 border-orange-200 rounded-xl shadow focus:outline-none focus:border-orange-500 text-lg"
        />
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
              {restaurants.map((r) => (
                <RestaurantCard key={r.userId} restaurant={r} />
              ))}
            </div>
          )}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">New Arrivals</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 justify-items-center">
            {newArrivalsFallback.map((r) => (
              <RestaurantCard key={r.userId} restaurant={r} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}