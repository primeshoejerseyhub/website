// ============================================
// PRIME SHOE JERSEY HUB — Cart v3
// ============================================
// Cart is stored in localStorage (no auth needed).
// Removed broken firebase storage import from original.

const CART_KEY = "psjh_cart_v2";
let cartItems = loadCart();

function loadCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch(e) { return []; }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cartItems));
}

// ---- CART OPERATIONS ----

window.cartAdd = function(product, size, qty = 1) {
  if (!product) return false;
  if (product.stock === 0) { showToast("This product is out of stock.", "error"); return false; }

  const key = `${product.id}-${size}`;
  const existing = cartItems.find(i => i.key === key);

  if (existing) {
    existing.qty += qty;
  } else {
    cartItems.push({
      key,
      productId: product.id,
      name: product.name,
      price: product.price,
      image: (product.images || [])[0] || "",
      size,
      qty,
      category: product.category
    });
  }

  saveCart();
  cartRefreshUI();
  showToast(`${product.name.split(" ").slice(0, 3).join(" ")} added to cart!`);
  return true;
};

window.cartRemove = function(key) {
  cartItems = cartItems.filter(i => i.key !== key);
  saveCart();
  cartRefreshUI();
  renderCartItems();
};

window.cartUpdateQty = function(key, delta) {
  const item = cartItems.find(i => i.key === key);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    window.cartRemove(key);
  } else {
    saveCart();
    cartRefreshUI();
    renderCartItems();
  }
};

window.cartClear = function() {
  cartItems = [];
  saveCart();
  cartRefreshUI();
};

window.loadCart = function() {
  cartItems = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  return cartItems;
};

window.getCartTotal = function() {
  return cartItems.reduce((s, i) => s + i.price * i.qty, 0);
};

window.getCartCount = function() {
  return cartItems.reduce((s, i) => s + i.qty, 0);
};

// ---- UI ----

function cartRefreshUI() {
  const count = getCartCount();
  document.querySelectorAll(".cart-badge").forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? "flex" : "none";
  });
}

window.openCart = function() {
  document.getElementById("cart-overlay")?.classList.add("open");
  document.getElementById("cart-sidebar")?.classList.add("open");
  document.body.style.overflow = "hidden";
  renderCartItems();
};

window.closeCart = function() {
  document.getElementById("cart-overlay")?.classList.remove("open");
  document.getElementById("cart-sidebar")?.classList.remove("open");
  document.body.style.overflow = "";
};

function renderCartItems() {
  const container = document.getElementById("cart-items");
  if (!container) return;

  if (cartItems.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <div class="cart-empty-msg">Your cart is empty</div>
        <a href="shop.html" class="btn btn-outline btn-sm" style="margin-top:12px;" onclick="closeCart()">Browse Products</a>
      </div>`;
    return;
  }

  container.innerHTML = cartItems.map(item => `
    <div class="cart-item">
      <img src="${item.image}" alt="${item.name}" class="cart-item-img"
        onerror="this.src='https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&q=60'" />
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-meta">Size: ${item.size}</div>
        <div class="cart-item-price">₹${(item.price * item.qty).toLocaleString("en-IN")}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">
          <div class="cart-qty">
            <button class="cart-qty-btn" onclick="cartUpdateQty('${item.key}',-1)">−</button>
            <span class="cart-qty-val">${item.qty}</span>
            <button class="cart-qty-btn" onclick="cartUpdateQty('${item.key}',1)">+</button>
          </div>
          <button class="cart-remove" onclick="cartRemove('${item.key}')">Remove</button>
        </div>
      </div>
    </div>
  `).join("");

  const totalEl = document.getElementById("cart-subtotal-val");
  if (totalEl) totalEl.textContent = "₹" + getCartTotal().toLocaleString("en-IN");
}

function buildCartSidebar() {
  if (document.getElementById("cart-sidebar")) return;

  const overlay = document.createElement("div");
  overlay.id = "cart-overlay";
  overlay.onclick = closeCart;

  const sidebar = document.createElement("aside");
  sidebar.id = "cart-sidebar";
  sidebar.innerHTML = `
    <div class="cart-header">
      <div>
        <div class="cart-title">Your Cart</div>
      </div>
      <button class="cart-close" onclick="closeCart()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <div class="cart-items" id="cart-items"></div>
    <div class="cart-footer">
      <div class="cart-upi-note">📱 Payment via UPI after order</div>
      <div class="cart-subtotal">
        <span class="cart-subtotal-label">Subtotal</span>
        <span class="cart-subtotal-val" id="cart-subtotal-val">₹0</span>
      </div>
      <a href="checkout.html" class="btn btn-blue btn-full" style="margin-bottom:8px;">Proceed to Checkout →</a>
      <button class="btn btn-ghost btn-full btn-sm" onclick="closeCart()">Continue Shopping</button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(sidebar);
}

// ---- QUICK ADD ----
window.quickAddToCart = function(productId) {
  const product = getProductById(productId);
  if (!product) {
    showToast("Product not found.", "error");
    return;
  }
  if (product.stock === 0) { showToast("Out of stock!", "error"); return; }
  const defaultSize = (product.sizes || ["M"])[Math.min(1, (product.sizes || ["M"]).length - 1)];
  if (cartAdd(product, defaultSize, 1)) openCart();
};

// ---- TOAST ----
window.showToast = function(msg, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <div class="toast-icon ${type === "error" ? "error" : ""}">
      ${type === "error" ? "✕" : "✓"}
    </div>
    <span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add("removing"); setTimeout(() => toast.remove(), 300); }, 3000);
};

// ---- INIT ----
document.addEventListener("DOMContentLoaded", () => {
  buildCartSidebar();
  document.querySelectorAll("[data-cart-trigger]").forEach(btn => {
    btn.addEventListener("click", openCart);
    btn.addEventListener("touchend", (e) => { e.preventDefault(); openCart(); });
  });
  cartRefreshUI();
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeCart(); });

  // Lazy image loaded class for fade-in effect
  document.querySelectorAll("img[loading='lazy']").forEach(img => {
    if (img.complete) {
      img.classList.add("loaded");
    } else {
      img.addEventListener("load", () => img.classList.add("loaded"), { once: true });
      img.addEventListener("error", () => img.classList.add("loaded"), { once: true });
    }
  });
  // Observe future lazy images via MutationObserver
  new MutationObserver((mutations) => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        const imgs = node.tagName === "IMG" ? [node] : node.querySelectorAll("img[loading='lazy']");
        imgs.forEach(img => {
          if (img.complete) { img.classList.add("loaded"); }
          else { img.addEventListener("load", () => img.classList.add("loaded"), { once: true }); }
        });
      });
    });
  }).observe(document.body, { childList: true, subtree: true });
});
