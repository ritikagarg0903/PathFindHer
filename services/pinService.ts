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
  apiKey: "YOUR_API_KEY",
  authDomain: "walksafe-4f50f.firebaseapp.com",
  projectId: "walksafe-4f50f",
  storageBucket: "walksafe-4f50f.firebasestorage.app",
  messagingSenderId: "261622392224",
  appId: "1:261622392224:web:b9019b4664f5227ffef0c5",
  databaseURL: "https://walksafe-4f50f-default-rtdb.firebaseio.com"
};
  

// Check if config is set
const USE_FIREBASE = FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY";

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
  console.log("Using Local Storage (Update FIREBASE_CONFIG in services/pinService.ts to use Database)");
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
  if (USE_FIREBASE && db) {
    // Strategy 1: Attempt to delete directly by key (Correct way for new pins)
    // Even if it doesn't exist, this operation is safe.
    try {
        const directRef = ref(db, `pins/${pinId}`);
        await remove(directRef);
    } catch (e) {
        console.warn("Direct delete failed, trying query...", e);
    }

    // Strategy 2: Fallback query for legacy pins (where ID stored in object != Firebase Key)
    // We do this to ensure older data can still be deleted.
    const pinsRef = ref(db, 'pins');
    const q = query(pinsRef, orderByChild('id'), equalTo(pinId));
    
    try {
        const snapshot = await get(q);
        if (snapshot.exists()) {
            const updates: Promise<void>[] = [];
            snapshot.forEach((childSnapshot) => {
                updates.push(remove(childSnapshot.ref));
            });
            await Promise.all(updates);
        }
    } catch (error) {
        console.error("Error removing pin via query:", error);
        throw error;
    }
  } else {
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
  // Only seed if local storage is empty and we aren't using Firebase (Firebase usually persists)
  // Or if we are using Firebase but it's empty? 
  // For simplicity, we only seed local storage to avoid spamming the shared DB if one is eventually set up.
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