import LoginButton from "./LoginButton";
import Link from 'next/link';

export default function Navbar() {
  return (
    <header className="flex justify-between items-center px-4 py-4 bg-white shadow-md w-full fixed top-0 left-0">
      <h1 className="text-2xl font-bold text-orange-600">GrubDash</h1>
      <nav className="flex space-x-4">
        <Link href="/restaurants" className="text-gray-700 hover:text-orange-600">Restaurants</Link>
        <a href="#" className="text-gray-700 hover:text-orange-600">Deals</a>
        <a href="#" className="text-gray-700 hover:text-orange-600">About Us</a>
        <a href="#" className="text-gray-700 hover:text-orange-600">Help</a>
      </nav>
      <div className="flex space-x-4">
        <button className="text-gray-700 hover:text-orange-600">Cart</button>
        <LoginButton />
      </div>
    </header>
  );
}