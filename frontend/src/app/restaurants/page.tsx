"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import "../globals.css";

const popularRestaurants = [
  {
    id: "r1",
    name: 'Italian Bistro',
    image: '/sample-image-1.jpg',
    cuisine: 'Italian',
    rating: 4.7,
    time: '30-40 min',
  },
  {
    id: "r2",
    name: 'Pizza Palace',
    image: '/sample-image-2.jpg',
    cuisine: 'Italian',
    rating: 4.5,
    time: '20-30 min',
  },
  {
    id: "r3",
    name: 'Burger Joint',
    image: '/sample-image-3.png',
    cuisine: 'American',
    rating: 4.6,
    time: '25-35 min',
  },
];

const newArrivals = [
  {
    id: "r4",
    name: 'Taco Town',
    image: '/grubdash-image-1.png',
    cuisine: 'Mexican',
    rating: 4.4,
    time: '30-40 min',
  },
  {
    id: "r5",
    name: 'Curry House',
    image: '/grubdash-image-1.png',
    cuisine: 'Indian',
    rating: 4.8,
    time: '35-45 min',
  },
  {
    id: "r6",
    name: 'Vegan Delight',
    image: '/grubdash-image-1.png',
    cuisine: 'Vegan',
    rating: 4.3,
    time: '20-30 min',
  },
];

function RestaurantCard({ restaurant }: { restaurant: any }) {
  return (
    <div className="bg-white rounded-xl shadow-lg w-72 min-w-72 hover:scale-105 transition-transform cursor-pointer border border-orange-100">
      <div className="relative h-40 w-full rounded-t-xl overflow-hidden">
        <Image src={restaurant.image} alt={restaurant.name} fill className="object-cover" />
      </div>
      <div className="p-4">
        <h3 className="text-lg font-bold text-gray-900 mb-1">{restaurant.name}</h3>
        <div className="text-sm text-gray-600 mb-2">{restaurant.cuisine}</div>
        <div className="flex items-center text-sm text-gray-700 mb-1">
          <span className="mr-2">⭐ {restaurant.rating}</span>
          <span>• {restaurant.time}</span>
        </div>
        <Link href={`/restaurants/menu?id=${restaurant.id}`} passHref>
          <button className="mt-2 w-full bg-orange-600 text-white py-1.5 rounded-lg font-semibold hover:bg-orange-700 transition">View Menu</button>
        </Link>
      </div>
    </div>
  );
}

export default function Restaurants() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);

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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 justify-items-center">
            {popularRestaurants.map((r) => (
              <RestaurantCard key={r.name} restaurant={r} />
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">New Arrivals</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 justify-items-center">
            {newArrivals.map((r) => (
              <RestaurantCard key={r.name} restaurant={r} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}