import { db } from "./firebase.js";
import { uploadMultipleToCloudinary, uploadToCloudinary } from "./cloudinary.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
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
  else if (name === "enquiries") renderEnquiriesSection();
  else if (name === "site-settings") renderSiteSettings();
  else if (name === "bulk-upload") renderBulkUpload();
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
    const imgSrc = (p.images && p.images.length > 0 && p.images[0])
      ? p.images[0]
      : (p.image || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&q=60");
    const fallbackImg = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&q=60";
    return `<div class="prod-admin-card">
      <img src="${imgSrc}" alt="${p.name}" class="prod-admin-img" loading="lazy"
        onerror="this.onerror=null;this.src='${fallbackImg}'"
        onload="this.style.opacity='1'" style="opacity:0;transition:opacity 0.3s;"/>
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
// SECTION 17: SITE SETTINGS (Hero + Photos)
// ============================================

async function renderSiteSettings() {
  const container = document.getElementById("section-site-settings");
  if (!container) return;

  container.innerHTML = `
    <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:28px;flex-wrap:wrap;gap:12px;">
      <div><div class="section-label" style="margin-bottom:8px;">Customise</div><div class="admin-page-title">SITE SETTINGS</div></div>
    </div>

    <!-- HERO IMAGES -->
    <div style="background:var(--dark-2);border:1px solid var(--border-solid);border-radius:var(--radius-lg);padding:24px;margin-bottom:24px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:10px;">
        <div>
          <div style="font-family:var(--font-cond);font-weight:700;font-size:16px;letter-spacing:0.06em;text-transform:uppercase;">🖼️ Hero Background Images</div>
          <div style="font-size:12px;color:var(--silver);margin-top:4px;">These images rotate in the homepage hero section. Recommended: landscape, 1280×720px+.</div>
        </div>
        <label class="btn btn-blue btn-sm" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
          <input type="file" id="hero-upload-input" accept="image/*" multiple style="display:none;" onchange="handleHeroUpload(this)"/>
          + Upload Images
        </label>
      </div>
      <div id="hero-upload-progress" style="display:none;margin-bottom:12px;">
        <div style="height:4px;background:var(--dark-3);border-radius:2px;overflow:hidden;">
          <div id="hero-progress-bar" style="height:100%;background:var(--blue);width:0%;transition:width 0.3s;border-radius:2px;"></div>
        </div>
        <div id="hero-progress-label" style="font-size:11px;color:var(--silver);margin-top:6px;font-family:var(--font-cond);"></div>
      </div>
      <div id="hero-images-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;">
        <div style="text-align:center;padding:32px;color:var(--silver);grid-column:1/-1;">
          <div class="admin-spinner" style="margin:0 auto 10px;"></div>
          <div style="font-size:12px;font-family:var(--font-cond);">Loading...</div>
        </div>
      </div>
    </div>

    <!-- CUSTOMER PHOTOS -->
    <div style="background:var(--dark-2);border:1px solid var(--border-solid);border-radius:var(--radius-lg);padding:24px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:10px;">
        <div>
          <div style="font-family:var(--font-cond);font-weight:700;font-size:16px;letter-spacing:0.06em;text-transform:uppercase;">📸 Customer Photo Slider</div>
          <div style="font-size:12px;color:var(--silver);margin-top:4px;">Photos shown in the "Our Customers" section on homepage. Square images work best.</div>
        </div>
        <label class="btn btn-blue btn-sm" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
          <input type="file" id="photos-upload-input" accept="image/*" multiple style="display:none;" onchange="handlePhotosUpload(this)"/>
          + Upload Photos
        </label>
      </div>
      <div id="photos-upload-progress" style="display:none;margin-bottom:12px;">
        <div style="height:4px;background:var(--dark-3);border-radius:2px;overflow:hidden;">
          <div id="photos-progress-bar" style="height:100%;background:var(--blue);width:0%;transition:width 0.3s;border-radius:2px;"></div>
        </div>
        <div id="photos-progress-label" style="font-size:11px;color:var(--silver);margin-top:6px;font-family:var(--font-cond);"></div>
      </div>
      <div id="customer-photos-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;">
        <div style="text-align:center;padding:32px;color:var(--silver);grid-column:1/-1;">
          <div class="admin-spinner" style="margin:0 auto 10px;"></div>
          <div style="font-size:12px;font-family:var(--font-cond);">Loading...</div>
        </div>
      </div>
    </div>`;

  await loadAndRenderHeroImages();
  await loadAndRenderCustomerPhotos();
}

// --- Hero Images ---
async function loadAndRenderHeroImages() {
  const grid = document.getElementById("hero-images-grid");
  if (!grid) return;
  try {
    const snap = await getDoc(doc(db, "siteConfig", "heroImages"));
    const images = snap.exists() ? (snap.data().images || []) : [];
    renderImageGrid(grid, images, "hero");
  } catch (e) {
    if (e.code === "permission-denied" || e.message.includes("permissions")) {
      grid.innerHTML = `<div style="background:rgba(248,81,73,0.08);border:1px solid rgba(248,81,73,0.25);border-radius:var(--radius-sm);padding:16px 20px;grid-column:1/-1;">
        <div style="font-family:var(--font-cond);font-weight:700;font-size:13px;color:var(--red);margin-bottom:8px;">⚠️ Firestore Permission Error — Action Required</div>
        <div style="font-size:12px;color:rgba(240,246,252,0.75);line-height:1.7;">
          You need to allow <code style="background:var(--dark-3);padding:1px 5px;border-radius:3px;">siteConfig</code> in your Firestore Security Rules.<br/>
          Go to: <strong>Firebase Console → Firestore → Rules</strong> and add this rule:<br/>
          <pre style="background:var(--dark-3);border-radius:6px;padding:10px 14px;margin-top:8px;font-size:11px;overflow-x:auto;color:#38BDF8;">match /siteConfig/{docId} {
  allow read: if true;
  allow write: if true;
}</pre>
          Then click <strong>Publish</strong> and reload this page.
        </div>
      </div>`;
    } else {
      grid.innerHTML = `<div style="color:var(--red);font-size:12px;padding:12px;">Error: ${e.message}</div>`;
    }
  }
}

async function loadAndRenderCustomerPhotos() {
  const grid = document.getElementById("customer-photos-grid");
  if (!grid) return;
  try {
    const snap = await getDoc(doc(db, "siteConfig", "customerPhotos"));
    const images = snap.exists() ? (snap.data().images || []) : [];
    renderImageGrid(grid, images, "photos");
  } catch (e) {
    if (e.code === "permission-denied" || e.message.includes("permissions")) {
      grid.innerHTML = `<div style="background:rgba(248,81,73,0.08);border:1px solid rgba(248,81,73,0.25);border-radius:var(--radius-sm);padding:16px 20px;grid-column:1/-1;">
        <div style="font-family:var(--font-cond);font-weight:700;font-size:13px;color:var(--red);margin-bottom:8px;">⚠️ Firestore Permission Error — Action Required</div>
        <div style="font-size:12px;color:rgba(240,246,252,0.75);line-height:1.7;">
          You need to allow <code style="background:var(--dark-3);padding:1px 5px;border-radius:3px;">siteConfig</code> in your Firestore Security Rules.<br/>
          Go to: <strong>Firebase Console → Firestore → Rules</strong> and add this rule:<br/>
          <pre style="background:var(--dark-3);border-radius:6px;padding:10px 14px;margin-top:8px;font-size:11px;overflow-x:auto;color:#38BDF8;">match /siteConfig/{docId} {
  allow read: if true;
  allow write: if true;
}</pre>
          Then click <strong>Publish</strong> and reload this page.
        </div>
      </div>`;
    } else {
      grid.innerHTML = `<div style="color:var(--red);font-size:12px;padding:12px;">Error: ${e.message}</div>`;
    }
  }
}

function renderImageGrid(grid, images, type) {
  if (!images.length) {
    grid.innerHTML = `<div style="text-align:center;padding:32px 20px;color:var(--silver);grid-column:1/-1;">
      <div style="font-size:2rem;margin-bottom:8px;">${type === "hero" ? "🖼️" : "📸"}</div>
      <div style="font-family:var(--font-cond);font-size:12px;font-weight:700;text-transform:uppercase;">No images yet</div>
      <div style="font-size:11px;margin-top:4px;">Upload images using the button above</div>
    </div>`;
    return;
  }
  grid.innerHTML = images.map((item, idx) => {
    const url = typeof item === "string" ? item : item.url;
    return `
      <div id="${type}-img-${idx}" style="position:relative;border-radius:var(--radius-sm);overflow:hidden;border:1px solid var(--border-solid);aspect-ratio:1;background:var(--dark-3);">
        <img src="${url}" alt="image ${idx+1}" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy" onerror="this.style.display='none'"/>
        <button onclick="removeImage('${type}',${idx})"
          style="position:absolute;top:6px;right:6px;width:26px;height:26px;border-radius:50%;background:rgba(248,81,73,0.9);border:none;color:#fff;cursor:pointer;font-size:13px;line-height:1;display:flex;align-items:center;justify-content:center;transition:transform 0.15s;"
          title="Remove" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">✕</button>
        <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.55);padding:4px 8px;font-family:var(--font-cond);font-size:10px;color:rgba(255,255,255,0.7);">#${idx+1}</div>
      </div>`;
  }).join("");
}

window.removeImage = async function(type, idx) {
  const docId = type === "hero" ? "heroImages" : "customerPhotos";
  try {
    const snap = await getDoc(doc(db, "siteConfig", docId));
    let images = snap.exists() ? (snap.data().images || []) : [];
    images.splice(idx, 1);
    await setDoc(doc(db, "siteConfig", docId), { images }, { merge: true });
    showToast("Image removed ✓");
    if (type === "hero") await loadAndRenderHeroImages();
    else await loadAndRenderCustomerPhotos();
  } catch (e) {
    showToast("Failed to remove image.", "error");
  }
};

window.handleHeroUpload = async function(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const progress = document.getElementById("hero-upload-progress");
  const bar = document.getElementById("hero-progress-bar");
  const label = document.getElementById("hero-progress-label");
  if (progress) progress.style.display = "block";
  try {
    const urls = await uploadMultipleToCloudinary(files, "psjh_hero", (done, total) => {
      if (bar) bar.style.width = `${Math.round((done/total)*100)}%`;
      if (label) label.textContent = `Uploading ${done} of ${total}...`;
    });
    const snap = await getDoc(doc(db, "siteConfig", "heroImages"));
    const existing = snap.exists() ? (snap.data().images || []) : [];
    await setDoc(doc(db, "siteConfig", "heroImages"), { images: [...existing, ...urls] }, { merge: true });
    showToast(`${urls.length} image${urls.length > 1 ? "s" : ""} added to hero ✓`);
    await loadAndRenderHeroImages();
  } catch (e) {
    const msg = (e.code === "permission-denied" || e.message.includes("permissions"))
      ? "Firestore permission denied. Update your Firestore Rules to allow siteConfig writes. See Site Settings panel for instructions."
      : "Upload failed: " + e.message;
    showToast(msg, "error");
  } finally {
    if (progress) progress.style.display = "none";
    if (bar) bar.style.width = "0%";
    input.value = "";
  }
};

window.handlePhotosUpload = async function(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const progress = document.getElementById("photos-upload-progress");
  const bar = document.getElementById("photos-progress-bar");
  const label = document.getElementById("photos-progress-label");
  if (progress) progress.style.display = "block";
  try {
    const urls = await uploadMultipleToCloudinary(files, "psjh_customer_photos", (done, total) => {
      if (bar) bar.style.width = `${Math.round((done/total)*100)}%`;
      if (label) label.textContent = `Uploading ${done} of ${total}...`;
    });
    const snap = await getDoc(doc(db, "siteConfig", "customerPhotos"));
    const existing = snap.exists() ? (snap.data().images || []) : [];
    // Store as objects with url + link
    const newItems = urls.map(url => ({ url, link: "https://www.instagram.com/primeshoejerseyhub/" }));
    await setDoc(doc(db, "siteConfig", "customerPhotos"), { images: [...existing, ...newItems] }, { merge: true });
    showToast(`${urls.length} photo${urls.length > 1 ? "s" : ""} added to slider ✓`);
    await loadAndRenderCustomerPhotos();
  } catch (e) {
    const msg = (e.code === "permission-denied" || e.message.includes("permissions"))
      ? "Firestore permission denied. Update your Firestore Rules to allow siteConfig writes. See Site Settings panel for instructions."
      : "Upload failed: " + e.message;
    showToast(msg, "error");
  } finally {
    if (progress) progress.style.display = "none";
    if (bar) bar.style.width = "0%";
    input.value = "";
  }
};

window.renderSiteSettings = renderSiteSettings;


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
  await Promise.all([loadProducts(), loadOrders(), loadEnquiries()]);
  renderDashboard();
  initModalBackdropClose();
  initMobileSidebar();
  initLazyImages();
  console.log("[Admin] Ready ✓");
}

// ============================================
// SECTION 16: ENQUIRIES
// ============================================
import {
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let allEnquiries = [];

async function loadEnquiries() {
  try {
    const q = query(collection(db, "enquiries"), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    allEnquiries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Update badge
    const unread = allEnquiries.filter(e => !e.read).length;
    const badge = document.getElementById("enquiries-badge");
    if (badge) {
      if (unread > 0) { badge.textContent = unread; badge.style.display = "inline-block"; }
      else badge.style.display = "none";
    }
    console.log("[Admin] Enquiries loaded:", allEnquiries.length);
  } catch (err) {
    console.error("[Admin] loadEnquiries error:", err.message);
    showToast("Failed to load enquiries.", "error");
  }
}

async function renderEnquiriesSection() {
  const container = document.getElementById("enquiries-container");
  if (!container) return;

  container.innerHTML = `<div style="text-align:center;padding:48px 20px;">
    <div class="admin-spinner" style="margin:0 auto 12px;"></div>
    <p style="color:var(--silver);font-size:13px;font-family:var(--font-cond);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Loading enquiries...</p>
  </div>`;

  await loadEnquiries();

  if (!allEnquiries.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📩</div>
      <div style="font-family:var(--font-cond);font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">No enquiries yet</div>
      <p style="color:var(--silver);font-size:13px;margin-top:8px;">Customer contact form messages will appear here.</p>
    </div>`;
    return;
  }

  const rows = allEnquiries.map(e => {
    const dateStr = e.timestamp?.toDate
      ? e.timestamp.toDate().toLocaleString("en-IN")
      : "—";
    const isUnread = !e.read;
    return `<div id="enquiry-row-${e.id}" style="background:var(--dark-2);border:1px solid ${isUnread ? "rgba(56,189,248,0.3)" : "var(--border-solid)"};border-radius:var(--radius-lg);padding:20px 24px;margin-bottom:12px;transition:opacity 0.3s,transform 0.3s;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;">
            <span style="font-family:var(--font-cond);font-weight:700;font-size:15px;">${e.name}</span>
            ${isUnread ? `<span style="background:var(--blue);color:var(--dark);font-family:var(--font-cond);font-size:9px;font-weight:900;padding:2px 8px;border-radius:100px;letter-spacing:0.08em;">NEW</span>` : ""}
            <span style="font-size:11px;color:var(--silver);">${dateStr}</span>
          </div>
          <div style="font-size:12px;color:var(--silver);margin-bottom:6px;">
            📱 ${e.phone || "—"} &nbsp;·&nbsp; 📧 ${e.email || "—"} &nbsp;·&nbsp; 📋 ${e.subject || "—"}
          </div>
          <div style="font-size:13px;color:rgba(240,246,252,0.8);line-height:1.6;background:var(--dark-3);padding:12px;border-radius:var(--radius-sm);">${e.message}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
          ${isUnread
            ? `<button onclick="markEnquiryRead('${e.id}')" class="action-btn" title="Mark as Read" style="width:auto;padding:6px 10px;font-size:11px;font-family:var(--font-cond);font-weight:700;letter-spacing:0.04em;gap:4px;display:flex;align-items:center;">✓ Read</button>`
            : `<button class="action-btn" disabled style="width:auto;padding:6px 10px;font-size:11px;font-family:var(--font-cond);opacity:0.4;cursor:default;">✓ Read</button>`
          }
          <button onclick="deleteEnquiry('${e.id}')" class="action-btn del" title="Delete">🗑</button>
          <a href="https://wa.me/91${e.phone?.replace(/\D/g,'')}?text=Hi+${encodeURIComponent(e.name)}%2C+thank+you+for+reaching+out!" target="_blank" class="action-btn" title="Reply on WhatsApp" style="width:auto;padding:6px 10px;font-size:11px;text-decoration:none;font-family:var(--font-cond);font-weight:700;display:flex;align-items:center;gap:4px;color:#25d366;border-color:rgba(37,211,102,0.3);">💬 WA</a>
        </div>
      </div>
    </div>`;
  }).join("");

  container.innerHTML = rows;
}

window.markEnquiryRead = async function(id) {
  try {
    await updateDoc(doc(db, "enquiries", id), { read: true });
    const enquiry = allEnquiries.find(e => e.id === id);
    if (enquiry) enquiry.read = true;
    await renderEnquiriesSection();
    showToast("Marked as read ✓");
  } catch (err) {
    console.error("[Admin] markEnquiryRead error:", err.message);
    showToast("Failed to update.", "error");
  }
};

window.deleteEnquiry = async function(id) {
  if (!confirm("Delete this enquiry? This cannot be undone.")) return;
  try {
    await deleteDoc(doc(db, "enquiries", id));
    allEnquiries = allEnquiries.filter(e => e.id !== id);
    const row = document.getElementById(`enquiry-row-${id}`);
    if (row) { row.style.opacity = "0"; row.style.transform = "translateX(20px)"; setTimeout(() => row.remove(), 320); }
    showToast("Enquiry deleted.");
  } catch (err) {
    console.error("[Admin] deleteEnquiry error:", err.message);
    showToast("Failed to delete enquiry.", "error");
  }
};

window.renderEnquiriesSection = renderEnquiriesSection;

// ============================================
// BULK UPLOAD — CSV Import
// ============================================
let bulkRows = []; // parsed CSV rows awaiting import

function renderBulkUpload() {
  const container = document.getElementById("section-bulk-upload");
  if (!container) return;
  container.innerHTML = `
    <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:28px;flex-wrap:wrap;gap:12px;">
      <div>
        <div class="section-label" style="margin-bottom:8px;">Import</div>
        <div class="admin-page-title">BULK UPLOAD PRODUCTS</div>
      </div>
      <a id="bulk-download-template" href="#" onclick="downloadCSVTemplate();return false;"
        class="btn btn-outline btn-sm" style="display:inline-flex;align-items:center;gap:6px;">
        ⬇ Download CSV Template
      </a>
    </div>

    <!-- STEP 1 -->
    <div class="bulk-step-card" id="bulk-step-1">
      <div class="bulk-step-header">
        <div class="bulk-step-num">1</div>
        <div>
          <div class="bulk-step-title">Prepare your images on Cloudinary</div>
          <div class="bulk-step-sub">Upload your product images to Cloudinary first, then copy the image URLs into your CSV.</div>
        </div>
      </div>
      <div style="background:var(--dark-3);border-radius:var(--radius-sm);padding:14px 16px;margin-top:12px;font-size:12px;line-height:1.8;color:rgba(240,246,252,0.78);">
        <strong style="color:var(--blue);">How to get Cloudinary URLs:</strong><br/>
        1. Go to <a href="https://cloudinary.com" target="_blank" style="color:var(--blue);">cloudinary.com</a> → Media Library<br/>
        2. Upload your product images (drag &amp; drop)<br/>
        3. Click any image → copy the <strong>URL</strong> (ends in .jpg / .png / .webp)<br/>
        4. Paste that URL into the <code style="background:var(--dark-4);padding:1px 5px;border-radius:3px;">image1</code> column of your CSV<br/>
        5. For multiple images per product, use <code style="background:var(--dark-4);padding:1px 5px;border-radius:3px;">image2</code>, <code style="background:var(--dark-4);padding:1px 5px;border-radius:3px;">image3</code> columns
      </div>
    </div>

    <!-- STEP 2 -->
    <div class="bulk-step-card" id="bulk-step-2" style="margin-top:16px;">
      <div class="bulk-step-header">
        <div class="bulk-step-num">2</div>
        <div>
          <div class="bulk-step-title">Fill in the CSV template</div>
          <div class="bulk-step-sub">Download the template above, fill it in Excel or Google Sheets, then save as CSV.</div>
        </div>
      </div>
      <div style="margin-top:14px;overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="background:var(--dark-3);">
              ${["name","category","brand","price","originalPrice","stock","badge","featured","sizes","description","image1","image2","image3"].map(h =>
                `<th style="padding:8px 10px;text-align:left;font-family:var(--font-cond);font-weight:700;letter-spacing:0.05em;color:var(--blue);border-bottom:1px solid var(--border-solid);white-space:nowrap;">${h}</th>`
              ).join("")}
            </tr>
          </thead>
          <tbody>
            <tr style="background:var(--dark-2);">
              ${["Nike Air Zoom","shoes","Nike","2499","3499","15","hot","true","6,7,8,9,10","Premium football boots","https://...","",""].map(v =>
                `<td style="padding:7px 10px;font-size:11px;color:rgba(240,246,252,0.65);border-bottom:1px solid var(--border-solid);white-space:nowrap;">${v}</td>`
              ).join("")}
            </tr>
            <tr style="background:var(--dark-3);">
              ${["Adidas Copa","shoes","Adidas","1999","2999","8","","false","7,8,9,10","Classic design","https://...","https://...",""].map(v =>
                `<td style="padding:7px 10px;font-size:11px;color:rgba(240,246,252,0.65);border-bottom:1px solid var(--border-solid);white-space:nowrap;">${v}</td>`
              ).join("")}
            </tr>
          </tbody>
        </table>
      </div>
      <div style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;font-size:11px;">
        ${[
          ["category","shoes · jersey · studs · accessories"],
          ["brand","Nike · Adidas · Mizuno (or any brand)"],
          ["badge","hot · new · sale · limited (or leave blank)"],
          ["featured","true or false"],
          ["sizes","comma-separated: 6,7,8,9"],
          ["price / originalPrice","numbers only, no ₹"],
          ["stock","number of units available"],
          ["image1-3","full Cloudinary URL or leave blank"],
        ].map(([k,v]) => `
          <div style="background:var(--dark-3);border-radius:var(--radius-sm);padding:8px 10px;border:1px solid var(--border-solid);">
            <div style="font-family:var(--font-cond);font-weight:700;color:var(--blue);font-size:10px;margin-bottom:2px;">${k}</div>
            <div style="color:rgba(240,246,252,0.6);">${v}</div>
          </div>`
        ).join("")}
      </div>
    </div>

    <!-- STEP 3: Upload CSV -->
    <div class="bulk-step-card" id="bulk-step-3" style="margin-top:16px;">
      <div class="bulk-step-header">
        <div class="bulk-step-num">3</div>
        <div>
          <div class="bulk-step-title">Upload your CSV file</div>
          <div class="bulk-step-sub">Select your filled CSV — products will be previewed before import.</div>
        </div>
      </div>
      <div style="margin-top:14px;">
        <label style="display:flex;align-items:center;justify-content:center;gap:10px;border:2px dashed rgba(56,189,248,0.25);border-radius:var(--radius-lg);padding:28px 20px;cursor:pointer;background:rgba(56,189,248,0.03);transition:border-color 0.2s,background 0.2s;"
          id="csv-drop-zone" onmouseenter="this.style.borderColor='rgba(56,189,248,0.5)';this.style.background='rgba(56,189,248,0.06)'"
          onmouseleave="this.style.borderColor='rgba(56,189,248,0.25)';this.style.background='rgba(56,189,248,0.03)'">
          <input type="file" id="csv-file-input" accept=".csv" style="display:none;" onchange="handleCSVUpload(this)"/>
          <div style="text-align:center;">
            <div style="font-size:2rem;margin-bottom:6px;">📄</div>
            <div style="font-family:var(--font-cond);font-weight:700;font-size:13px;color:var(--white);">Click to select CSV file</div>
            <div style="font-size:11px;color:var(--silver);margin-top:4px;">Only .csv files · Max 500 rows</div>
          </div>
        </label>
      </div>
    </div>

    <!-- STEP 4: Preview & Import -->
    <div id="bulk-preview-section" style="display:none;margin-top:16px;">
      <div class="bulk-step-card">
        <div class="bulk-step-header">
          <div class="bulk-step-num">4</div>
          <div style="flex:1;">
            <div class="bulk-step-title">Preview &amp; Import</div>
            <div class="bulk-step-sub" id="bulk-preview-subtitle">Review your products before importing.</div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap;">
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('csv-file-input').value='';document.getElementById('bulk-preview-section').style.display='none';bulkRows=[];">✕ Clear</button>
            <button class="btn btn-blue btn-sm" id="bulk-import-btn" onclick="runBulkImport()">
              <span id="bulk-import-label">⬆ Import All Products</span>
            </button>
          </div>
        </div>

        <!-- Progress bar -->
        <div id="bulk-import-progress" style="display:none;margin-top:14px;">
          <div style="height:6px;background:var(--dark-3);border-radius:3px;overflow:hidden;">
            <div id="bulk-progress-bar" style="height:100%;background:linear-gradient(90deg,var(--blue-deep),var(--blue));width:0%;transition:width 0.3s;border-radius:3px;"></div>
          </div>
          <div id="bulk-progress-label" style="font-size:11px;color:var(--silver);margin-top:6px;font-family:var(--font-cond);"></div>
        </div>

        <!-- Results summary -->
        <div id="bulk-import-results" style="display:none;margin-top:12px;"></div>

        <!-- Table preview -->
        <div style="margin-top:16px;overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;" id="bulk-preview-table">
            <thead>
              <tr style="background:var(--dark-3);">
                <th style="padding:8px 10px;text-align:left;font-family:var(--font-cond);font-size:10px;font-weight:700;letter-spacing:0.06em;color:var(--blue);border-bottom:1px solid var(--border-solid);">ROW</th>
                <th style="padding:8px 10px;text-align:left;font-family:var(--font-cond);font-size:10px;font-weight:700;letter-spacing:0.06em;color:var(--blue);border-bottom:1px solid var(--border-solid);">NAME</th>
                <th style="padding:8px 10px;text-align:left;font-family:var(--font-cond);font-size:10px;font-weight:700;letter-spacing:0.06em;color:var(--blue);border-bottom:1px solid var(--border-solid);">BRAND · CAT</th>
                <th style="padding:8px 10px;text-align:left;font-family:var(--font-cond);font-size:10px;font-weight:700;letter-spacing:0.06em;color:var(--blue);border-bottom:1px solid var(--border-solid);">PRICE</th>
                <th style="padding:8px 10px;text-align:left;font-family:var(--font-cond);font-size:10px;font-weight:700;letter-spacing:0.06em;color:var(--blue);border-bottom:1px solid var(--border-solid);">STOCK</th>
                <th style="padding:8px 10px;text-align:left;font-family:var(--font-cond);font-size:10px;font-weight:700;letter-spacing:0.06em;color:var(--blue);border-bottom:1px solid var(--border-solid);">IMAGE</th>
                <th style="padding:8px 10px;text-align:left;font-family:var(--font-cond);font-size:10px;font-weight:700;letter-spacing:0.06em;color:var(--blue);border-bottom:1px solid var(--border-solid);">STATUS</th>
              </tr>
            </thead>
            <tbody id="bulk-preview-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ---- CSV Template Download ----
window.downloadCSVTemplate = function() {
  const headers = ["name","category","brand","price","originalPrice","stock","badge","featured","sizes","description","image1","image2","image3"];
  const example1 = ["Nike Air Zoom Mercurial","shoes","Nike","2499","3499","15","hot","true","6,7,8,9,10","Premium lightweight football boots for maximum speed.","https://res.cloudinary.com/your-cloud/image/upload/example.jpg","",""];
  const example2 = ["Adidas Copa Pure","shoes","Adidas","1999","2999","8","","false","7,8,9,10","Classic leather upper with supreme touch.","https://res.cloudinary.com/your-cloud/image/upload/example2.jpg","",""];
  const example3 = ["Brazil 2026 Home Jersey","jersey","Nike","1299","1799","20","new","true","S,M,L,XL,XXL","Official Brazil 2026 home jersey.","https://res.cloudinary.com/your-cloud/image/upload/example3.jpg","",""];
  const example4 = ["Football Grip Socks","accessories","Adidas","299","499","50","","false","S,M,L,XL","Anti-slip grip socks for superior ball control.","https://res.cloudinary.com/your-cloud/image/upload/example4.jpg","",""];
  const csv = [headers, example1, example2, example3, example4].map(row => row.map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "psjh_bulk_upload_template.csv";
  a.click();
};

// ---- CSV Parser (Bug Fix: properly strips surrounding quotes from every field) ----
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // FIX: Parse a single CSV line correctly handling quoted fields with commas inside
  function parseLine(line) {
    const values = [];
    let inQuote = false;
    let cur = "";
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        // Handle escaped double-quote ("") inside a quoted field
        if (inQuote && line[c + 1] === '"') {
          cur += '"';
          c++; // skip next quote
        } else {
          inQuote = !inQuote; // toggle quote mode but don't add the quote char
        }
      } else if (ch === "," && !inQuote) {
        values.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    values.push(cur.trim()); // FIX: push last field (no trailing comma)
    return values;
  }

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map(h => h.toLowerCase().trim());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (rows.length >= 500) { showToast("CSV truncated at 500 rows.", "error"); break; }
    const values = parseLine(line);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (values[idx] || "").trim(); });
    rows.push(obj);
  }
  return rows;
}

// ---- Row Validator (Bug Fix: removed hardcoded brand restriction; loosened category check) ----
function validateRow(row, idx) {
  const errors = [];
  if (!row.name) errors.push("name missing");

  // FIX: category check case-insensitive, trimmed
  const cat = (row.category || "").toLowerCase().trim();
  if (!["shoes", "jersey", "studs", "accessories"].includes(cat)) errors.push("category must be: shoes / jersey / studs / accessories");

  // FIX: brand — only require it to be non-empty (removed hardcoded Nike/Adidas/Mizuno restriction)
  if (!(row.brand || "").trim()) errors.push("brand missing");

  // price
  if (!row.price || isNaN(Number(row.price))) errors.push("price invalid");

  // FIX: key is lowercase after header normalisation → "originalprice"
  const origKey = row.originalprice !== undefined ? "originalprice" : "originalprice";
  if (!row[origKey] || isNaN(Number(row[origKey]))) errors.push("originalPrice invalid");
  if (Number(row.price) > Number(row[origKey])) errors.push("price > originalPrice");

  if (!row.image1) errors.push("image1 URL missing");
  return errors;
}

// ---- Handle CSV file pick ----
window.handleCSVUpload = function(input) {
  const file = input.files[0];
  if (!file) return;

  // FIX: validate file extension explicitly
  if (!file.name.toLowerCase().endsWith(".csv")) {
    showToast("Please select a valid .csv file.", "error");
    input.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => { showToast("Failed to read file.", "error"); };
  reader.onload = (e) => {
    try {
      const text = e.target.result;
      const rows = parseCSV(text);
      if (!rows.length) { showToast("CSV appears empty or has no data rows.", "error"); return; }
      bulkRows = rows;
      renderBulkPreview(rows);
      // FIX: reset progress/results from any previous run
      const progressWrap = document.getElementById("bulk-import-progress");
      const resultsEl = document.getElementById("bulk-import-results");
      const bar = document.getElementById("bulk-progress-bar");
      if (progressWrap) progressWrap.style.display = "none";
      if (resultsEl) resultsEl.style.display = "none";
      if (bar) bar.style.width = "0%";
      document.getElementById("bulk-preview-section").style.display = "block";
      document.getElementById("bulk-preview-section").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      showToast("Error parsing CSV: " + err.message, "error");
    }
  };
  reader.readAsText(file);
};

// ---- Preview Table ----
function renderBulkPreview(rows) {
  const tbody = document.getElementById("bulk-preview-tbody");
  const subtitle = document.getElementById("bulk-preview-subtitle");
  if (!tbody) return;

  let validCount = 0;
  let html = "";
  rows.forEach((row, idx) => {
    const errors = validateRow(row, idx);
    const isValid = errors.length === 0;
    if (isValid) validCount++;
    const imgUrl = row.image1 || "";
    const hasImg = imgUrl.startsWith("http");
    const rowBg = idx % 2 === 0 ? "var(--dark-2)" : "var(--dark-3)";
    html += `
      <tr id="bulk-row-${idx}" style="background:${rowBg};transition:opacity 0.3s;">
        <td style="padding:8px 10px;font-family:var(--font-cond);font-size:11px;color:var(--silver);border-bottom:1px solid var(--border-solid);">${idx + 1}</td>
        <td style="padding:8px 10px;font-weight:600;font-size:12px;border-bottom:1px solid var(--border-solid);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${row.name || ""}">${row.name || "—"}</td>
        <td style="padding:8px 10px;font-size:11px;color:var(--silver);border-bottom:1px solid var(--border-solid);">${row.brand || "—"} · ${row.category || "—"}</td>
        <td style="padding:8px 10px;font-size:12px;color:var(--blue);font-family:var(--font-display);border-bottom:1px solid var(--border-solid);">₹${row.price || "—"}<span style="color:var(--silver);font-size:10px;text-decoration:line-through;margin-left:4px;">₹${row.originalprice || ""}</span></td>
        <td style="padding:8px 10px;font-size:12px;border-bottom:1px solid var(--border-solid);">${row.stock || "10"}</td>
        <td style="padding:8px 10px;border-bottom:1px solid var(--border-solid);">
          ${hasImg
            ? `<img src="${imgUrl}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;border:1px solid var(--border-solid);" onerror="this.style.display='none';this.nextSibling.style.display='block'"/><span style="display:none;font-size:10px;color:var(--red);">Bad URL</span>`
            : `<span style="font-size:10px;color:var(--silver);">No image</span>`
          }
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid var(--border-solid);" id="bulk-row-status-${idx}">
          ${isValid
            ? `<span style="color:var(--green);font-family:var(--font-cond);font-size:10px;font-weight:700;">✓ READY</span>`
            : `<span style="color:var(--red);font-family:var(--font-cond);font-size:10px;font-weight:700;" title="${errors.join(", ")}">✕ ${errors[0]}${errors.length > 1 ? ` +${errors.length - 1}` : ""}</span>`
          }
        </td>
      </tr>`;
  });

  tbody.innerHTML = html;
  const errorCount = rows.length - validCount;
  if (subtitle) {
    subtitle.innerHTML = `<span style="color:var(--green);">✓ ${validCount} ready</span>${errorCount > 0 ? ` · <span style="color:var(--red);">✕ ${errorCount} with errors (will be skipped)</span>` : ""} · ${rows.length} total rows`;
  }
  // FIX: enable import button in case it was disabled from a previous run
  const btn = document.getElementById("bulk-import-btn");
  const label = document.getElementById("bulk-import-label");
  if (btn) btn.disabled = false;
  if (label) label.textContent = "⬆ Import All Products";
}

// ---- Run Bulk Import ----
window.runBulkImport = async function() {
  const validRows = bulkRows.filter((r, i) => validateRow(r, i).length === 0);
  if (!validRows.length) { showToast("No valid rows to import.", "error"); return; }

  const btn = document.getElementById("bulk-import-btn");
  const label = document.getElementById("bulk-import-label");
  const progressWrap = document.getElementById("bulk-import-progress");
  const bar = document.getElementById("bulk-progress-bar");
  const progressLabel = document.getElementById("bulk-progress-label");
  const resultsEl = document.getElementById("bulk-import-results");

  if (btn) btn.disabled = true;
  if (label) label.textContent = "⏳ Importing...";
  if (progressWrap) progressWrap.style.display = "block";
  if (bar) bar.style.width = "0%";
  if (resultsEl) resultsEl.style.display = "none";

  let imported = 0, failed = 0;
  const failedNames = [];

  try {
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const pct = Math.round((i / validRows.length) * 100);
      if (bar) bar.style.width = pct + "%";
      if (progressLabel) progressLabel.textContent = `Importing ${i + 1} of ${validRows.length}: "${row.name}"`;

      try {
        const images = [row.image1, row.image2, row.image3].filter(u => u && u.startsWith("http"));

        // FIX: sizes — handle both comma inside quotes and plain comma-separated
        const sizesRaw = (row.sizes || "").replace(/^"|"$/g, "");
        const sizes = sizesRaw.split(",").map(s => s.trim()).filter(Boolean);

        // FIX: brand capitalisation — title-case the whole word, not just first char
        const brandRaw = (row.brand || "").trim();
        const brandFormatted = brandRaw.charAt(0).toUpperCase() + brandRaw.slice(1);

        const productData = {
          name: row.name,
          category: (row.category || "").toLowerCase().trim(),
          brand: brandFormatted,
          price: Number(row.price),
          originalPrice: Number(row.originalprice),
          stock: Number(row.stock) || 10,
          badge: row.badge || null,
          featured: (row.featured || "").toLowerCase() === "true",
          sizes: sizes.length ? sizes : ["S", "M", "L", "XL"],
          description: row.description || "Premium football product.",
          images: images.length ? images : ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80"],
          features: [], specs: {}, rating: 4.5, reviews: 0,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        };

        await addDoc(collection(db, "products"), productData);
        imported++;

        // Update that row's status cell in the preview table
        const originalIdx = bulkRows.findIndex(r => r === row);
        const statusCell = document.getElementById(`bulk-row-status-${originalIdx}`);
        if (statusCell) statusCell.innerHTML = `<span style="color:var(--green);font-family:var(--font-cond);font-size:10px;font-weight:700;">✓ IMPORTED</span>`;

      } catch (rowErr) {
        failed++;
        failedNames.push(row.name);
        console.error("[BulkImport] Failed row:", row.name, rowErr.message);
        // Mark that row as failed in the UI
        const originalIdx = bulkRows.findIndex(r => r === row);
        const statusCell = document.getElementById(`bulk-row-status-${originalIdx}`);
        if (statusCell) statusCell.innerHTML = `<span style="color:var(--red);font-family:var(--font-cond);font-size:10px;font-weight:700;" title="${rowErr.message}">✕ FAILED</span>`;
      }
    }
  } finally {
    // FIX: always restore UI state even if an unexpected error occurs
    if (bar) bar.style.width = "100%";
    if (progressLabel) progressLabel.textContent = imported > 0 ? "Complete!" : "No products imported.";
    if (btn) btn.disabled = false;
    if (label) label.textContent = "⬆ Import All Products";

    // FIX: hide progress bar after a short delay so user sees 100%
    setTimeout(() => {
      if (progressWrap) progressWrap.style.display = "none";
      if (bar) bar.style.width = "0%";
    }, 1500);
  }

  await loadProducts();

  if (resultsEl) {
    resultsEl.style.display = "block";
    resultsEl.innerHTML = `
      <div style="background:${failed === 0 ? "rgba(63,185,80,0.08)" : "rgba(248,81,73,0.08)"};border:1px solid ${failed === 0 ? "rgba(63,185,80,0.25)" : "rgba(248,81,73,0.25)"};border-radius:var(--radius-sm);padding:14px 16px;">
        <div style="font-family:var(--font-cond);font-weight:700;font-size:14px;color:${failed === 0 ? "var(--green)" : "var(--orange)"};">
          ${failed === 0 ? "✓ All products imported successfully!" : `⚠ ${imported} imported, ${failed} failed`}
        </div>
        ${failed > 0 ? `<div style="font-size:11px;color:var(--silver);margin-top:6px;">Failed: ${failedNames.join(", ")}</div>` : ""}
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" onclick="showSection('products',document.querySelectorAll('.admin-nav-item')[2])">View Products →</button>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('csv-file-input').value='';document.getElementById('bulk-preview-section').style.display='none';bulkRows=[];renderBulkUpload();">Upload Another CSV</button>
        </div>
      </div>`;
  }

  showToast(`${imported} product${imported !== 1 ? "s" : ""} imported ✓`);
};

window.renderBulkUpload = renderBulkUpload;

document.addEventListener("DOMContentLoaded", () => {
  initLoginKeyHandler();
  if (checkLoginState()) {
    showAdminApp();
    initAdminApp();
  } else {
    showLoginScreen();
  }
});
