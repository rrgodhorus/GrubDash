"use client";

import { useAuth } from "react-oidc-context";
import LoginButton from "./LoginButton";
import Link from 'next/link';

export default function Navbar() {
  const auth = useAuth();
  const name = auth.user?.profile.name;
  // const role = auth.user?.profile["custom:user_role"];

  return (
    <header className="flex justify-between items-center px-4 py-4 bg-white shadow-md w-full fixed top-0 left-0">
      <Link href="/" className="text-2xl font-bold text-orange-600">GrubDash</Link>
      <nav className="flex space-x-4">
        <Link href="/restaurants" className="text-gray-700 hover:text-orange-600">Restaurants</Link>
        <a href="#" className="text-gray-700 hover:text-orange-600">Deals</a>
        <a href="#" className="text-gray-700 hover:text-orange-600">About Us</a>
        <a href="#" className="text-gray-700 hover:text-orange-600">Help</a>
      </nav>
      <div className="flex items-center space-x-4">
        <button className="text-gray-700 hover:text-orange-600">Cart</button>
        <span className="self-center text-orange-600 font-semibold text-base">{name}</span>
        <LoginButton />
      </div>
    </header>
  );
}