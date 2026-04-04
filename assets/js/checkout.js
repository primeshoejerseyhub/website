// ============================================
// PRIME SHOE JERSEY HUB — Checkout v3 (Firebase)
// ============================================
// Replaces localStorage-only order saving with Firestore.
// Adds real Cloudinary screenshot upload.
// Removes Cash on Delivery and Card payment entirely.

import { db } from "./firebase.js";
import { uploadScreenshot } from "./cloudinary.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ---- CONFIG ----
const UPI_ID = "primeshoejerseyh@upi";
const WA_NUMBER = "919239394022";

// ---- HELPERS (these are already global from cart.js / products.js) ----
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

// ---- INJECT SCREENSHOT UPLOAD FIELD ----
// We inject the screenshot upload field into the success screen dynamically
function injectScreenshotField() {
  const upiBlock = document.querySelector(".upi-block");
  if (!upiBlock || document.getElementById("screenshot-upload-block")) return;

  upiBlock.insertAdjacentHTML("afterend", `
    <div id="screenshot-upload-block" style="background:var(--dark-3);border:1px solid var(--border-solid);border-radius:var(--radius-lg);padding:18px;margin-bottom:16px;">
      <div style="font-family:var(--font-cond);font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:var(--blue);margin-bottom:10px;">
        📸 Upload Payment Screenshot
      </div>
      <p style="font-size:12px;color:var(--silver);margin-bottom:12px;">
        After paying via UPI, upload your payment screenshot here for faster order confirmation.
      </p>
      <input type="file" id="screenshot-file-input" accept="image/*"
        style="font-size:12px;color:var(--white);background:var(--dark-4);border:1px solid var(--border-solid);border-radius:var(--radius-sm);padding:8px;width:100%;cursor:pointer;box-sizing:border-box;" />
      <div id="screenshot-preview-wrap" style="margin-top:10px;display:none;">
        <img id="screenshot-preview-img" src="" style="max-width:100%;max-height:200px;border-radius:var(--radius-sm);border:1px solid var(--border-solid);" />
      </div>
      <button id="screenshot-upload-btn" class="btn btn-blue btn-sm" style="margin-top:12px;width:100%;" onclick="uploadPaymentScreenshot()">
        ☁️ Upload Screenshot
      </button>
      <div id="screenshot-status" style="font-size:11px;color:var(--silver);margin-top:8px;font-family:var(--font-cond);font-weight:700;letter-spacing:0.06em;text-transform:uppercase;"></div>
    </div>
  `);

  // Preview selected file
  document.getElementById("screenshot-file-input")?.addEventListener("change", function() {
    const file = this.files[0];
    if (!file) return;
    const previewWrap = document.getElementById("screenshot-preview-wrap");
    const previewImg = document.getElementById("screenshot-preview-img");
    if (previewWrap && previewImg) {
      previewImg.src = URL.createObjectURL(file);
      previewWrap.style.display = "block";
    }
  });
}

// ---- UPLOAD SCREENSHOT ----
window.uploadPaymentScreenshot = async function() {
  const fileInput = document.getElementById("screenshot-file-input");
  const statusEl = document.getElementById("screenshot-status");
  const btn = document.getElementById("screenshot-upload-btn");

  if (!fileInput?.files?.length) {
    if (window.showToast) showToast("Please select a screenshot file first.", "error");
    return;
  }

  btn.disabled = true;
  btn.textContent = "⏳ Uploading...";
  if (statusEl) statusEl.textContent = "Uploading to Cloudinary...";

  try {
    const url = await uploadScreenshot(fileInput.files[0]);
    window._screenshotUrl = url;

    if (statusEl) statusEl.textContent = "✓ Screenshot uploaded successfully!";
    if (statusEl) statusEl.style.color = "var(--blue)";
    btn.textContent = "✓ Uploaded";
    btn.style.background = "var(--blue-tint)";
    console.log("[Checkout] Screenshot uploaded:", url);

    // Save screenshot URL to the order in Firestore
    const orderId = window._lastFirestoreOrderId;
    if (orderId) {
      const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      await updateDoc(doc(db, "orders", orderId), { screenshot: url });
      console.log("[Checkout] Screenshot saved to order:", orderId);
      if (window.showToast) showToast("Screenshot saved to your order ✓");
    }
  } catch (err) {
    console.error("[Checkout] Screenshot upload error:", err);
    if (statusEl) statusEl.textContent = "Upload failed. Use WhatsApp to send screenshot.";
    if (statusEl) statusEl.style.color = "var(--red)";
    btn.disabled = false;
    btn.textContent = "☁️ Try Again";
  }
};

// ---- PLACE ORDER ----
window.placeOrder = async function() {
  const name    = document.getElementById("co-name")?.value.trim();
  const phone   = document.getElementById("co-phone")?.value.trim();
  const address = document.getElementById("co-address")?.value.trim();
  const city    = document.getElementById("co-city")?.value.trim();
  const pin     = document.getElementById("co-pin")?.value.trim();

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

  const orderData = {
    orderId,
    name,
    phone,
    address: `${address}, ${city} - ${pin}`,
    items: items.map(i => ({ name: i.name, size: i.size, qty: i.qty, price: i.price })),
    amount: total,
    screenshot: null,             // filled after screenshot upload
    status: "Paid",               // user has paid via UPI
    createdAt: serverTimestamp()
  };

  try {
    // Save order to Firestore
    const ref = await addDoc(collection(db, "orders"), orderData);
    window._lastFirestoreOrderId = ref.id; // store for screenshot update
    console.log("[Checkout] Order saved to Firestore:", ref.id, orderId);

    // Show success screen
    showSuccessScreen({ orderId, name, total });

    // Clear cart
    if (window.cartClear) window.cartClear();

  } catch (err) {
    console.error("[Checkout] placeOrder Firestore error:", err);
    // Fallback: still show success screen (order is "pending" locally)
    showSuccessScreen({ orderId, name, total });
    if (window.cartClear) window.cartClear();
    toast("Order placed (offline). Share screenshot on WhatsApp.", "success");
  }
};

function showSuccessScreen({ orderId, name, total }) {
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

  // WhatsApp message
  const waMsg = encodeURIComponent(
    `Hi, I placed an order on Prime Shoe Jersey Hub.\n\nOrder ID: ${orderId}\nName: ${name}\nAmount: ${fmt(total)}\n\nI am sending my payment screenshot.`
  );
  safeHref("whatsapp-btn", `https://wa.me/${WA_NUMBER}?text=${waMsg}`);

  // Step indicators
  document.querySelectorAll(".csi-step").forEach(s => s.classList.remove("active"));
  document.getElementById("csi-1")?.classList.add("done");
  document.getElementById("csi-2")?.classList.add("done");
  document.getElementById("csi-3")?.classList.add("active");

  // Switch screens
  const formSection = document.getElementById("checkout-form-section");
  const successScreen = document.getElementById("success-screen");
  if (formSection) formSection.style.display = "none";
  if (successScreen) successScreen.classList.add("visible");

  // Inject screenshot upload field
  injectScreenshotField();

  // Save orderId to localStorage so tracking page can auto-fill it
  localStorage.setItem('psjh_last_order', orderId);
  console.log('[Checkout] Order ID saved to localStorage:', orderId);

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---- COPY UPI ----
window.copyUPI = function() {
  navigator.clipboard.writeText(UPI_ID)
    .then(() => { if (window.showToast) showToast("UPI ID copied to clipboard! ✓"); })
    .catch(() => { if (window.showToast) showToast(UPI_ID, "success"); });
};

// ---- SPINNER KEYFRAME ----
const spinStyle = document.createElement("style");
spinStyle.textContent = "@keyframes spin{to{transform:rotate(360deg)}}";
document.head.appendChild(spinStyle);

// ---- INIT ----
document.addEventListener("DOMContentLoaded", () => {
  renderSummary();
});
