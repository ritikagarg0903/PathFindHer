import { Pin, SafetyLevel } from "../types";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, onValue, set, query, orderByChild, equalTo, get, remove } from "firebase/database";

// --- Configuration ---
// TO ENABLE CLOUD DATABASE: Replace with your Firebase Config
// 1. Go to console.firebase.google.com
// 2. Create a project
// 3. Add a Web App
// 4. Copy the config object below
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY", // Make sure this is your actual API Key
  authDomain: "walksafe-4f50f.firebaseapp.com",
  projectId: "walksafe-4f50f",
  storageBucket: "walksafe-4f50f.firebasestorage.app",
  messagingSenderId: "261622392224",
  appId: "1:261622392224:web:b9019b4664f5227ffef0c5",
  databaseURL: "https://walksafe-4f50f-default-rtdb.firebaseio.com"
};

// Check if config is set
// You confirmed you have permissions, so we default this to TRUE.
// Ensure FIREBASE_CONFIG above is populated correctly.
const USE_FIREBASE = true;

// --- Firebase Setup ---
let db: any;
if (USE_FIREBASE) {
  try {
    const app = initializeApp(FIREBASE_CONFIG);
    db = getDatabase(app);
    console.log("Firebase initialized");
  } catch (e) {
    console.warn("Firebase init failed, falling back to local storage", e);
  }
} else {
  console.log("Using Local Storage");
}

const STORAGE_KEY = 'safe_walk_pins_db';

// --- Services ---

// Subscribe to pins (Realtime)
export const subscribeToPins = (callback: (pins: Pin[]) => void): (() => void) => {
  if (USE_FIREBASE && db) {
    const pinsRef = ref(db, 'pins');
    const unsubscribe = onValue(pinsRef, (snapshot) => {
      const data = snapshot.val();
      const loadedPins: Pin[] = data ? Object.values(data) : [];
      callback(loadedPins);
    });
    return () => unsubscribe();
  } else {
    // Local Storage Fallback with Event Listening
    const loadLocal = () => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            callback(stored ? JSON.parse(stored) : []);
        } catch (e) {
            callback([]);
        }
    };
    
    // Initial Load
    loadLocal();
    
    // Listen for updates
    const storageHandler = (e: StorageEvent) => {
        if (e.key === STORAGE_KEY) loadLocal();
    };
    
    const localHandler = () => loadLocal();

    window.addEventListener('storage', storageHandler);
    window.addEventListener('local-storage-update', localHandler);
    
    return () => {
        window.removeEventListener('storage', storageHandler);
        window.removeEventListener('local-storage-update', localHandler);
    };
  }
};

// Add a new pin
export const addPin = async (pin: Omit<Pin, 'id' | 'timestamp'>): Promise<Pin> => {
  if (USE_FIREBASE && db) {
    const pinsRef = ref(db, 'pins');
    const newPinRef = push(pinsRef);
    const key = newPinRef.key;

    // Use the Firebase key as the ID for easier deletion later
    const newPin: Pin = {
      ...pin,
      id: key || Math.random().toString(36).substring(2, 9), 
      timestamp: Date.now(),
    };

    await set(newPinRef, newPin);
    return newPin;
  } else {
    const newPin: Pin = {
        ...pin,
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
    };
    const currentPins = getLocalPinsSync();
    const updatedPins = [...currentPins, newPin];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPins));
    window.dispatchEvent(new Event('local-storage-update'));
    return newPin;
  }
};

// Remove a pin
export const removePin = async (pinId: string): Promise<void> => {
  console.log("SERVICE START: removePin called with ID:", pinId);
  
  if (USE_FIREBASE && db) {
    console.log("SERVICE: Attempting Firebase deletion...");
    const pinsRef = ref(db, 'pins');

    // Method 1: Robust Query (Recommended)
    // Find the node where the child property "id" equals pinId.
    const q = query(pinsRef, orderByChild('id'), equalTo(pinId));
    
    try {
        const snapshot = await get(q);
        
        if (snapshot.exists()) {
            console.log("SERVICE: Pin found via query. Removing...");
            const updates: Promise<void>[] = [];
            snapshot.forEach((childSnapshot) => {
                updates.push(remove(childSnapshot.ref));
            });
            await Promise.all(updates);
            console.log("SERVICE: Pin removed successfully via query.");
            return; // Exit if successful
        } else {
             console.log("SERVICE: Pin NOT found via query. Attempting direct path fallback...");
        }
    } catch (error) {
        console.error("SERVICE ERROR: Error removing pin via query:", error);
    }

    // Method 2: Direct Path Fallback
    try {
        const directRef = ref(db, `pins/${pinId}`);
        await remove(directRef);
        console.log("SERVICE: Direct path removal executed.");
    } catch (e) {
        console.error("SERVICE ERROR: Direct delete failed:", e);
        throw e;
    }

  } else {
    console.log("SERVICE: Removing from Local Storage...");
    const currentPins = getLocalPinsSync();
    const updatedPins = currentPins.filter(p => p.id !== pinId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPins));
    window.dispatchEvent(new Event('local-storage-update'));
  }
};

// Helper for local sync read (internal use)
const getLocalPinsSync = (): Pin[] => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) { return []; }
};

// Seed initial data if empty
export const seedData = (centerLat: number, centerLng: number) => {
  // Only seed if local storage is empty.
  if (!USE_FIREBASE && getLocalPinsSync().length === 0) {
    const seeds: Pin[] = [
      {
        id: '1',
        lat: centerLat + 0.001,
        lng: centerLng + 0.001,
        safetyLevel: SafetyLevel.SAFE,
        description: "Well lit street, lots of people walking dogs.",
        timestamp: Date.now(),
        userId: 'system'
      },
      {
        id: '2',
        lat: centerLat - 0.0015,
        lng: centerLng - 0.0005,
        safetyLevel: SafetyLevel.CAUTION,
        description: "Streetlight flickering near the corner.",
        timestamp: Date.now(),
        userId: 'system'
      },
      {
        id: '3',
        lat: centerLat + 0.002,
        lng: centerLng - 0.002,
        safetyLevel: SafetyLevel.DANGER,
        description: "Construction site, sidewalk closed, very dark.",
        timestamp: Date.now(),
        userId: 'system'
      }
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds));
    window.dispatchEvent(new Event('local-storage-update'));
  }
};