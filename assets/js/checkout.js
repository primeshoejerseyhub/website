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
const STORE_NAME = "Prime Shoe Jersey Hub";
const WA_NUMBER = "919239394022";

// Pending order data stored before screenshot upload
let _pendingOrderData = null;
let _pendingOrderMeta = null;

// ---- COUPON STATE ----
let _appliedCoupon = null; // { code, discountType, value } or null

function fmt(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
}

// ---- FEATURE: WhatsApp Auto-message ----
function buildWhatsAppMessage(orderData) {
  const { orderId, name, phone, address, items, amount } = orderData;
  const itemLines = items.map(i =>
    `  • ${i.name} | Size: ${i.size} | Qty: ${i.qty} | ${fmt(i.price * i.qty)}`
  ).join("\n");
  return encodeURIComponent(
    `🛍️ *NEW ORDER — Prime Shoe Jersey Hub*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 *Order ID:* ${orderId}\n` +
    `👤 *Name:* ${name}\n` +
    `📱 *Phone:* ${phone}\n` +
    `📍 *Address:* ${address}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🛒 *Items Ordered:*\n${itemLines}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 *Total Paid:* ${fmt(amount)}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ Payment screenshot uploaded. Please confirm & process.`
  );
}

function autoOpenWhatsApp(orderData) {
  const msg = buildWhatsAppMessage(orderData);
  const url = `https://wa.me/${WA_NUMBER}?text=${msg}`;
  // Small delay so success screen renders first
  setTimeout(() => { window.open(url, "_blank"); }, 1200);
}

function generateOrderId() {
  return "PSJH-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(1000 + Math.random() * 9000);
}

// ---- NEW: Generate UPI Deep Link ----
function generateUpiLink(amount, orderId) {
  const note = encodeURIComponent("Order ID: " + orderId);
  const name = encodeURIComponent(STORE_NAME);
  return `upi://pay?pa=${UPI_ID}&pn=${name}&am=${amount}&cu=INR&tn=${note}`;
}

// ---- NEW: Handle UPI button tap ----
window.payViaUpi = function() {
  if (!_pendingOrderMeta) return;
  const { orderId, total } = _pendingOrderMeta;
  const upiLink = generateUpiLink(total, orderId);
  const btn = document.getElementById("upi-pay-btn");

  let appOpened = false;

  // Phase 1: detect if UPI app opened (page goes hidden)
  const onHidden = () => {
    if (document.hidden) {
      appOpened = true;
      clearTimeout(noAppTimer);
      document.removeEventListener("visibilitychange", onHidden);
      // Phase 2: when user switches BACK, show the nudge
      document.addEventListener("visibilitychange", onReturn);
    }
  };

  // Phase 2: user returned from UPI app to our page
  const onReturn = () => {
    if (!document.hidden) {
      document.removeEventListener("visibilitychange", onReturn);
      showSwitchBackNudge();
      // Turn button green to signal "payment done, now upload"
      if (btn) {
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg> Payment Done? Upload Screenshot ↓`;
        btn.style.background = "linear-gradient(135deg,#22c55e 0%,#16a34a 100%)";
        btn.style.boxShadow = "0 4px 20px rgba(34,197,94,0.35)";
        btn.style.fontSize = "14px";
      }
    }
  };

  // If page never goes hidden within 1.5s — no UPI app installed
  const noAppTimer = setTimeout(() => {
    document.removeEventListener("visibilitychange", onHidden);
    if (!appOpened) showUpiNotFoundMessage();
  }, 1500);

  document.addEventListener("visibilitychange", onHidden);

  // Trigger UPI deep link
  window.location.href = upiLink;

  // Animate button to "opening" state
  if (btn) {
    btn.innerHTML = `<span style="display:inline-block;width:16px;height:16px;border:2.5px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;vertical-align:middle;margin-right:8px;"></span> Opening UPI App...`;
  }
};

function showUpiNotFoundMessage() {
  const el = document.getElementById("upi-fallback-msg");
  if (el) {
    el.style.display = "block";
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function showSwitchBackNudge() {
  // Hide no-app fallback if visible
  const fallback = document.getElementById("upi-fallback-msg");
  if (fallback) fallback.style.display = "none";

  const nudge = document.getElementById("upi-switchback-nudge");
  if (nudge) {
    nudge.style.display = "flex";
    nudge.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // Auto-scroll to screenshot upload after a short delay
  setTimeout(() => {
    document.getElementById("screenshot-file-input")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 900);
}

// ---- FEATURE: Coupon / Promo Code ----
window.applyCoupon = async function() {
  const input = document.getElementById("coupon-input");
  const statusEl = document.getElementById("coupon-status");
  const applyBtn = document.getElementById("coupon-apply-btn");
  const code = input?.value.trim().toUpperCase();

  if (!code) { if (window.showToast) showToast("Please enter a coupon code.", "error"); return; }

  applyBtn.disabled = true;
  applyBtn.textContent = "Checking...";
  if (statusEl) { statusEl.textContent = ""; statusEl.className = "coupon-status"; }

  try {
    const { getDocs, collection, query, where } =
      await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const snap = await getDocs(query(collection(db, "coupons"), where("code", "==", code), where("active", "==", true)));

    if (snap.empty) {
      if (statusEl) { statusEl.textContent = "✗ Invalid or expired coupon code."; statusEl.className = "coupon-status coupon-error"; }
      if (window.showToast) showToast("Invalid coupon code.", "error");
      applyBtn.disabled = false; applyBtn.textContent = "Apply";
      return;
    }

    const coupon = { id: snap.docs[0].id, ...snap.docs[0].data() };
    _appliedCoupon = coupon;

    if (statusEl) {
      const label = coupon.discountType === "percent"
        ? `${coupon.value}% off`
        : `₹${coupon.value} off`;
      statusEl.textContent = `✓ Coupon applied! ${label}`;
      statusEl.className = "coupon-status coupon-success";
    }

    // Swap apply button for remove button
    applyBtn.textContent = "Remove";
    applyBtn.disabled = false;
    applyBtn.onclick = removeCoupon;
    input.disabled = true;

    renderSummary();
    if (window.showToast) showToast("Coupon applied! ✓");

  } catch (err) {
    console.error("[Coupon] Error:", err);
    if (statusEl) { statusEl.textContent = "✗ Could not verify coupon. Try again."; statusEl.className = "coupon-status coupon-error"; }
    applyBtn.disabled = false; applyBtn.textContent = "Apply";
  }
};

function removeCoupon() {
  _appliedCoupon = null;
  const input = document.getElementById("coupon-input");
  const statusEl = document.getElementById("coupon-status");
  const applyBtn = document.getElementById("coupon-apply-btn");
  if (input) { input.value = ""; input.disabled = false; }
  if (statusEl) { statusEl.textContent = ""; statusEl.className = "coupon-status"; }
  if (applyBtn) { applyBtn.textContent = "Apply"; applyBtn.disabled = false; applyBtn.onclick = applyCoupon; }
  renderSummary();
  if (window.showToast) showToast("Coupon removed.");
}

function calcDiscount(subtotal) {
  if (!_appliedCoupon) return 0;
  if (_appliedCoupon.discountType === "percent") return Math.round(subtotal * _appliedCoupon.value / 100);
  return Math.min(_appliedCoupon.value, subtotal);
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
  const discount = calcDiscount(subtotal);
  const shipping = (subtotal - discount) >= 999 ? 0 : 99;
  const total = subtotal - discount + shipping;

  const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  safeSet("co-subtotal", fmt(subtotal));
  safeSet("co-shipping", shipping === 0 ? "FREE" : fmt(shipping));
  safeSet("co-total", fmt(total));

  // Discount row — show/hide
  const discRow = document.getElementById("co-discount-row");
  const discVal = document.getElementById("co-discount");
  if (discRow && discVal) {
    if (discount > 0) {
      discRow.style.display = "flex";
      discVal.textContent = "-" + fmt(discount);
    } else {
      discRow.style.display = "none";
    }
  }
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
  const discount = calcDiscount(subtotal);
  const shipping = (subtotal - discount) >= 999 ? 0 : 99;
  const total    = subtotal - discount + shipping;
  const orderId  = generateOrderId();

  // Store pending order data — will be saved AFTER screenshot upload
  _pendingOrderData = {
    orderId,
    name,
    phone,
    address: `${address}, ${city}${state ? ", " + state : ""} - ${pin}`,
    items: items.map(i => ({ name: i.name, size: i.size, qty: i.qty, price: i.price })),
    coupon: _appliedCoupon ? _appliedCoupon.code : null,
    discount: discount,
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

  // Show coupon in payment screen if applied
  const couponRow = document.getElementById("s-coupon-row");
  const couponVal = document.getElementById("s-coupon");
  if (couponRow && couponVal) {
    if (_appliedCoupon) {
      const label = _appliedCoupon.discountType === "percent"
        ? `${_appliedCoupon.code} (${_appliedCoupon.value}% off)`
        : `${_appliedCoupon.code} (-${fmt(_appliedCoupon.value)})`;
      couponVal.textContent = label;
      couponRow.style.display = "flex";
    } else {
      couponRow.style.display = "none";
    }
  }

  safeHref("track-btn", `tracking.html?id=${orderId}`);

  // ---- NEW: Wire up UPI Pay button with dynamic deep link ----
  const upiPayBtn = document.getElementById("upi-pay-btn");
  if (upiPayBtn) {
    const upiLink = generateUpiLink(total, orderId);
    // Set href for native anchor behavior on mobile
    upiPayBtn.setAttribute("data-upi-link", upiLink);
  }

  // Hide fallback message initially
  const fallbackMsg = document.getElementById("upi-fallback-msg");
  if (fallbackMsg) fallbackMsg.style.display = "none";

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

    // Auto-open WhatsApp with full order details
    autoOpenWhatsApp(_pendingOrderData);

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

  // Set manual WhatsApp fallback link (uses full order data)
  const waLink = document.getElementById("wa-manual-link");
  if (waLink && _pendingOrderData) {
    waLink.href = `https://wa.me/${WA_NUMBER}?text=${buildWhatsAppMessage(_pendingOrderData)}`;
  }

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
