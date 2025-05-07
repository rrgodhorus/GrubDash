"use client";

import { useAuth } from "react-oidc-context";
import LoginButton from "./LoginButton";
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const auth = useAuth();
  const name = auth.user?.profile.name;
  const role = auth.user?.profile["custom:user_role"];
  const userId = auth.user?.profile.sub;
  const [userDetails, setUserDetails] = useState(null);
  
  useEffect(() => {
    const fetchUserDetails = async () => {
      if (auth.isAuthenticated && userId) {
        try {
          // Check if we already have user details in localStorage
          const storedUser = localStorage.getItem(`user_details`);
          
          if (storedUser) {
            setUserDetails(JSON.parse(storedUser));
          } else {
            // Fetch user details from API
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/users/${userId}`);
            
            if (response.ok) {
              const userData = await response.json();
              // Store in localStorage
              localStorage.setItem(`user_details`, JSON.stringify(userData));
              setUserDetails(userData);
              console.log('User details fetched and stored:', userData);
            } else {
              console.error('Failed to fetch user details:', response.statusText);
            }
          }
        } catch (error) {
          console.error('Error fetching user details:', error);
        }
      }
    };

    fetchUserDetails();
  }, [auth.isAuthenticated, userId]);

  // Create a function to clear user data on logout
  useEffect(() => {
    if (!auth.isAuthenticated && userId) {
      // User has logged out, we can perform cleanup if needed
      console.log('User logged out, cleaning up user data');
    }
  }, [auth.isAuthenticated, userId]);

  return (
    <header className="flex justify-between items-center px-4 py-4 bg-white shadow-md w-full fixed top-0 left-0">
      <Link href="/" className="text-2xl font-bold text-orange-600">GrubDash</Link>
      <nav className="flex space-x-4">
        {auth.isAuthenticated && (role == "customer") && <Link href="/restaurants" className="text-gray-700 hover:text-orange-600">Restaurants</Link>}
        {auth.isAuthenticated && (role == "restaurant") && <Link href="/orders" className="text-gray-700 hover:text-orange-600">Orders</Link>}
        {/* <a href="#" className="text-gray-700 hover:text-orange-600">Deals</a> */}
        {/* <a href="#" className="text-gray-700 hover:text-orange-600">About Us</a> */}
        {/* <a href="#" className="text-gray-700 hover:text-orange-600">Help</a> */}
      </nav>
      <div className="flex items-center space-x-4">
        {auth.isAuthenticated && (
          <div className="flex items-center">
            <span className="self-center text-orange-600 font-semibold text-base">{name}</span>
            {userDetails && (
              <span className="ml-2 text-xs text-gray-500">
                {/* You can display additional user details here if needed */}
              </span>
            )}
          </div>
        )}
        <LoginButton />
      </div>
    </header>
  );
}