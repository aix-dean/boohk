import { initializeApp } from "firebase/app"
import { getFirestore, doc, getDoc } from "firebase/firestore" // Added doc and getDoc imports
import { getAuth, connectAuthEmulator } from "firebase/auth"
import { getStorage } from "firebase/storage"
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAuJBgnRqX5vMUJ4tEjEG9WhTkLMeb_AjY",
  authDomain: "oh-app---dev.firebaseapp.com",
  projectId: "oh-app---dev",
  storageBucket: "oh-app---dev.appspot.com",
  messagingSenderId: "1022252630221",
  appId: "1:1022252630221:web:801c11ff60dbb796b6e984",
  measurementId: "G-D3QGEWNM1D"
};


// Tenant ID for OHPLUS
export const TENANT_ID = "boohk-f9vhc"

const app = initializeApp(firebaseConfig)
let analytics;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

// Initialize regular auth (for backward compatibility)
export const auth = getAuth(app)

// Initialize tenant-specific auth for OHPLUS
export const tenantAuth = getAuth(app)
tenantAuth.tenantId = TENANT_ID

export const db = getFirestore(app)
export const storage = getStorage(app)

export { doc, getDoc }

export default app
