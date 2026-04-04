// ============================================
// PRIME SHOE JERSEY HUB — Admin Panel JS v3.0
// ============================================
// Fixes:
//   ✅ Mobile sidebar (hamburger + overlay + z-index fix)
//   ✅ Reviews: load from Firestore subcollection
//   ✅ Delete review from Firestore
//   ✅ All async/await errors handled
//   ✅ Loading + empty states
//   ✅ Product form validated
//   ✅ Image upload (Cloudinary)

import { db } from "./firebase.js";
import { uploadMultipleToCloudinary } from "./cloudinary.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ============================================
// SECTION 1: ADMIN LOGIN
// ============================================
const ADMIN_CREDS = { username: "admin", password: "user_01" };
const STORAGE_KEY = "psjh_admin_logged_in";

function checkLoginState() {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

function showLoginScreen() {
  const loginEl = document.getElementById("admin-login-screen");
  const appEl = document.getElementById("admin-app");
  if (loginEl) loginEl.style.display = "flex";
  if (appEl) appEl.style.display = "none";
}

function showAdminApp() {
  const loginEl = document.getElementById("admin-login-screen");
  const appEl = document.getElementById("admin-app");
  if (loginEl) loginEl.style.display = "none";
  if (appEl) appEl.style.display = "flex";
}

window.adminLogin = function () {
  const username = document.getElementById("login-username")?.value.trim();
  const password = document.getElementById("login-password")?.value;
  const errorEl = document.getElementById("login-error");

  if (username === ADMIN_CREDS.username && password === ADMIN_CREDS.password) {
    localStorage.setItem(STORAGE_KEY, "true");
    if (errorEl) errorEl.style.display = "none";
    showAdminApp();
    initAdminApp();
  } else {
    if (errorEl) {
      errorEl.textContent = "Invalid username or password.";
      errorEl.style.display = "block";
    }
    const box = document.getElementById("login-box");
    if (box) {
      box.style.animation = "none";
      void box.offsetWidth;
      box.style.animation = "loginShake 0.4s ease";
    }
  }
};

window.adminLogout = function () {
  localStorage.removeItem(STORAGE_KEY);
  showLoginScreen();
  const pw = document.getElementById("login-password");
  if (pw) pw.value = "";
};

function initLoginKeyHandler() {
  document.getElementById("login-password")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") window.adminLogin();
  });
  document.getElementById("login-username")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("login-password")?.focus();
  });
}

// ============================================
// SECTION 2: MOBILE SIDEBAR
// ============================================
function initMobileSidebar() {
  const hamburger = document.getElementById("admin-hamburger");
  const sidebar = document.getElementById("admin-sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  if (!hamburger || !sidebar) return;

  // Ensure sidebar starts closed on mobile
  if (window.innerWidth <= 900) {
    sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("visible");
  }

  hamburger.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = sidebar.classList.toggle("open");
    if (overlay) overlay.classList.toggle("visible", isOpen);
    hamburger.classList.toggle("active", isOpen);
  });

  // Touch support for hamburger
  hamburger.addEventListener("touchend", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isOpen = sidebar.classList.toggle("open");
    if (overlay) overlay.classList.toggle("visible", isOpen);
    hamburger.classList.toggle("active", isOpen);
  });

  if (overlay) {
    overlay.addEventListener("click", closeMobileSidebar);
    overlay.addEventListener("touchend", (e) => { e.preventDefault(); closeMobileSidebar(); });
  }

  sidebar.querySelectorAll(".admin-nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      if (window.innerWidth <= 900) closeMobileSidebar();
    });
  });

  // Close on resize to desktop
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) closeMobileSidebar();
  });
}

function closeMobileSidebar() {
  document.getElementById("admin-sidebar")?.classList.remove("open");
  document.getElementById("sidebar-overlay")?.classList.remove("visible");
  document.getElementById("admin-hamburger")?.classList.remove("active");
}

// ============================================
// SECTION 3: STATE & TOAST
// ============================================
let allProducts = [];
let allOrders = [];
let allReviews = {};
let currentOrderId = null;
let editingProductId = null;
let uploadedImageUrls = [];

function showToast(msg, type = "success") {
  let c = document.getElementById("toast-container");
  if (!c) {
    c = document.createElement("div");
    c.id = "toast-container";
    document.body.appendChild(c);
  }
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<div class="toast-icon ${type === "error" ? "error" : ""}">${type === "error" ? "✕" : "✓"}</div><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add("removing"); setTimeout(() => t.remove(), 300); }, 3500);
}

// ============================================
// SECTION 4: NAVIGATION
// ============================================
window.showSection = function (name, btn) {
  document.querySelectorAll(".admin-section").forEach((s) => s.classList.remove("active"));
  document.querySelectorAll(".admin-nav-item").forEach((b) => b.classList.remove("active"));
  const section = document.getElementById("section-" + name);
  if (section) section.classList.add("active");
  if (btn) btn.classList.add("active");

  if (name === "dashboard") renderDashboard();
  else if (name === "orders") renderOrders();
  else if (name === "products") renderAdminProducts();
  else if (name === "reviews") renderReviewsSection();
  // add-product section doesn't need a render call
};

window.closeModal = function (id) {
  document.getElementById(id)?.classList.remove("open");
};

// ============================================
// SECTION 5: FIRESTORE LOADERS
// ============================================
async function loadProducts() {
  try {
    const snap = await getDocs(collection(db, "products"));
    allProducts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    console.log("[Admin] Products loaded:", allProducts.length);
  } catch (err) {
    console.error("[Admin] loadProducts error:", err.message);
    showToast("Failed to load products.", "error");
  }
}

async function loadOrders() {
  try {
    let snap;
    try {
      snap = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")));
    } catch {
      snap = await getDocs(collection(db, "orders"));
    }
    allOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    console.log("[Admin] Orders loaded:", allOrders.length);
  } catch (err) {
    console.error("[Admin] loadOrders error:", err.message);
    showToast("Failed to load orders.", "error");
  }
}

// ============================================
// SECTION 6: DASHBOARD
// ============================================
function renderDashboard() {
  const revenue = allOrders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const pending = allOrders.filter((o) => ["Paid", "pending", "confirmed"].includes(o.status)).length;
  const delivered = allOrders.filter((o) => o.status === "delivered").length;

  const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  safeSet("d-orders", allOrders.length);
  safeSet("d-revenue", "₹" + revenue.toLocaleString("en-IN"));
  safeSet("d-pending", pending);
  safeSet("d-delivered", delivered);
  safeSet("d-products", allProducts.length);

  const dateEl = document.getElementById("dash-date");
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const badgeEl = document.getElementById("orders-badge");
  if (badgeEl) badgeEl.textContent = allOrders.length;

  ["d-chart-orders", "d-chart-rev"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = Array.from({ length: 7 }, (_, i) =>
      `<div class="mini-bar${i === 6 ? " hi" : ""}" style="height:${20 + Math.floor(Math.random() * 80)}%;"></div>`
    ).join("");
  });

  const container = document.getElementById("dash-recent");
  if (container) {
    const recent = allOrders.slice(0, 5);
    container.innerHTML = recent.length
      ? buildOrdersTable(recent, true)
      : `<div class="empty-state"><div class="empty-icon">📭</div><div style="font-family:var(--font-cond);font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">No orders yet</div></div>`;
  }
}

// ============================================
// SECTION 7: ORDERS
// ============================================
function renderOrders() {
  const q = (document.getElementById("order-search")?.value || "").toLowerCase();
  const sf = document.getElementById("order-status-filter")?.value || "all";
  let filtered = [...allOrders];
  if (q) filtered = filtered.filter((o) =>
    (o.orderId || o.id || "").toLowerCase().includes(q) ||
    (o.name || "").toLowerCase().includes(q) ||
    (o.phone || "").includes(q)
  );
  if (sf !== "all") filtered = filtered.filter((o) => (o.status || "").toLowerCase() === sf.toLowerCase());

  const counter = document.getElementById("orders-count");
  if (counter) counter.textContent = `${filtered.length} of ${allOrders.length}`;
  const badgeEl = document.getElementById("orders-badge");
  if (badgeEl) badgeEl.textContent = allOrders.length;

  const container = document.getElementById("orders-table-container");
  if (!container) return;
  container.innerHTML = filtered.length
    ? buildOrdersTable(filtered, false)
    : `<div class="empty-state"><div class="empty-icon">${allOrders.length === 0 ? "📭" : "🔍"}</div><div style="font-family:var(--font-cond);font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">${allOrders.length === 0 ? "No orders yet" : "Nothing found"}</div></div>`;
}
window.renderOrders = renderOrders;

function buildOrdersTable(orders, mini) {
  return `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table class="admin-table"><thead><tr>
    <th>Order ID</th><th>Customer</th>${!mini ? "<th>Items</th>" : ""}
    <th>Amount</th><th>Screenshot</th><th>Status</th><th>Date</th><th>Actions</th>
  </tr></thead><tbody>
  ${orders.map((o) => {
    const displayId = o.orderId || o.id;
    const dateVal = o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString("en-IN") : (o.date || "—");
    const screenshotHtml = o.screenshot
      ? `<a href="${o.screenshot}" target="_blank" style="color:var(--blue);font-family:var(--font-cond);font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">View 🖼</a>`
      : `<span style="color:var(--silver);font-size:11px;">—</span>`;
    return `<tr>
      <td><span style="font-family:var(--font-display);font-size:1rem;color:var(--blue);">${displayId}</span></td>
      <td><div style="font-weight:600;font-size:13px;">${o.name || "—"}</div><div style="font-size:11px;color:var(--silver);">${o.phone || ""}</div></td>
      ${!mini ? `<td><div style="font-size:11px;color:var(--silver);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${Array.isArray(o.items) ? o.items.map((i) => `${i.name} (${i.size})`).join(", ") : (o.items || "—")}</div></td>` : ""}
      <td><span style="font-family:var(--font-display);font-size:1rem;color:var(--blue);">₹${Number(o.amount || 0).toLocaleString("en-IN")}</span></td>
      <td>${screenshotHtml}</td>
      <td><span class="status-badge status-${(o.status || "pending").toLowerCase().replace(/\s+/g, "_")}">${o.status || "Paid"}</span></td>
      <td style="font-size:11px;color:var(--silver);">${dateVal}</td>
      <td><div class="action-btns"><button class="action-btn" onclick="openOrderModal('${o.id}')" title="View">👁</button></div></td>
    </tr>`;
  }).join("")}
  </tbody></table></div>`;
}

const STAGE_KEYS = ["Paid", "confirmed", "packed", "shipped", "out_for_delivery", "delivered"];
const STAGE_LABELS = ["Placed/Paid", "Confirmed", "Packed", "Shipped", "Out", "Delivered"];

window.openOrderModal = function (id) {
  const order = allOrders.find((o) => o.id === id);
  if (!order) return;
  currentOrderId = id;
  const displayId = order.orderId || order.id;
  const titleEl = document.getElementById("modal-order-title");
  if (titleEl) titleEl.textContent = `Order #${displayId}`;

  const stage = Math.max(0, STAGE_KEYS.findIndex((k) => k.toLowerCase() === (order.status || "Paid").toLowerCase()));
  const isCancelled = (order.status || "").toLowerCase() === "cancelled";

  const timelineEl = document.getElementById("modal-timeline");
  if (timelineEl) {
    timelineEl.innerHTML = STAGE_KEYS.slice(0, 6).map((k, i) => {
      const done = !isCancelled && i < stage;
      const active = !isCancelled && i === stage;
      return `<div class="mt-step ${done ? "done" : active ? "active" : ""}">
        <div class="mt-dot">${done ? "✓" : i + 1}</div>
        <div class="mt-label">${STAGE_LABELS[i]}</div>
      </div>`;
    }).join("");
  }

  const statusSelect = document.getElementById("modal-status-select");
  if (statusSelect) statusSelect.value = order.status || "Paid";

  const dateVal = order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString("en-IN") : (order.date || "—");
  const itemsDisplay = Array.isArray(order.items)
    ? order.items.map((i) => `${i.name} (${i.size} × ${i.qty})`).join(", ")
    : (order.items || "—");

  const detailsEl = document.getElementById("modal-order-details");
  if (detailsEl) {
    detailsEl.innerHTML = `
      <div class="od-row"><span class="od-label">Order ID</span><span class="od-val" style="color:var(--blue);font-family:var(--font-display);">${displayId}</span></div>
      <div class="od-row"><span class="od-label">Customer</span><span class="od-val">${order.name || "—"}</span></div>
      <div class="od-row"><span class="od-label">Phone</span><span class="od-val">${order.phone || "—"}</span></div>
      <div class="od-row"><span class="od-label">Address</span><span class="od-val">${order.address || "—"}</span></div>
      <div class="od-row"><span class="od-label">Items</span><span class="od-val" style="font-size:11px;color:var(--silver);">${itemsDisplay}</span></div>
      <div class="od-row"><span class="od-label">Amount</span><span class="od-val" style="color:var(--blue);font-family:var(--font-display);font-size:1.1rem;">₹${Number(order.amount || 0).toLocaleString("en-IN")}</span></div>
      ${order.screenshot ? `<div class="od-row"><span class="od-label">Screenshot</span><span class="od-val"><a href="${order.screenshot}" target="_blank" style="color:var(--blue);">View Payment Proof 🖼</a></span></div>` : ""}
      <div class="od-row"><span class="od-label">Date</span><span class="od-val">${dateVal}</span></div>`;
  }
  document.getElementById("order-modal")?.classList.add("open");
};

window.updateOrderStatus = async function () {
  if (!currentOrderId) return;
  const newStatus = document.getElementById("modal-status-select")?.value;
  if (!newStatus) return;
  try {
    await updateDoc(doc(db, "orders", currentOrderId), { status: newStatus });
    const idx = allOrders.findIndex((o) => o.id === currentOrderId);
    if (idx !== -1) allOrders[idx].status = newStatus;
    closeModal("order-modal");
    renderOrders();
    renderDashboard();
    showToast(`Order status updated to: ${newStatus} ✓`);
  } catch (err) {
    console.error("[Admin] updateOrderStatus error:", err.message);
    showToast("Failed to update order status.", "error");
  }
};

window.deleteOrder = async function () {
  if (!currentOrderId || !confirm(`Delete order ${currentOrderId}? This cannot be undone.`)) return;
  try {
    await deleteDoc(doc(db, "orders", currentOrderId));
    allOrders = allOrders.filter((o) => o.id !== currentOrderId);
    closeModal("order-modal");
    renderOrders();
    renderDashboard();
    showToast("Order deleted.", "error");
  } catch (err) {
    console.error("[Admin] deleteOrder error:", err.message);
    showToast("Failed to delete order.", "error");
  }
};

window.clearAllOrders = async function () {
  if (!confirm("Delete ALL orders? This cannot be undone.")) return;
  try {
    await Promise.all(allOrders.map((o) => deleteDoc(doc(db, "orders", o.id))));
    allOrders = [];
    renderOrders();
    renderDashboard();
    showToast("All orders cleared.", "error");
  } catch (err) {
    console.error("[Admin] clearAllOrders error:", err.message);
    showToast("Failed to clear orders.", "error");
  }
};

// ============================================
// SECTION 8: PRODUCTS
// ============================================
window.renderAdminProducts = function () {
  const q = (document.getElementById("prod-search")?.value || "").toLowerCase();
  const cf = document.getElementById("prod-cat-filter")?.value || "all";
  let prods = [...allProducts];
  if (q) prods = prods.filter((p) => (p.name || "").toLowerCase().includes(q) || (p.brand || "").toLowerCase().includes(q));
  if (cf !== "all") prods = prods.filter((p) => p.category === cf);

  const grid = document.getElementById("admin-products-grid");
  if (!grid) return;
  if (!prods.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">🔍</div><div style="font-family:var(--font-cond);font-size:13px;text-transform:uppercase;font-weight:700;">No products found</div></div>`;
    return;
  }
  grid.innerHTML = prods.map((p) => {
    const disc = p.originalPrice ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100) : 0;
    const stockCls = p.stock === 0 ? "no-stock" : p.stock <= 5 ? "low-stock" : "in-stock";
    const stockText = p.stock === 0 ? "Out of Stock" : p.stock <= 5 ? `Only ${p.stock} left` : `In Stock (${p.stock})`;
    const imgSrc = (p.images || [])[0] || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&q=60";
    return `<div class="prod-admin-card">
      <img src="${imgSrc}" alt="${p.name}" class="prod-admin-img" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&q=60'"/>
      <div class="prod-admin-body">
        <div class="prod-admin-cat">${p.brand || "—"} · ${p.category || "—"}</div>
        <div class="prod-admin-name">${p.name || "Unnamed"}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
          <span style="font-family:var(--font-display);font-size:1rem;color:var(--blue);">₹${Number(p.price || 0).toLocaleString("en-IN")}</span>
          <span style="font-family:var(--font-cond);font-size:11px;color:var(--silver);text-decoration:line-through;">₹${Number(p.originalPrice || 0).toLocaleString("en-IN")}</span>
          <span style="font-family:var(--font-cond);font-size:9px;font-weight:700;background:var(--blue-tint);color:var(--blue);padding:1px 5px;border-radius:3px;">-${disc}%</span>
        </div>
        <div class="${stockCls}" style="font-family:var(--font-cond);font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px;">${stockText}</div>
        <div class="action-btns">
          <button class="action-btn" onclick="window.location='product.html?id=${p.id}'" title="View">🛒</button>
          <button class="action-btn" onclick="editProduct('${p.id}')" title="Edit">✏️</button>
          <button class="action-btn del" onclick="deleteProduct('${p.id}')" title="Delete">🗑</button>
        </div>
      </div>
    </div>`;
  }).join("");
};

// ============================================
// SECTION 9: IMAGE UPLOAD
// ============================================
window.handleImageFileSelect = function (input) {
  const files = Array.from(input.files).slice(0, 5);
  const strip = document.getElementById("pf-img-preview-strip");
  const status = document.getElementById("pf-img-upload-status");
  if (!strip || !status) return;

  strip.innerHTML = "";
  uploadedImageUrls = [];

  if (!files.length) { status.textContent = ""; return; }

  status.textContent = `${files.length} file(s) selected — will upload when you save.`;
  status.style.color = "var(--silver)";

  files.forEach((file) => {
    const url = URL.createObjectURL(file);
    strip.insertAdjacentHTML("beforeend",
      `<img src="${url}" style="width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid var(--border-solid);" />`
    );
  });

  input._selectedFiles = files;
  const urlField = document.getElementById("pf-img");
  if (urlField) urlField.value = "";
  updatePreview();
};

// ============================================
// SECTION 10: SAVE PRODUCT
// ============================================
window.saveProduct = async function () {
  const name     = document.getElementById("pf-name")?.value.trim();
  const cat      = document.getElementById("pf-cat")?.value;
  const brand    = document.getElementById("pf-brand")?.value;
  const price    = parseInt(document.getElementById("pf-price")?.value);
  const orig     = parseInt(document.getElementById("pf-original")?.value);
  const stock    = parseInt(document.getElementById("pf-stock")?.value) || 10;
  const badge    = document.getElementById("pf-badge")?.value;
  const feat     = document.getElementById("pf-featured")?.value === "true";
  const sizesRaw = document.getElementById("pf-sizes")?.value || "";
  const desc     = document.getElementById("pf-desc")?.value.trim() || "";

  if (!name || !cat || !brand || isNaN(price) || isNaN(orig)) {
    showToast("Please fill all required fields!", "error"); return;
  }
  if (price > orig) { showToast("Sale price cannot exceed original price!", "error"); return; }

  const saveBtn = document.getElementById("pf-save-text");
  if (saveBtn) saveBtn.textContent = "⏳ Uploading images...";

  try {
    const fileInput = document.getElementById("pf-img-files");
    let imageUrls = uploadedImageUrls.length ? [...uploadedImageUrls] : [];

    if (fileInput?._selectedFiles?.length) {
      const statusEl = document.getElementById("pf-img-upload-status");
      if (statusEl) { statusEl.textContent = "Uploading to Cloudinary..."; statusEl.style.color = "var(--blue)"; }
      imageUrls = await uploadMultipleToCloudinary(
        fileInput._selectedFiles, "psjh_products",
        (done, total) => { if (statusEl) statusEl.textContent = `Uploaded ${done} / ${total}...`; }
      );
      uploadedImageUrls = imageUrls;
    }

    if (!imageUrls.length) {
      const urlField = document.getElementById("pf-img");
      if (urlField?.value.trim()) {
        imageUrls = [urlField.value.trim()];
      } else if (editingProductId) {
        const existing = allProducts.find((p) => p.id === editingProductId);
        imageUrls = existing?.images || ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80"];
      } else {
        imageUrls = ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80"];
      }
    }

    if (saveBtn) saveBtn.textContent = "⏳ Saving to Firestore...";

    const sizes = sizesRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const productData = {
      name, category: cat, brand, price, originalPrice: orig, stock,
      badge: badge || null, featured: feat, images: imageUrls,
      sizes: sizes.length ? sizes : ["S", "M", "L", "XL"],
      description: desc || "Premium football product.",
      features: [], specs: {}, rating: 4.5, reviews: 0,
      updatedAt: serverTimestamp(),
    };

    if (editingProductId) {
      await updateDoc(doc(db, "products", editingProductId), productData);
      showToast(`"${name}" updated ✓`);
    } else {
      productData.createdAt = serverTimestamp();
      const ref = await addDoc(collection(db, "products"), productData);
      console.log("[Admin] Product added:", ref.id);
      showToast(`"${name}" added ✓`);
    }

    await loadProducts();
    resetProductForm();
    const prodsNavBtn = document.querySelectorAll(".admin-nav-item")[2];
    showSection("products", prodsNavBtn);
  } catch (err) {
    console.error("[Admin] saveProduct error:", err.message);
    showToast(`Error: ${err.message}`, "error");
  } finally {
    if (saveBtn) saveBtn.textContent = "💾 Save Product";
  }
};

// ============================================
// SECTION 11: EDIT / DELETE PRODUCT
// ============================================
window.editProduct = function (id) {
  const p = allProducts.find((x) => x.id === id);
  if (!p) return;
  editingProductId = id;
  uploadedImageUrls = [];

  const setVal = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val ?? ""; };
  setVal("pf-name", p.name); setVal("pf-cat", p.category); setVal("pf-brand", p.brand);
  setVal("pf-price", p.price); setVal("pf-original", p.originalPrice); setVal("pf-stock", p.stock);
  setVal("pf-badge", p.badge || ""); setVal("pf-featured", p.featured ? "true" : "false");
  setVal("pf-img", (p.images || [])[0] || "");
  setVal("pf-sizes", (p.sizes || []).join(", ")); setVal("pf-desc", p.description || "");

  const labelEl = document.getElementById("pf-section-label");
  const titleEl = document.getElementById("pf-section-title");
  const saveTextEl = document.getElementById("pf-save-text");
  if (labelEl) labelEl.textContent = "Editing";
  if (titleEl) titleEl.textContent = "EDIT PRODUCT";
  if (saveTextEl) saveTextEl.textContent = "💾 Update Product";

  const strip = document.getElementById("pf-img-preview-strip");
  if (strip) strip.innerHTML = (p.images || []).map((src) =>
    `<img src="${src}" style="width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid var(--border-solid);" />`
  ).join("");

  const statusEl = document.getElementById("pf-img-upload-status");
  if (statusEl) { statusEl.textContent = `${(p.images || []).length} existing image(s). Upload new files to replace.`; statusEl.style.color = "var(--silver)"; }

  const fileInput = document.getElementById("pf-img-files");
  if (fileInput) { fileInput.value = ""; fileInput._selectedFiles = []; }

  const addNavBtn = document.querySelectorAll(".admin-nav-item")[3];
  showSection("add-product", addNavBtn);
  updatePreview();
};

window.deleteProduct = async function (id) {
  const p = allProducts.find((x) => x.id === id);
  if (!p || !confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
  try {
    await deleteDoc(doc(db, "products", id));
    allProducts = allProducts.filter((x) => x.id !== id);
    renderAdminProducts();
    renderDashboard();
    showToast(`"${p.name}" deleted.`, "error");
  } catch (err) {
    console.error("[Admin] deleteProduct error:", err.message);
    showToast("Failed to delete product.", "error");
  }
};

window.resetProductForm = function () {
  editingProductId = null;
  uploadedImageUrls = [];
  ["pf-name","pf-price","pf-original","pf-stock","pf-img","pf-sizes","pf-desc"].forEach((id) => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  ["pf-cat","pf-brand","pf-badge"].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ""; });
  const featEl = document.getElementById("pf-featured"); if (featEl) featEl.value = "false";
  const strip = document.getElementById("pf-img-preview-strip"); if (strip) strip.innerHTML = "";
  const status = document.getElementById("pf-img-upload-status"); if (status) { status.textContent = ""; status.style.color = "var(--silver)"; }
  const fileInput = document.getElementById("pf-img-files"); if (fileInput) { fileInput.value = ""; fileInput._selectedFiles = []; }
  const labelEl = document.getElementById("pf-section-label"); if (labelEl) labelEl.textContent = "New Product";
  const titleEl = document.getElementById("pf-section-title"); if (titleEl) titleEl.textContent = "ADD PRODUCT";
  const saveTextEl = document.getElementById("pf-save-text"); if (saveTextEl) saveTextEl.textContent = "💾 Save Product";
  updatePreview();
};

window.updatePreview = function () {
  const previewCard = document.getElementById("product-preview-card");
  if (!previewCard) return;
  const name = document.getElementById("pf-name")?.value || "";
  const price = document.getElementById("pf-price")?.value || "";
  const brand = document.getElementById("pf-brand")?.value || "";
  const imgEl = document.getElementById("pf-img");
  const strip = document.getElementById("pf-img-preview-strip");
  let imgSrc = imgEl?.value || "";
  if (!imgSrc && strip) { const fi = strip.querySelector("img"); if (fi) imgSrc = fi.src; }
  if (!name && !price) {
    previewCard.innerHTML = `<div style="aspect-ratio:1;background:var(--dark-4);display:flex;align-items:center;justify-content:center;color:var(--silver);font-size:2rem;">🖼️</div><div style="padding:12px;"><div style="font-family:var(--font-cond);font-size:11px;color:var(--silver);">Fill form to preview</div></div>`;
    return;
  }
  previewCard.innerHTML = `
    <div style="aspect-ratio:1;background:var(--dark-4);overflow:hidden;">
      ${imgSrc ? `<img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'"/>` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:2rem;">🖼️</div>`}
    </div>
    <div style="padding:12px;">
      <div style="font-family:var(--font-cond);font-size:10px;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:0.1em;">${brand}</div>
      <div style="font-family:var(--font-cond);font-size:13px;font-weight:700;margin:4px 0;">${name || "Product Name"}</div>
      ${price ? `<div style="font-family:var(--font-display);font-size:1.1rem;color:var(--blue);">₹${Number(price).toLocaleString("en-IN")}</div>` : ""}
    </div>`;
};

// ============================================
// SECTION 12: REVIEWS — Firestore CRUD
// ============================================
async function loadAllReviews() {
  allReviews = {};
  if (!allProducts.length) {
    console.warn("[Admin] loadAllReviews: no products loaded yet");
    return;
  }

  console.log("[Admin] Loading reviews for", allProducts.length, "products...");
  let totalLoaded = 0;
  let permissionError = false;

  const promises = allProducts.map(async (product) => {
    try {
      // No orderBy — avoids composite index requirement
      const reviewsSnap = await getDocs(
        collection(db, "products", product.id, "reviews")
      );
      if (!reviewsSnap.empty) {
        const reviews = reviewsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Sort client-side newest first
        reviews.sort((a, b) => {
          const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return tb - ta;
        });
        allReviews[product.id] = reviews;
        totalLoaded += reviews.length;
      }
    } catch (e) {
      if (e.code === "permission-denied") {
        permissionError = true;
        console.error("[Admin] ❌ PERMISSION DENIED reading reviews for product", product.id);
        console.error("[Admin] Fix Firestore Rules: match /products/{p}/reviews/{r} { allow read, delete: if true; }");
      }
      // Otherwise: no reviews subcollection - that's normal
    }
  });

  await Promise.all(promises);
  
  if (permissionError) {
    showToast("⚠️ Firestore rules blocking review reads. See console.", "error");
  }
  
  console.log("[Admin] Reviews loaded:", totalLoaded, "total across", Object.keys(allReviews).length, "products");
}

async function renderReviewsSection() {
  const container = document.getElementById("reviews-container");
  if (!container) return;

  container.innerHTML = `<div style="text-align:center;padding:48px 20px;">
    <div class="admin-spinner" style="margin:0 auto 12px;"></div>
    <p style="color:var(--silver);font-size:13px;font-family:var(--font-cond);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Loading reviews...</p>
  </div>`;

  await loadAllReviews();

  const totalReviews = Object.values(allReviews).reduce((s, arr) => s + arr.length, 0);

  if (totalReviews === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">💬</div>
      <div style="font-family:var(--font-cond);font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">No reviews yet</div>
      <p style="color:var(--silver);font-size:13px;margin-top:8px;">Customer reviews will appear here once submitted on product pages.</p>
    </div>`;
    return;
  }

  let html = "";
  for (const product of allProducts) {
    const reviews = allReviews[product.id];
    if (!reviews || reviews.length === 0) continue;
    const imgSrc = (product.images || [])[0] || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=80&q=60";
    html += `
      <div style="background:var(--dark-2);border:1px solid var(--border-solid);border-radius:var(--radius-lg);margin-bottom:20px;overflow:hidden;">
        <div style="display:flex;align-items:center;gap:14px;padding:16px 20px;border-bottom:1px solid var(--border-solid);background:var(--dark-3);">
          <img src="${imgSrc}" style="width:44px;height:44px;object-fit:cover;border-radius:var(--radius-sm);border:1px solid var(--border-solid);flex-shrink:0;" loading="lazy" onerror="this.style.display='none'"/>
          <div style="flex:1;min-width:0;">
            <div style="font-family:var(--font-cond);font-weight:700;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${product.name || "Unknown Product"}</div>
            <div style="font-size:11px;color:var(--silver);margin-top:2px;">${product.brand || ""} · <span style="color:var(--blue);">${reviews.length} review${reviews.length !== 1 ? "s" : ""}</span></div>
          </div>
        </div>
        <div style="padding:0 20px;">
          ${reviews.map((r) => buildReviewRow(product.id, r)).join("")}
        </div>
      </div>`;
  }

  container.innerHTML = html || `<div class="empty-state"><div class="empty-icon">💬</div><div style="font-family:var(--font-cond);font-size:13px;font-weight:700;text-transform:uppercase;">No reviews yet</div></div>`;
}

function buildReviewRow(productId, review) {
  const ratingNum = Math.min(5, Math.max(1, review.rating || 5));
  const stars = "★".repeat(ratingNum) + "☆".repeat(5 - ratingNum);
  const dateStr = review.createdAt?.toDate
    ? review.createdAt.toDate().toLocaleDateString("en-IN")
    : (review.date || "");
  const authorName = review.author || review.name || "Anonymous";
  const commentText = review.comment || review.text || "—";

  return `<div id="review-row-${review.id}" style="display:flex;align-items:flex-start;gap:14px;padding:14px 0;border-bottom:1px solid var(--border-solid);transition:opacity 0.3s,transform 0.3s;">
    <div style="flex:1;min-width:0;">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
        <span style="font-weight:600;font-size:13px;">${authorName}</span>
        <span style="color:var(--orange);font-size:13px;letter-spacing:1px;">${stars}</span>
        ${dateStr ? `<span style="font-size:11px;color:var(--silver);">${dateStr}</span>` : ""}
      </div>
      <div style="font-size:13px;color:rgba(240,246,252,0.75);line-height:1.6;">${commentText}</div>
    </div>
    <button onclick="deleteReview('${productId}','${review.id}')" class="action-btn del" title="Delete Review" style="flex-shrink:0;margin-top:2px;">🗑</button>
  </div>`;
}

window.deleteReview = async function (productId, reviewId) {
  if (!confirm("Delete this review? This cannot be undone.")) return;
  try {
    await deleteDoc(doc(db, "products", productId, "reviews", reviewId));
    if (allReviews[productId]) {
      allReviews[productId] = allReviews[productId].filter((r) => r.id !== reviewId);
    }
    const row = document.getElementById(`review-row-${reviewId}`);
    if (row) {
      row.style.opacity = "0";
      row.style.transform = "translateX(20px)";
      setTimeout(() => row.remove(), 320);
    }
    showToast("Review deleted ✓");
    console.log("[Admin] Review deleted:", productId, reviewId);
  } catch (err) {
    console.error("[Admin] deleteReview error:", err.message);
    showToast("Failed to delete review.", "error");
  }
};

window.renderReviewsSection = renderReviewsSection;

// ============================================
// SECTION 13: MODAL BACKDROP
// ============================================
function initModalBackdropClose() {
  document.getElementById("order-modal")?.addEventListener("click", function (e) {
    if (e.target === this) closeModal("order-modal");
  });
}

// ============================================
// SECTION 14: LAZY IMAGE OBSERVER
// ============================================
function initLazyImages() {
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute("data-src");
        }
        img.classList.add("loaded");
        observer.unobserve(img);
      }
    });
  }, { rootMargin: "100px" });

  document.querySelectorAll("img[loading='lazy']").forEach(img => observer.observe(img));
}

// ============================================
// SECTION 15: INIT
// ============================================
async function initAdminApp() {
  console.log("[Admin] Initializing...");
  await Promise.all([loadProducts(), loadOrders()]);
  renderDashboard();
  initModalBackdropClose();
  initMobileSidebar();
  initLazyImages();
  console.log("[Admin] Ready ✓");
}

document.addEventListener("DOMContentLoaded", () => {
  initLoginKeyHandler();
  if (checkLoginState()) {
    showAdminApp();
    initAdminApp();
  } else {
    showLoginScreen();
  }
});
