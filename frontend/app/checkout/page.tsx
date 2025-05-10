"use client";
import React, { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from "@stripe/react-stripe-js";
import { useAuth } from "react-oidc-context";
import { useRouter } from "next/navigation";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

export default function CheckoutPage() {
  return (
    <main className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Checkout</h1>
      <Elements stripe={stripePromise}>
        <CheckoutForm />
      </Elements>
    </main>
  );
}

/*
<!-- 
✅ Stripe Test Card Numbers (Use in test mode only)

🟢 Successful Payments:
- Visa:              4242 4242 4242 4242
- MasterCard:        5555 5555 5555 4444
- American Express:  3782 822463 10005  (4-digit CVC)
- Discover:          6011 1111 1111 1117
- Visa Debit:        4000 0000 0000 0077

🔴 Failed Payments:
- Insufficient Funds:     4000 0000 0000 0341
- Generic Decline:        4000 0000 0000 0002
- Incorrect CVC:          4000 0000 0000 0101
- Processing Error:       4000 0000 0000 0119

💡 Use any future expiry (e.g., 12/29) and any CVC (e.g., 123 or 1234 for Amex)
-->
*/

// Define interfaces for better type safety
interface CartItem {
  name: string;
  id: string;
  quantity: number;
  price: string;
}

interface OrderItem {
  name: string;
  id: string;
  quantity: number;
  unit_price: number;
}

interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  exp_month: string;
  exp_year: string;
}

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const auth = useAuth();
  const router = useRouter();
  const userProfile = auth.user?.profile;
  const userId = userProfile?.["cognito:username"];
  const userRole = userProfile?.["custom:user_role"];

  const [items, setItems] = useState<OrderItem[]>([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedCard, setSelectedCard] = useState("");
  const [saveCard, setSaveCard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  // Add new state for locations
  const [deliveryLocation, setDeliveryLocation] = useState<{lat: number, lng: number} | null>(null);
  const [restaurantLocation, setRestaurantLocation] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    const cartRaw = localStorage.getItem("cart");
    if (cartRaw) {
      const cart = JSON.parse(cartRaw);
      const parsedItems = Object.values(cart.items || {}).map((item: unknown) => {
        // Cast the unknown item to CartItem with type assertion
        const cartItem = item as CartItem;
        return {
          name: cartItem.name,
          id: cartItem.id,
          quantity: cartItem.quantity,
          unit_price: parseFloat(cartItem.price.replace("$", "")) || 0
        };
      });
      setItems(parsedItems);
      setRestaurantId(cart.restaurantId);
      
      // Get delivery location from localStorage if available
      const locationRaw = localStorage.getItem("deliveryLocation");
      if (locationRaw) {
        try {
          const location = JSON.parse(locationRaw);
          setDeliveryLocation(location);
        } catch (e) {
          console.error("Failed to parse delivery location:", e);
        }
      }
      
      // Use restaurant location from cart if available
      if (cart.restaurantLocation) {
        try {
          // Parse location coordinates from the stored string (format: "lat, lng")
          const [lat, lng] = cart.restaurantLocation.split(',').map((coord: string) => parseFloat(coord.trim()));
          if (!isNaN(lat) && !isNaN(lng)) {
            setRestaurantLocation({ lat, lng });
          }
        } catch (e) {
          console.error("Failed to parse restaurant location from cart:", e);
        }
      } 
      // Fallback: Fetch restaurant location if not available in cart
      else if (cart.restaurantId) {
        fetch(`${API_BASE}/users/${cart.restaurantId}`)
          .then(res => res.json())
          .then(data => {
            if (data.location_coordinates) {
              setRestaurantLocation({
                lat: parseFloat(data.location_coordinates.latitude),
                lng: parseFloat(data.location_coordinates.longitude)
              });
            }
          })
          .catch(err => {
            console.error("Failed to fetch restaurant location:", err);
          });
      }
    }

    if (userId) {
      fetch(`${API_BASE}/payment/users/${userId}`)
        .then((res) => res.json())
        .then((data) => setSavedCards(data.cards || []))
        .catch(console.error);
    }
  }, [userId]);

  // Redirect to order tracking page if payment was successful
  useEffect(() => {
    if (success && orderId) {
      // Give a small delay so user can see the success message
      const redirectTimer = setTimeout(() => {
        router.push(`/tracking?id=${orderId}`);
      }, 1500);
      
      return () => clearTimeout(redirectTimer);
    }
  }, [success, orderId, router]);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;

    if (userRole !== "customer") {
      alert("Only customers can place orders.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        body: JSON.stringify({
          customer_id: userId,
          restaurant_id: restaurantId,
          items,
          save_card: saveCard,
          // Add location data to the order
          delivery_location: deliveryLocation ? {
            latitude: deliveryLocation.lat,
            longitude: deliveryLocation.lng
          } : null,
          restaurant_location: restaurantLocation ? {
            latitude: restaurantLocation.lat,
            longitude: restaurantLocation.lng
          } : null
        })
      });

      const { clientSecret, order_id } = await res.json();
      setOrderId(order_id); // Store the order ID for redirection

      const cardElement = elements.getElement(CardElement);
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: selectedCard || {
          card: cardElement!,
          billing_details: { name: userProfile?.name || "Customer" }
        },
        setup_future_usage: saveCard ? "off_session" : undefined
      });

      if (result.error) {
        setError(result.error.message || "Payment failed");
      } else if (result.paymentIntent.status === "succeeded") {
        setSuccess(true);
        localStorage.removeItem("cart");
      }
    } catch (error) {
      console.error("Payment error:", error);
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const total = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  return (
    <div className="relative space-y-6">
      {loading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm rounded">
          <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-orange-400 border-t-transparent" />
          <span className="mt-2 text-sm text-orange-600 font-medium">Processing...</span>
        </div>
      )}

      <div className="border rounded p-4 bg-white shadow">
        <h2 className="text-lg font-bold mb-3">Order Summary</h2>
        <ul className="text-sm text-gray-700 space-y-2">
          {items.map((item, idx) => (
            <li key={idx} className="flex justify-between">
              <span>{item.name} x {item.quantity}</span>
              <span>${(item.unit_price * item.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <div className="pt-3 mt-3 border-t font-semibold flex justify-between text-lg">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>

      {savedCards.length > 0 && (
        <select
          value={selectedCard}
          onChange={(e) => setSelectedCard(e.target.value)}
          className="w-full border rounded p-2"
        >
          <option value="">-- Use new card --</option>
          {savedCards.map((card) => (
            <option key={card.id} value={card.id}>
              {`${card.brand.toUpperCase()} •••• ${card.last4} (exp ${card.exp_month}/${card.exp_year})`}
            </option>
          ))}
        </select>
      )}

      {!selectedCard && (
        <>
          <label className="block text-sm font-medium">Card Details</label>
          <div className="border p-2 rounded">
            <CardElement onChange={(e) => setError(e.error?.message || "")} />
          </div>
          <label className="flex items-center space-x-2 mt-2">
            <input
              type="checkbox"
              checked={saveCard}
              onChange={(e) => setSaveCard(e.target.checked)}
            />
            <span>Save card for future use</span>
          </label>
        </>
      )}

      <button
        className={`w-full py-2 rounded text-white font-semibold ${loading ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"}`}
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? "Processing..." : "Pay Now"}
      </button>

      {error && <div className="text-red-600 text-sm">{error}</div>}
      {success && <div className="text-green-600 text-sm">✅ Payment successful!</div>}
    </div>
  );
}
