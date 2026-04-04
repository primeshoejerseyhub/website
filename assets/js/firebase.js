// ============================================
// PRIME SHOE JERSEY HUB — Firebase v12 Setup
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ⚠️  NOTE: Firebase v12 does NOT exist yet — latest stable is 10.x
// Using v10.12.0 (stable, modular). Replace config values if you regenerate.
const firebaseConfig = {
  apiKey: "AIzaSyD0_KBiJmNgbfm47sA568eNePhwbCsVKi4",
  authDomain: "prime-shoe-jersey-hub.firebaseapp.com",
  projectId: "prime-shoe-jersey-hub",
  storageBucket: "prime-shoe-jersey-hub.appspot.com",
  messagingSenderId: "955002913804",
  appId: "1:955002913804:web:c04c748059a598458b9a29"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// Export db for use in all other modules
export { db };
