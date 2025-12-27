## PathFindHer: Walk Without Fear 🛡️

**PathFindHer** is a navigation tool built on a "Women Safety First" philosophy, replacing the "fastest route" with the "safest route." By combining crowdsourced community vigilance with advanced AI grounding, we empower women to reclaim their cities and navigate urban environments with confidence.

### 🚨 The Problem

For many women, navigating a city (especially at night) is an exercise in risk assessment. Standard navigation apps prioritize speed, often directing pedestrians through poorly lit alleys, isolated parks, or construction zones. There is a critical lack of real-time, street-level data regarding lighting conditions, harassment hotspots, and active safety. Current tools tell you *where* to go, but they don't tell you *how safe* it is to get there.

### 💡 The Solution

PathFindHer bridges the gap between navigation and personal security. It is a community-driven platform where users contribute real-time safety data. By integrating Gemini 2.5 Flash, the app doesn't just show a map; it "understands" the environment. It verifies safe havens, analyzes neighborhood composition, and calculates detours that avoid user-reported danger zones, ensuring that peace of mind is the top priority.

### ✨ Key Features

* **📍 Community Safety Mapping:** Users drop color-coded pins (Safe, Caution, Danger) to report broken streetlights, isolated areas, or well-lit zones.
* **🤖 AI Safety Advisor:** Powered by Gemini 2.5 Flash with Google Maps Grounding, this feature scans the user’s immediate area to identify and verify 24/7 "Safe Havens" like hospitals and police stations.
* **🧭 Safe Routing:** An intelligent navigation algorithm that suggests paths based on community ratings, actively offering detours to avoid high-risk markers.
* **📱 Instant Context:** AI-generated summaries of your route’s safety profile, providing tips based on whether an area is residential, industrial, or high-traffic.

### 🛠️ Tech Stack

* **Frontend:** React (TypeScript) & Tailwind CSS for a responsive, mobile-first UI.
* **Mapping:** Leaflet.js and Google Maps API for interactive spatial data.
* **AI Engine:** Google Gemini API (Model: `gemini-2.5-flash`) for environmental analysis.
* **AI Grounding:** Google Maps Grounding Tool to ensure safe haven data is factually accurate.
* **Database:** Firebase Realtime Database for instantaneous community pin updates.