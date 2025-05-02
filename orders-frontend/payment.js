const stripe = Stripe("pk_test_51RGtlJQOf01G8sOif95CdNAUsM65cbELzKrirY3ieB0TwqrD9ImUVB20cBhxfTmzxTMsY0YVCmiNbmR1W1Vw6pnr000uAe9FLB");
const elements = stripe.elements();
const cardElement = elements.create("card");
cardElement.mount("#card-element");

const API_BASE = "https://93x8qdh8rd.execute-api.us-east-1.amazonaws.com/payment";
const USER_ID = "54e83468-3021-7050-01e5-12a82c111031";

const submitButton = document.getElementById("submit-button");
const successEl = document.getElementById("success-message");
const errorEl = document.getElementById("error-message");
const savedCardSelect = document.getElementById("saved-card");
const cardUI = document.getElementById("card-element");
const itemsTextarea = document.getElementById("items");
const summaryEl = document.getElementById("order-summary");
const spinner = document.getElementById("loading-spinner");
const cardLabel = document.querySelector('label[for="saved-card"]:nth-of-type(2)');
const checkboxWrapper = document.getElementById("save-card-wrapper");


function updateTotal() {
  try {
    const items = JSON.parse(itemsTextarea.value);
    const total = items.reduce((sum, item) => sum + (item.price || 0), 0);
    summaryEl.textContent = `Total: $${total.toFixed(2)}`;
  } catch {
    summaryEl.textContent = "Total: Invalid item list";
  }
}

itemsTextarea.addEventListener("input", updateTotal);
updateTotal();

window.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch(`${API_BASE}/payment/users/${USER_ID}`);
    const { cards } = await res.json();
    cards.forEach(card => {
      const opt = document.createElement("option");
      opt.value = card.id;
      opt.textContent = `${card.brand.toUpperCase()} •••• ${card.last4} (exp ${card.exp_month}/${card.exp_year})`;
      savedCardSelect.appendChild(opt);
    });
    savedCardSelect.dispatchEvent(new Event("change"));
  } catch (e) {
    console.warn("Could not load saved cards:", e);
  }
});

savedCardSelect.addEventListener("change", () => {
  const useNewCard = !savedCardSelect.value;
  cardUI.style.display = useNewCard ? "block" : "none";
  cardLabel.style.display = useNewCard ? "block" : "none";
  checkboxWrapper.style.display = useNewCard ? "block" : "none";
});

submitButton.addEventListener("click", async () => {
  submitButton.disabled = true;
  successEl.classList.add("hidden");
  errorEl.classList.add("hidden");
  spinner.classList.add("show");

  try {
    const restaurantId = document.getElementById("restaurant-id").value.trim();
    const items = JSON.parse(itemsTextarea.value.trim());
    const totalAmount = items.reduce((sum, item) => sum + (item.price || 0), 0);
    const saveCard = document.getElementById("save-card").checked;
    const selectedPaymentMethod = savedCardSelect.value;

    if (!restaurantId || !items.length) {
      alert("Please fill all required fields.");
      return;
    }

    const res = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      body: JSON.stringify({
        customer_id: USER_ID,
        restaurant_id: restaurantId,
        items: items,
        amount: parseFloat(totalAmount.toFixed(2)),
        save_card: saveCard
      })
    });

    const data = await res.json();
    const clientSecret = data.clientSecret;

    if (!clientSecret) {
      errorEl.textContent = "Could not create payment intent.";
      errorEl.classList.remove("hidden");
      return;
    }

    let result;
    if (selectedPaymentMethod) {
      result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: selectedPaymentMethod
      });
    } else {
      result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: { name: "Test User" }
        },
        setup_future_usage: saveCard ? "off_session" : undefined
      });
    }

    if (result.error) {
      errorEl.textContent = result.error.message;
      errorEl.classList.remove("hidden");
    } else if (result.paymentIntent.status === "succeeded") {
      successEl.classList.remove("hidden");
    }
  } catch (err) {
    console.error("Payment error:", err);
    errorEl.textContent = "Something went wrong. Please try again.";
    errorEl.classList.remove("hidden");
  } finally {
    spinner.classList.remove("show");
    submitButton.disabled = false;
  }
});
