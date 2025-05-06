"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from 'react-oidc-context';

// Define types for menu items and cart
interface MenuItem {
  id: string;
  category: string;
  name: string;
  price: string;
  description: string;
  image: string;
}

interface CartItem extends MenuItem {
  quantity: number;
}

interface Cart {
  [key: string]: CartItem;
}

interface CartData {
  items: Cart;
  restaurantId: string;
}

interface Restaurant {
  name: string;
  location: string;
  rating: number;
  address: string;
  deliveryTime: string;
  pickupDistance: string;
  pickupTime: string;
  menu: MenuItem[];
}

// API response interfaces
interface ApiMenuItem {
  name: string;
  description: string;
  category: string;
  item_id: string;
  image_url: string;
  price: string;
}

interface ApiRestaurant {
  userId: string;
  name: string;
  email: string;
  address?: string;
  location_coordinates?: {
    latitude: string;
    longitude: string;
  };
  createdAt?: string;
  menu?: ApiMenuItem[];
}

// API Gateway configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://93x8qdh8rd.execute-api.us-east-1.amazonaws.com/Dev';

// Service for API calls
const restaurantService = {
  async getRestaurantById(restaurantId: string): Promise<Restaurant | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${restaurantId}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching restaurant: ${response.statusText}`);
      }
      
      const data: ApiRestaurant = await response.json();
      
      // Transform API menu items to our MenuItem type
      const transformedMenu: MenuItem[] = data.menu 
        ? data.menu.map(item => ({
            id: item.item_id,
            category: item.category,
            name: item.name,
            price: `$${item.price}`, // Add $ symbol if not present
            description: item.description,
            image: item.image_url || '/sample-image-1.jpg',
          }))
        : [];
      
      // Transform API data to our Restaurant type
      return {
        name: data.name || 'Unknown Restaurant',
        location: data.location_coordinates 
          ? `${data.location_coordinates.latitude}, ${data.location_coordinates.longitude}`
          : 'Unknown Location',
        rating: 4.0, // Default as rating isn't in the API response
        address: data.address || 'Address not available',
        deliveryTime: '30-45 min', // Default as not in API response
        pickupDistance: '0.5 mi', // Default as not in API response
        pickupTime: '10-15 min', // Default as not in API response
        menu: transformedMenu,
      };
    } catch (error) {
      console.error('Failed to fetch restaurant:', error);
      return null;
    }
  }
};

// Fallback sample data in case the API is not available
const sampleMenus: { [key: string]: Restaurant } = {
  "r1": {
    name: 'Italian Bistro',
    location: 'Downtown',
    rating: 4.5,
    address: '123 Main St',
    deliveryTime: '30-40 min',
    pickupDistance: '0.5 mi',
    pickupTime: '10-15 min',
    menu: [
      { id: 'm1', category: 'Pizza', name: 'Margherita Pizza', price: '$12.99', description: 'Classic cheese and tomato pizza with fresh basil.', image: '/sample-image-1.jpg' },
      { id: 'm2', category: 'Pasta', name: 'Spaghetti Carbonara', price: '$14.99', description: 'Creamy pasta with pancetta, egg, and Parmesan cheese.', image: '/sample-image-2.jpg' },
      { id: 'm3', category: 'Sides', name: 'Garlic Bread', price: '$5.99', description: 'Toasted bread with garlic butter and herbs.', image: '/sample-image-3.png' },
      { id: 'm4', category: 'Salads', name: 'Caesar Salad', price: '$9.99', description: 'Crisp romaine lettuce with Caesar dressing and croutons.', image: '/sample-image-1.jpg' },
      { id: 'm5', category: 'Desserts', name: 'Tiramisu', price: '$6.99', description: 'Classic Italian dessert with layers of coffee-soaked ladyfingers and mascarpone cream.', image: '/sample-image-2.jpg' },
    ],
  },
  "r2": {
    name: 'Pizza Palace',
    location: 'Uptown',
    rating: 4.2,
    address: '456 Elm St',
    deliveryTime: '25-35 min',
    pickupDistance: '0.8 mi',
    pickupTime: '15-20 min',
    menu: [
      { id: 'm6', category: 'Pizza', name: 'Pepperoni Pizza', price: '$13.99', description: 'Pizza topped with pepperoni and mozzarella cheese.', image: '/sample-image-1.jpg' },
      { id: 'm7', category: 'Pasta', name: 'Lasagna', price: '$15.99', description: 'Layered pasta with meat sauce, ricotta, and mozzarella.', image: '/sample-image-2.jpg' },
      { id: 'm8', category: 'Sides', name: 'Chicken Wings', price: '$10.99', description: 'Crispy chicken wings served with your choice of sauce.', image: '/sample-image-3.png' },
      { id: 'm9', category: 'Sides', name: 'Garlic Knots', price: '$4.99', description: 'Soft dough knots brushed with garlic butter and herbs.', image: '/sample-image-1.jpg' },
      { id: 'm10', category: 'Desserts', name: 'Chocolate Cake', price: '$7.99', description: 'Rich and moist chocolate cake with a creamy frosting.', image: '/sample-image-2.jpg' },
    ],
  },
  "r3": {
    name: 'Burger Barn',
    location: 'Midtown',
    rating: 4.7,
    address: '789 Oak St',
    deliveryTime: '20-30 min',
    pickupDistance: '0.3 mi',
    pickupTime: '5-10 min',
    menu: [
      { id: 'm11', category: 'Burgers', name: 'Cheeseburger', price: '$10.99', description: 'Juicy beef patty with cheese, lettuce, and tomato.', image: '/sample-image-1.jpg' },
      { id: 'm12', category: 'Sides', name: 'Fries', price: '$4.99', description: 'Crispy golden fries with a side of ketchup.', image: '/sample-image-2.jpg' },
      { id: 'm13', category: 'Drinks', name: 'Milkshake', price: '$6.99', description: 'Creamy milkshake available in chocolate, vanilla, or strawberry.', image: '/sample-image-3.png' },
      { id: 'm14', category: 'Sandwiches', name: 'Chicken Sandwich', price: '$9.99', description: 'Grilled chicken breast with lettuce, tomato, and mayo.', image: '/sample-image-1.jpg' },
      { id: 'm15', category: 'Sides', name: 'Onion Rings', price: '$5.99', description: 'Crispy fried onion rings served with a tangy dipping sauce.', image: '/sample-image-2.jpg' },
    ],
  },
};

// Create a client component that uses search params
function MenuContent() {
  const router = useRouter();
  const auth = useAuth();
  const searchParams = useSearchParams();
  const restaurantId = searchParams.get('id') || '';
  const [restaurantData, setRestaurantData] = useState<Restaurant | null>(null);
  const menu = restaurantData?.menu || [];

  const [cart, setCart] = useState<Cart>({});
  const [isHydrated, setIsHydrated] = useState(false);
  const [storedRestaurantId, setStoredRestaurantId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);

  // Calculate cart totals
  const cartItems = Object.values(cart);
  const cartItemCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cartItems.reduce((total, item) => {
    const price = parseFloat(item.price.replace('$', ''));
    return total + price * item.quantity;
  }, 0).toFixed(2);

  // Fetch restaurant data
  useEffect(() => {
    async function fetchRestaurant() {
      const data = await restaurantService.getRestaurantById(restaurantId);
      setRestaurantData(data || sampleMenus[restaurantId]);
    }

    if (restaurantId) {
      fetchRestaurant();
    }
  }, [restaurantId]);

  // Handle initial hydration - load cart from localStorage only on client side
  useEffect(() => {
    // Only run once on client side
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cart');
      if (stored) {
        try {
          const cartData: CartData = JSON.parse(stored);
          setCart(cartData.items);
          setStoredRestaurantId(cartData.restaurantId);
        } catch (err) {
          console.error('Failed to parse cart', err);
        }
      }
      setIsHydrated(true);
    }
  }, []);

  // Listen for authentication changes
  useEffect(() => {
    // Clear cart on sign out
    if (!auth.isAuthenticated && isHydrated) {
      localStorage.removeItem('cart');
      setCart({});
      setStoredRestaurantId(null);
    }
  }, [auth.isAuthenticated, isHydrated]);

  // Debounced save to localStorage - only when cart changes and after hydration
  useEffect(() => {
    if (!isHydrated || Object.keys(cart).length === 0) {
      return;
    }

    const timeout = setTimeout(() => {
      // Save both cart items and restaurant ID
      // Use the storedRestaurantId if it exists, otherwise use the current restaurantId
      // This ensures we don't change the restaurantId when just visiting a different restaurant
      const cartData: CartData = {
        items: cart,
        restaurantId: storedRestaurantId || restaurantId || '',
      };
      localStorage.setItem('cart', JSON.stringify(cartData));
    }, 100); // debounce delay

    return () => clearTimeout(timeout); // clear on re-render
  }, [cart, isHydrated, restaurantId, storedRestaurantId]);

  const handleAddToCart = (item: MenuItem) => {
    // Check if user is trying to add items from a different restaurant
    if (storedRestaurantId && storedRestaurantId !== restaurantId && Object.keys(cart).length > 0) {
      // Store the pending item and show confirmation dialog
      setPendingItem(item);
      setShowConfirmDialog(true);
      return;
    }

    // Proceed with adding item to cart
    addItemToCart(item);
  };

  const addItemToCart = (item: MenuItem) => {
    setCart((prevCart) => {
      // Create a new cart object
      const newCart = { ...prevCart };
      const currentItem = newCart[item.id];

      // If item exists, increment by exactly 1, otherwise add with quantity 1
      if (currentItem) {
        newCart[item.id] = {
          ...currentItem,
          quantity: currentItem.quantity + 1,
        };
      } else {
        newCart[item.id] = { ...item, quantity: 1 };
      }

      return newCart;
    });

    // Update stored restaurant ID if this is the first item
    if (Object.keys(cart).length === 0 && !storedRestaurantId) {
      setStoredRestaurantId(restaurantId);
    }
  };

  const handleConfirmNewCart = () => {
    // Clear the cart
    setCart({});
    
    // Update the stored restaurant ID to the current restaurant
    setStoredRestaurantId(restaurantId);

    // Add the pending item to the new cart
    if (pendingItem) {
      addItemToCart(pendingItem);
    }

    // Reset state
    setShowConfirmDialog(false);
    setPendingItem(null);
  };

  const handleCancelNewCart = () => {
    // Just close the dialog without changing the cart
    setShowConfirmDialog(false);
    setPendingItem(null);
  };

  const handleRemoveFromCart = (item: MenuItem) => {
    setCart((prevCart) => {
      // Create a new cart object
      const newCart = { ...prevCart };
      const currentItem = newCart[item.id];

      // Only process if item exists
      if (currentItem) {
        if (currentItem.quantity > 1) {
          // Decrement by exactly 1
          newCart[item.id] = {
            ...currentItem,
            quantity: currentItem.quantity - 1,
          };
        } else {
          // Remove item if quantity would become 0
          delete newCart[item.id];
        }
      }

      return newCart;
    });
  };

  const groupedMenu = menu.reduce<Record<string, MenuItem[]>>((acc: Record<string, MenuItem[]>, item: MenuItem) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <main className="bg-gray-50 min-h-screen">
      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-xl font-bold mb-4">Your cart contains items from a different restaurant</h3>
            <p className="mb-6">
              Would you like to clear your current cart and start a new order from {restaurantData?.name}?
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={handleCancelNewCart}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmNewCart}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                Clear Cart & Add New Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Summary Modal */}
      {showCartModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Your Order</h3>
              <button
                onClick={() => setShowCartModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                &times;
              </button>
            </div>

            {cartItems.length > 0 ? (
              <>
                <div className="divide-y">
                  {cartItems.map((item) => (
                    <div key={item.id} className="py-3 flex justify-between items-center">
                      <div>
                        <span className="font-medium">{item.quantity} x </span>
                        <span>{item.name}</span>
                      </div>
                      <span className="font-semibold">
                        ${(parseFloat(item.price.replace('$', '')) * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>${cartTotal}</span>
                  </div>
                </div>

                <button
                  className="mt-6 w-full bg-orange-500 text-white py-3 rounded-lg font-bold hover:bg-orange-600"
                  onClick={() => router.push('/checkout')}
                >
                  Proceed to Checkout
                </button>
              </>
            ) : (
              <p className="py-4 text-center text-gray-500">Your cart is empty</p>
            )}
          </div>
        </div>
      )}

      {/* Back Navigation */}
      <div className="sticky top-0 z-30 bg-white shadow-md">
        <div className="container mx-auto px-4 py-3 flex items-center">
          <button
            onClick={() => router.push('/restaurants')}
            className="flex items-center text-orange-500 hover:text-orange-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>
        </div>
      </div>

      {/* Restaurant Banner */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-400 text-white py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold">{restaurantData?.name || 'Restaurant'}</h1>
          <div className="flex items-center mt-2">
            <span className="flex items-center mr-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
              {restaurantData?.rating}
            </span>
            <span className="mr-3">•</span>
            <span>{restaurantData?.address}</span>
          </div>
          <div className="flex items-center mt-2 text-sm">
            <span className="mr-4">
              <span className="font-semibold">Delivery:</span> {restaurantData?.deliveryTime}
            </span>
            <span className="mr-4">
              <span className="font-semibold">Pickup:</span> {restaurantData?.pickupDistance}
            </span>
            <span>
              <span className="font-semibold">Ready in:</span> {restaurantData?.pickupTime}
            </span>
          </div>
        </div>
      </div>

      {/* Menu Categories and Items */}
      <div className="container mx-auto px-4 py-6">
        {Object.entries(groupedMenu).map(([category, items]) => (
          <div key={category} className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b pb-2">{category}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((item: MenuItem) => (
                <div
                  key={item.id}
                  className="bg-white rounded-lg shadow-md p-4 border border-gray-100 flex hover:shadow-lg transition-shadow"
                >
                  <div className="flex-1 pr-3">
                    <h3 className="text-lg font-bold text-gray-900">{item.name}</h3>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{item.description}</p>
                    <div className="text-lg font-semibold text-orange-600">{item.price}</div>
                  </div>
                  <div className="flex flex-col items-end">
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={80}
                      height={80}
                      className="object-cover rounded-lg mb-2"
                    />
                    {cart[item.id] && storedRestaurantId === restaurantId ? (
                      <div className="flex items-center border border-gray-200 rounded-md">
                        <button
                          className="px-2 py-1 text-orange-500 hover:text-orange-600"
                          onClick={() => handleRemoveFromCart(item)}
                          aria-label={`Remove one ${item.name} from cart`}
                        >
                          -
                        </button>
                        <span className="px-2 font-medium">{cart[item.id].quantity}</span>
                        <button
                          className="px-2 py-1 text-orange-500 hover:text-orange-600"
                          onClick={() => handleAddToCart(item)}
                          aria-label={`Add one more ${item.name} to cart`}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        className="bg-orange-500 text-white rounded-md px-3 py-1 flex items-center hover:bg-orange-600"
                        onClick={() => handleAddToCart(item)}
                        aria-label={`Add ${item.name} to cart`}
                      >
                        Add
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Floating Cart Button */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-6 inset-x-0 flex justify-center z-40">
          <button
            onClick={() => setShowCartModal(true)}
            className="bg-orange-500 text-white rounded-full py-3 px-6 shadow-lg flex items-center space-x-2 hover:bg-orange-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span className="font-bold">{cartItemCount} items</span>
            <span>•</span>
            <span className="font-bold">${cartTotal}</span>
          </button>
        </div>
      )}
    </main>
  );
}

// Main page component with Suspense boundary
export default function MenuPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    }>
      <MenuContent />
    </Suspense>
  );
}