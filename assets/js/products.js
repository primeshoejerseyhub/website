// ============================================
// PRIME SHOE JERSEY HUB — Products v5
// ============================================

import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ---- Global in-memory cache ----
window.PRODUCTS = [];

// ---- Fetch all products from Firestore ----
export async function fetchAllProducts() {
  try {
    console.log("[Products] Fetching from Firestore...");
    const snap = await getDocs(collection(db, "products"));
    window.PRODUCTS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log("[Products] Loaded " + window.PRODUCTS.length + " products.");
    return window.PRODUCTS;
  } catch (err) {
    console.error("[Products] Fetch error:", err);
    return [];
  }
}

export async function fetchProductById(id) {
  try {
    const cached = window.PRODUCTS.find(p => p.id === id);
    if (cached) return cached;
    const snap = await getDoc(doc(db, "products", id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (err) {
    console.error("[Products] fetchProductById error:", err);
    return null;
  }
}

// ---- Helpers ----
window.getProductById = function(id) {
  return window.PRODUCTS.find(p => p.id === String(id) || p.id === id) || null;
};
window.getProductsByCategory = function(cat) {
  return cat === "all" ? window.PRODUCTS : window.PRODUCTS.filter(p => p.category === cat);
};
window.getFeaturedProducts = function() {
  return window.PRODUCTS.filter(p => p.featured === true);
};
window.getRelatedProducts = function(product, limit) {
  limit = limit || 4;
  return window.PRODUCTS.filter(p => p.category === product.category && p.id !== product.id).slice(0, limit);
};
window.getDiscountPct = function(product) {
  if (!product.originalPrice || product.originalPrice <= product.price) return 0;
  return Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
};
window.formatPrice = function(n) {
  return "₹" + Number(n).toLocaleString("en-IN");
};
window.BADGE_CONFIG = {
  bestseller: { label: "Best Seller", cls: "badge-blue" },
  new:        { label: "New",         cls: "badge-white" },
  sale:       { label: "Sale",        cls: "badge-red" },
};

// ============================================
// REVIEWS — Firestore subcollection
// Path: products/{productId}/reviews/{reviewId}
//
// ⚠️  FIRESTORE RULES REQUIRED (see below):
//   match /products/{productId}/reviews/{reviewId} {
//     allow read: if true;
//     allow create: if true;
//     allow delete: if true;
//   }
// ============================================

window.getReviewsFromFirestore = async function(productId) {
  try {
    // NO orderBy — avoids needing a composite index
    const snap = await getDocs(collection(db, "products", productId, "reviews"));
    const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort client-side by date descending
    reviews.sort((a, b) => {
      const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return tb - ta;
    });
    console.log("[Reviews] Fetched", reviews.length, "reviews for product", productId);
    return reviews;
  } catch (err) {
    console.error("[Reviews] getReviewsFromFirestore FAILED for", productId, ":", err.code, err.message);
    // Log the specific error so developer can diagnose
    if (err.code === "permission-denied") {
      console.error("[Reviews] ❌ PERMISSION DENIED — Fix your Firestore security rules! See instructions in products.js");
    }
    return window.getReviewsLocal(productId);
  }
};

window.saveReviewToFirestore = async function(productId, review) {
  try {
    const reviewData = {
      author: review.name || review.author || "Anonymous",
      name:   review.name || review.author || "Anonymous",
      rating: Number(review.rating) || 5,
      comment: review.text || review.comment || "",
      text:    review.text || review.comment || "",
      createdAt: serverTimestamp(),
      date: new Date().toLocaleDateString("en-IN"),
    };

    console.log("[Reviews] Attempting to save to Firestore:", productId, reviewData);

    const ref = await addDoc(
      collection(db, "products", productId, "reviews"),
      reviewData
    );

    console.log("[Reviews] ✅ Saved to Firestore! Doc ID:", ref.id);
    // Also cache locally as backup
    window.saveReviewLocal(productId, Object.assign({ id: ref.id }, reviewData));
    return ref.id;

  } catch (err) {
    console.error("[Reviews] ❌ saveReviewToFirestore FAILED:", err.code, err.message);
    if (err.code === "permission-denied") {
      console.error("[Reviews] ❌ FIRESTORE RULES ARE BLOCKING WRITES.");
      console.error("[Reviews] Go to Firebase Console → Firestore → Rules and add:");
      console.error(`
  match /products/{productId}/reviews/{reviewId} {
    allow read: if true;
    allow create: if true;
    allow delete: if true;
  }
      `);
    }
    // Fallback: save to localStorage only
    window.saveReviewLocal(productId, review);
    throw err; // Re-throw so submitReview can show the user an error
  }
};

// ---- localStorage helpers ----
window.getReviewsLocal = function(productId) {
  try { return JSON.parse(localStorage.getItem("reviews_" + productId) || "[]"); }
  catch(e) { return []; }
};
window.saveReviewLocal = function(productId, review) {
  const reviews = window.getReviewsLocal(productId);
  reviews.unshift(review);
  localStorage.setItem("reviews_" + productId, JSON.stringify(reviews));
};

// Legacy aliases
window.getReviews = window.getReviewsLocal;
window.saveReview = window.saveReviewLocal;
