// ============================================
// PRIME SHOE JERSEY HUB — App v4 (Fixed)
// ============================================

import { fetchAllProducts } from "./products.js";

// ---- STORE CONFIG ----
const STORE_CONFIG = {
  upiId: "primeshoejerseyh@upi",
  whatsappNumber: "919239394022",
  storeName: "Prime Shoe Jersey Hub",
};

// ---- NAVBAR ----
function initNavbar() {
  const navbar = document.getElementById("navbar");
  if (!navbar) return;

  window.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", window.scrollY > 20);
  }, { passive: true });

  const hamburger = document.getElementById("hamburger");
  const mobileNav = document.getElementById("mobile-nav");
  if (hamburger && mobileNav) {
    hamburger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = mobileNav.classList.toggle("open");
      const lines = hamburger.querySelectorAll(".hamburger-lines span");
      if (isOpen) {
        lines[0].style.transform = "rotate(45deg) translate(5px,5px)";
        lines[1].style.opacity = "0";
        lines[2].style.transform = "rotate(-45deg) translate(5px,-5px)";
      } else {
        lines[0].style.transform = "";
        lines[1].style.opacity = "";
        lines[2].style.transform = "";
      }
    });
    document.addEventListener("click", e => {
      if (!hamburger.contains(e.target) && !mobileNav.contains(e.target)) {
        mobileNav.classList.remove("open");
      }
    });
  }

  // Mark active nav link
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-link, .mobile-nav-link").forEach(link => {
    const href = link.getAttribute("href") || "";
    if (href === currentPage || (currentPage === "" && href === "index.html")) {
      link.classList.add("active");
    }
  });
}

// ---- SEARCH (Fixed: mobile click/touch + Enter + icon click) ----
function initSearch() {
  const input = document.getElementById("nav-search-input");
  const dropdown = document.getElementById("search-results-dropdown");
  // Mobile search overlay elements
  const mobileSearchBtn = document.getElementById("mobile-search-btn");
  const mobileSearchOverlay = document.getElementById("mobile-search-overlay");
  const mobileInput = document.getElementById("mobile-search-input");
  const mobileDropdown = document.getElementById("mobile-search-dropdown");
  const mobileCloseBtn = document.getElementById("mobile-search-close");

  function doSearch(q, targetDropdown) {
    if (!q || q.length < 2) {
      targetDropdown && targetDropdown.classList.remove("active");
      return;
    }
    const results = (window.PRODUCTS || []).filter(p =>
      (p.name || "").toLowerCase().includes(q) ||
      (p.brand || "").toLowerCase().includes(q) ||
      (p.category || "").toLowerCase().includes(q)
    ).slice(0, 6);

    if (!results.length) {
      targetDropdown && targetDropdown.classList.remove("active");
      return;
    }

    if (!targetDropdown) return;
    targetDropdown.innerHTML = results.map(p => `
      <div class="search-result-item" onclick="window.location='product.html?id=${p.id}'">
        <img src="${(p.images || [])[0] || ""}" alt="${p.name}"
          onerror="this.src='https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100&q=60'" />
        <div style="flex:1;min-width:0;">
          <div class="name">${p.name}</div>
          <div class="price">${formatPrice(p.price)}</div>
        </div>
        <span style="font-family:var(--font-cond);font-size:10px;font-weight:700;color:var(--silver);text-transform:uppercase;letter-spacing:0.1em;">${p.category}</span>
      </div>`).join("");
    targetDropdown.classList.add("active");
  }

  function navigateSearch(val) {
    if (val && val.trim()) {
      window.location = `shop.html?q=${encodeURIComponent(val.trim())}`;
    }
  }

  // --- Desktop search ---
  if (input && dropdown) {
    input.addEventListener("input", () => {
      doSearch(input.value.trim().toLowerCase(), dropdown);
    });
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") navigateSearch(input.value);
      if (e.key === "Escape") { dropdown.classList.remove("active"); input.blur(); }
    });
    // Search icon click — focus input
    const searchIcon = input.closest(".nav-search")?.querySelector(".nav-search-icon");
    if (searchIcon) {
      searchIcon.style.cursor = "pointer";
      searchIcon.style.pointerEvents = "auto";
      searchIcon.addEventListener("click", () => { input.focus(); });
      searchIcon.addEventListener("touchend", (e) => { e.preventDefault(); input.focus(); });
    }
    document.addEventListener("click", e => {
      const wrap = input.closest(".nav-search");
      if (wrap && !wrap.contains(e.target)) dropdown.classList.remove("active");
    });
  }

  // --- Mobile search overlay ---
  if (mobileSearchBtn && mobileSearchOverlay) {
    function openMobileSearch() {
      mobileSearchOverlay.classList.add("open");
      document.body.style.overflow = "hidden";
      setTimeout(() => mobileInput && mobileInput.focus(), 120);
    }
    function closeMobileSearch() {
      mobileSearchOverlay.classList.remove("open");
      document.body.style.overflow = "";
      if (mobileInput) mobileInput.value = "";
      if (mobileDropdown) mobileDropdown.classList.remove("active");
    }

    mobileSearchBtn.addEventListener("click", openMobileSearch);
    mobileSearchBtn.addEventListener("touchend", (e) => { e.preventDefault(); openMobileSearch(); });

    if (mobileCloseBtn) {
      mobileCloseBtn.addEventListener("click", closeMobileSearch);
      mobileCloseBtn.addEventListener("touchend", (e) => { e.preventDefault(); closeMobileSearch(); });
    }

    if (mobileInput) {
      mobileInput.addEventListener("input", () => {
        doSearch(mobileInput.value.trim().toLowerCase(), mobileDropdown);
      });
      mobileInput.addEventListener("keydown", e => {
        if (e.key === "Enter") { closeMobileSearch(); navigateSearch(mobileInput.value); }
        if (e.key === "Escape") closeMobileSearch();
      });
    }

    // Close on overlay backdrop tap
    mobileSearchOverlay.addEventListener("click", (e) => {
      if (e.target === mobileSearchOverlay) closeMobileSearch();
    });
  }
}

// ---- HERO SLIDER ----
const HERO_SLIDES = [
  "assets/images/reviews/review1.jpg",
  "assets/images/reviews/review2.jpg",
  "assets/images/reviews/review3.jpg",
  "assets/images/reviews/review4.jpg",
  "assets/images/reviews/review5.jpg",
  "assets/images/reviews/review6.jpg",
];

function initHeroSlider() {
  const slider = document.getElementById("hero-slider");
  const dotsContainer = document.getElementById("hero-dots");
  if (!slider) return;
  let current = 0;

  HERO_SLIDES.forEach((src, i) => {
    const slide = document.createElement("div");
    slide.className = `hero-slide${i === 0 ? " active" : ""}`;
    slide.style.backgroundImage = `url(${src})`;
    slider.appendChild(slide);
  });

  if (dotsContainer) {
    HERO_SLIDES.forEach((_, i) => {
      const dot = document.createElement("div");
      dot.className = `hero-dot${i === 0 ? " active" : ""}`;
      dot.onclick = () => goToSlide(i);
      dotsContainer.appendChild(dot);
    });
  }

  function goToSlide(idx) {
    slider.querySelectorAll(".hero-slide").forEach((s, i) => s.classList.toggle("active", i === idx));
    dotsContainer?.querySelectorAll(".hero-dot").forEach((d, i) => d.classList.toggle("active", i === idx));
    current = idx;
  }

  setInterval(() => goToSlide((current + 1) % HERO_SLIDES.length), 5000);
}

// ---- PRODUCT CARD BUILDER ----
window.buildProductCard = function(product, opts = {}) {
  const { showQuickAdd = true } = opts;
  const disc = getDiscountPct(product);
  const badge = BADGE_CONFIG[product.badge];
  const stars = "★".repeat(Math.floor(Number(product.rating) || 4));
  const isOOS = product.stock === 0;
  const stockPct = Math.min(100, ((product.stock || 0) / 20) * 100);
  const imgSrc = (product.images || [])[0] || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=60";

  return `
    <div class="product-card reveal${isOOS ? " out-of-stock" : ""}"
      onclick="${isOOS ? "" : `window.location='product.html?id=${product.id}'`}"
      style="cursor:${isOOS ? "default" : "pointer"};">
      <div class="product-card-img">
        <img src="${imgSrc}" alt="${product.name}" loading="lazy"
          onerror="this.src='https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=60'" />
        <div class="product-card-badges">
          ${badge ? `<span class="badge ${badge.cls}">${badge.label}</span>` : ""}
          ${product.stock > 0 && product.stock <= 5 ? `<span class="badge badge-red">Only ${product.stock} left</span>` : ""}
          ${isOOS ? `<span class="badge badge-dark">Out of Stock</span>` : ""}
        </div>
        <div class="product-card-discount"><span class="badge badge-dark">-${disc}%</span></div>
        ${showQuickAdd && !isOOS ? `
          <div class="product-card-actions">
            <button class="btn btn-blue btn-sm btn-full"
              onclick="event.stopPropagation();quickAddToCart('${product.id}')">
              + Add to Cart
            </button>
          </div>` : ""}
        <div class="product-card-stock-bar" style="width:${stockPct}%"></div>
      </div>
      <div class="product-card-body">
        <div class="product-card-cat">${product.brand} · ${product.category}</div>
        <div class="product-card-name">${product.name}</div>
        <div class="product-card-rating">
          <span class="stars" style="color:var(--orange);font-size:11px;">${stars}</span>
          <span class="rating-count" style="font-size:11px;color:var(--silver);">(${product.reviews || 0})</span>
        </div>
        <div class="product-card-price">
          <span class="price-current">${formatPrice(product.price)}</span>
          <span class="price-original">${formatPrice(product.originalPrice)}</span>
        </div>
      </div>
    </div>`;
};

// ---- PAGE RENDER ----
function renderIndexPage() {
  const grid = document.getElementById("featured-grid");
  if (!grid) return;
  const featured = getFeaturedProducts().slice(0, 8);
  if (featured.length === 0) {
    grid.innerHTML = `<p style="color:var(--silver);text-align:center;grid-column:1/-1;">No featured products yet. Add some from the admin panel.</p>`;
    return;
  }
  grid.innerHTML = featured.map(p => buildProductCard(p)).join("");
}

function renderShopPage() {
  if (!document.getElementById("shop-products-grid")) return;
  if (typeof window.renderShop === "function") window.renderShop();
}

function renderProductPage() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id || !document.getElementById("pdp-layout")) return;
  const product = getProductById(id);
  if (!product) {
    document.getElementById("pdp-layout").innerHTML = `
      <div style="padding:40px;text-align:center;color:var(--silver);">
        <div style="font-size:3rem;margin-bottom:16px;">🔍</div>
        <div style="font-family:var(--font-cond);font-size:1.2rem;font-weight:700;text-transform:uppercase;">Product Not Found</div>
        <p style="margin-top:8px;">This product may have been removed or the link is incorrect.</p>
        <a href="shop.html" class="btn btn-blue" style="margin-top:20px;display:inline-block;">Browse All Products</a>
      </div>`;
    return;
  }
  if (typeof window.renderProduct === "function") window.renderProduct(product);
}

// ---- SCROLL REVEAL ----
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" });

  function observeAll() {
    document.querySelectorAll(".reveal:not(.visible)").forEach(el => observer.observe(el));
  }
  observeAll();
  new MutationObserver(observeAll).observe(document.body, { childList: true, subtree: true });
}

// ---- RIPPLE ----
function initRipple() {
  document.addEventListener("click", e => {
    const btn = e.target.closest(".btn");
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
}

// ---- TICKER ----
function initTicker() {
  document.querySelectorAll(".ticker-track").forEach(track => {
    track.innerHTML += track.innerHTML;
  });
}

// ---- WHATSAPP FLOAT ----
function buildWAButton() {
  if (document.querySelector(".wa-float")) return;
  const btn = document.createElement("a");
  btn.href = `https://wa.me/${STORE_CONFIG.whatsappNumber}?text=Hi%20${encodeURIComponent(STORE_CONFIG.storeName)}%2C%20I%20need%20help!`;
  btn.target = "_blank";
  btn.className = "wa-float";
  btn.title = "Chat on WhatsApp";
  btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;
  document.body.appendChild(btn);
}

// ---- MAIN INIT ----
document.addEventListener("DOMContentLoaded", async () => {
  console.log("[App] Initializing...");

  // Show loading skeleton state is already in HTML

  // Load products from Firebase
  try {
    await fetchAllProducts();
  } catch (err) {
    console.error("[App] Failed to load products:", err);
  }

  // Init UI
  initNavbar();
  initSearch();
  initHeroSlider();
  initScrollReveal();
  initRipple();
  initTicker();
  buildWAButton();

  // Page-specific rendering
  renderIndexPage();
  renderShopPage();
  renderProductPage();

  console.log("[App] Ready.");
});
