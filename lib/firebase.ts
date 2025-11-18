import { initializeApp } from "firebase/app"
import { getFirestore, doc, getDoc } from "firebase/firestore" // Added doc and getDoc imports
import { getAuth, connectAuthEmulator } from "firebase/auth"
import { getStorage } from "firebase/storage"
import { getAnalytics } from "firebase/analytics";
import Oohdb from "oohdb"

const firebaseConfig = {
  apiKey: "AIzaSyBByUHvQmjYdalF2C1UIpzn-onB3iXGMhc",
  authDomain: "oh-app-bcf24.firebaseapp.com",
  projectId: "oh-app-bcf24",
  storageBucket: "oh-app-bcf24.appspot.com",
  messagingSenderId: "272363630855",
  appId: "1:272363630855:web:820601c723e85625d915a2",
  measurementId: "G-7CPDJLG85K"
};

export const dbase = new Oohdb(firebaseConfig);



// Tenant ID for OHPLUS
export const TENANT_ID = "ohplus-07hsi"

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
