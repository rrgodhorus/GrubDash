"use client";

import { useAuth } from 'react-oidc-context';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import "./globals.css";

export default function Home() {
  const auth = useAuth();
  const router = useRouter();

  // useEffect(() => {
  //   if (auth.isAuthenticated) {
  //     router.push('/restaurants');
  //   }
  // }, [auth.isAuthenticated, router]);

  return (
    <main className="bg-orange-50 min-h-screen px-4 md:px-16">
      <section className="flex flex-col md:flex-row items-center justify-between px-8 py-16 bg-white shadow-md rounded-lg mt-8 max-w-5xl mx-auto">
        <div className="max-w-lg">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Delicious Food <span className="text-orange-600">Delivered</span> To Your Door</h2>
          <p className="text-gray-700 mb-6">Order from your favorite restaurants and track your delivery in real-time.</p>
          <div className="bg-gray-50 p-4 rounded-lg shadow-md">
            <div className="flex space-x-4 mb-4">
              <button className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">Delivery</button>
              <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Pickup</button>
            </div>
            <input type="text" placeholder="Enter your delivery address" className="w-full px-4 py-2 border rounded mb-4" />
            <button className="w-full bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700">Find Food →</button>
          </div>
        </div>
        <div className="hidden md:block bg-gray-200 w-96 h-96 rounded-lg shadow-inner overflow-hidden">
          <img src="/grubdash-image-1.png" alt="Delicious food" className="w-full h-full object-cover" />
        </div>
      </section>
    </main>
  );
}
