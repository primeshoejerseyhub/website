// ============================================
// PRIME SHOE JERSEY HUB — Checkout v4 (Fixed Flow)
// ============================================
// Flow: Address → Payment Instructions → Upload Screenshot → THEN Save Order → Success

import { db } from "./firebase.js";
import { uploadScreenshot } from "./cloudinary.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ---- CONFIG ----
const UPI_ID = "8210647493@kotak811";
const WA_NUMBER = "919239394022";

// Pending order data stored before screenshot upload
let _pendingOrderData = null;
let _pendingOrderMeta = null;

function fmt(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}

function generateOrderId() {
  return "PSJH-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(1000 + Math.random() * 9000);
}

// ---- RENDER ORDER SUMMARY ----
function renderSummary() {
  const items = window.loadCart ? window.loadCart() : JSON.parse(localStorage.getItem("psjh_cart_v2") || "[]");
  const list = document.getElementById("order-items-list");
  if (!list) return;

  if (!items.length) {
    list.innerHTML = `<div style="text-align:center;padding:20px;">
      <div style="font-size:2rem;margin-bottom:8px;">🛒</div>
      <p style="color:var(--silver);font-size:13px;">Your cart is empty</p>
      <a href="shop.html" class="btn btn-blue btn-sm" style="margin-top:10px;">Browse Products</a>
    </div>`;
    const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    safeSet("co-subtotal", "₹0");
    safeSet("co-total", "₹0");
    return;
  }

  list.innerHTML = items.map(item => `
    <div class="order-item">
      <img src="${item.image}" alt="${item.name}" class="order-item-img"
        onerror="this.src='https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100&q=60'"/>
      <div style="flex:1;min-width:0;">
        <div style="font-family:var(--font-cond);font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.name}</div>
        <div style="font-size:11px;color:var(--silver);margin-top:2px;">Size: ${item.size} · Qty: ${item.qty}</div>
        <div style="font-family:var(--font-display);font-size:1.1rem;color:var(--blue);margin-top:3px;">${fmt(item.price * item.qty)}</div>
      </div>
    </div>`).join("");

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = subtotal >= 999 ? 0 : 99;
  const total = subtotal + shipping;

  const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  safeSet("co-subtotal", fmt(subtotal));
  safeSet("co-shipping", shipping === 0 ? "FREE" : fmt(shipping));
  safeSet("co-total", fmt(total));
}

// ---- STEP 1→2: Show Payment Screen (DO NOT save order yet) ----
window.placeOrder = async function() {
  const name    = document.getElementById("co-name")?.value.trim();
  const phone   = document.getElementById("co-phone")?.value.trim();
  const address = document.getElementById("co-address")?.value.trim();
  const city    = document.getElementById("co-city")?.value.trim();
  const pin     = document.getElementById("co-pin")?.value.trim();
  const state   = document.getElementById("co-state")?.value.trim();

  const toast = window.showToast || function(){};

  if (!name)              { toast("Please enter your full name", "error"); document.getElementById("co-name")?.focus(); return; }
  if (!phone || phone.replace(/\D/g, "").length < 10) { toast("Please enter a valid phone number", "error"); document.getElementById("co-phone")?.focus(); return; }
  if (!address)           { toast("Please enter your address", "error"); document.getElementById("co-address")?.focus(); return; }
  if (!city)              { toast("Please enter your city", "error"); return; }
  if (!pin || pin.length < 6) { toast("Please enter a valid 6-digit PIN code", "error"); return; }

  const items = window.loadCart ? window.loadCart() : JSON.parse(localStorage.getItem("psjh_cart_v2") || "[]");
  if (!items.length) { toast("Your cart is empty!", "error"); return; }

  const btn = document.getElementById("place-order-btn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span style="display:inline-block;width:16px;height:16px;border:2px solid rgba(0,0,0,0.25);border-top-color:var(--dark);border-radius:50%;animation:spin 0.7s linear infinite;"></span> Processing...`;
  }

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = subtotal >= 999 ? 0 : 99;
  const total    = subtotal + shipping;
  const orderId  = generateOrderId();

  // Store pending order data — will be saved AFTER screenshot upload
  _pendingOrderData = {
    orderId,
    name,
    phone,
    address: `${address}, ${city}${state ? ", " + state : ""} - ${pin}`,
    items: items.map(i => ({ name: i.name, size: i.size, qty: i.qty, price: i.price })),
    amount: total,
    screenshot: null,
    status: "Paid",
    createdAt: serverTimestamp()
  };
  _pendingOrderMeta = { orderId, name, total };

  // Show payment instructions screen
  showPaymentScreen({ orderId, name, total });

  // Re-enable button
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> Place Order →`;
  }
};

function showPaymentScreen({ orderId, name, total }) {
  const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const safeHref = (id, val) => { const el = document.getElementById(id); if (el) el.href = val; };

  safeSet("s-order-id", orderId);
  safeSet("s-name", name);
  safeSet("s-amount", fmt(total));
  safeSet("pi-amount", fmt(total));
  safeSet("pi-order-id", orderId);

  const upiDisplay = document.getElementById("upi-id-display");
  if (upiDisplay) upiDisplay.textContent = UPI_ID;

  safeHref("track-btn", `tracking.html?id=${orderId}`);

  const waMsg = encodeURIComponent(
    `Hi, I placed an order on Prime Shoe Jersey Hub.\n\nOrder ID: ${orderId}\nName: ${name}\nAmount: ${fmt(total)}\n\nI am sending my payment screenshot.`
  );
  safeHref("whatsapp-btn", `https://wa.me/${WA_NUMBER}?text=${waMsg}`);

  // Step indicators
  document.querySelectorAll(".csi-step").forEach(s => s.classList.remove("active"));
  document.getElementById("csi-1")?.classList.add("done");
  document.getElementById("csi-2")?.classList.add("active");

  // Switch screens
  const formSection = document.getElementById("checkout-form-section");
  const paymentScreen = document.getElementById("payment-screen");
  if (formSection) formSection.style.display = "none";
  if (paymentScreen) paymentScreen.classList.add("visible");

  localStorage.setItem('psjh_last_order', orderId);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---- STEP 3: Upload Screenshot & STEP 4: Save Order ----
window.uploadAndConfirmOrder = async function() {
  const fileInput = document.getElementById("screenshot-file-input");
  const statusEl = document.getElementById("screenshot-status");
  const btn = document.getElementById("screenshot-upload-btn");

  if (!fileInput?.files?.length) {
    if (window.showToast) showToast("Please select your payment screenshot first.", "error");
    return;
  }

  if (!_pendingOrderData) {
    if (window.showToast) showToast("Order data lost. Please refresh and try again.", "error");
    return;
  }

  btn.disabled = true;
  btn.textContent = "⏳ Uploading...";
  if (statusEl) { statusEl.textContent = "Uploading screenshot..."; statusEl.style.color = "var(--silver)"; }

  try {
    // Upload screenshot first
    const screenshotUrl = await uploadScreenshot(fileInput.files[0]);
    if (statusEl) statusEl.textContent = "✓ Screenshot uploaded. Saving order...";

    // Now save order to Firestore WITH screenshot
    _pendingOrderData.screenshot = screenshotUrl;
    const ref = await addDoc(collection(db, "orders"), _pendingOrderData);
    console.log("[Checkout] Order saved to Firestore:", ref.id, _pendingOrderData.orderId);

    // Clear cart
    if (window.cartClear) window.cartClear();

    // Show final success screen
    showSuccessScreen(_pendingOrderMeta);

    if (window.showToast) showToast("Order Placed Successfully! ✓");

  } catch (err) {
    console.error("[Checkout] Upload/save error:", err);
    if (statusEl) { statusEl.textContent = "Upload failed. Try again or use WhatsApp."; statusEl.style.color = "var(--red, #f87171)"; }
    btn.disabled = false;
    btn.textContent = "☁️ Try Again";
  }
};

function showSuccessScreen({ orderId, name, total }) {
  const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  safeSet("success-order-id", orderId);
  safeSet("success-name", name);
  safeSet("success-amount", fmt(total));

  const trackBtn = document.getElementById("success-track-btn");
  if (trackBtn) trackBtn.href = `tracking.html?id=${orderId}`;

  // Step indicators
  document.querySelectorAll(".csi-step").forEach(s => { s.classList.remove("active"); s.classList.add("done"); });
  document.getElementById("csi-3")?.classList.remove("done");
  document.getElementById("csi-3")?.classList.add("active");

  const paymentScreen = document.getElementById("payment-screen");
  const successScreen = document.getElementById("success-screen");
  if (paymentScreen) paymentScreen.classList.remove("visible");
  if (successScreen) successScreen.classList.add("visible");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---- COPY UPI ----
window.copyUPI = function() {
  navigator.clipboard.writeText(UPI_ID)
    .then(() => { if (window.showToast) showToast("UPI ID copied to clipboard! ✓"); })
    .catch(() => { if (window.showToast) showToast(UPI_ID, "success"); });
};

// Preview screenshot file
document.addEventListener("DOMContentLoaded", () => {
  renderSummary();

  document.getElementById("screenshot-file-input")?.addEventListener("change", function() {
    const file = this.files[0];
    if (!file) return;
    const previewWrap = document.getElementById("screenshot-preview-wrap");
    const previewImg = document.getElementById("screenshot-preview-img");
    if (previewWrap && previewImg) {
      previewImg.src = URL.createObjectURL(file);
      previewWrap.style.display = "block";
    }
    // Update button text
    const btn = document.getElementById("screenshot-upload-btn");
    if (btn) btn.textContent = "✅ Upload & Confirm Order";
  });
});

// Spinner keyframe
const spinStyle = document.createElement("style");
spinStyle.textContent = "@keyframes spin{to{transform:rotate(360deg)}}";
document.head.appendChild(spinStyle);
