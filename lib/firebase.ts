import { initializeApp } from "firebase/app"
import { getFirestore, doc, getDoc } from "firebase/firestore" // Added doc and getDoc imports
import { getAuth, connectAuthEmulator } from "firebase/auth"
import { getStorage } from "firebase/storage"
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID!
};


// Tenant ID for OHPLUS
export const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID!

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
