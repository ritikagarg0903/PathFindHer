<div align="center">
  <img src="PFH_logo.png" alt="PathFindHer Logo" width="200" />
</div>

# PathFindHer: Walk Without Fear 🛡️

## The Problem
Navigating urban environments, especially at night, presents unique safety challenges—particularly for women. Standard navigation apps prioritize speed and efficiency, often directing pedestrians through poorly lit alleys, construction zones, or isolated areas without considering personal security. There is a critical lack of real-time, community-driven data regarding street-level safety, lighting conditions, and potential harassment hotspots.

## The Solution
**PathFindHer** is a navigation tool built on a **"Women Safety First"** philosophy. It empowers users to reclaim their city by crowdsourcing safety data and providing immediate situational awareness. By combining community vigilance with advanced AI, the app prioritizes well-lit, populated, and verified safe paths over the fastest ones.

## Key Features

### 📍 Community Safety Mapping
*   **Drop Pins**: Users can tag locations as **Safe**, **Caution**, or **Danger**.
*   **Real-time Context**: Add descriptions specifically helpful for women's safety, such as "Streetlights broken," "Isolated area," or "Well-lit with security."
*   **Visual Indicators**: Color-coded markers allow for instant assessment of an area's safety profile before entering it.

### 🤖 AI Safety Advisor (Powered by Gemini)
*   **"Scan Area Safety"**: One-click AI analysis of the user's immediate surroundings.
*   **Verified Safe Havens**: Uses Gemini 2.5 Flash with Google Maps Grounding to strictly verify and list nearby **Police Stations**, **Hospitals**, **Transit Stations**, and **24/7 Businesses** where one can seek help.
*   **Contextual Summaries**: Provides a brief text summary of the area's composition (residential vs. industrial) and specific safety tips.

### 🧭 Safe Routing
*   **Intelligent Navigation**: Calculates walking directions that actively check against the community-reported "Danger" zones.
*   **Detour Logic**: If a direct route passes too close to a reported hazard, the algorithm attempts to calculate a detour to keep the user safe.
*   **Safety Notes**: The AI reviews the route summary to provide a final confidence check or warning before the user starts walking.

## Tech Stack

*   **Frontend**: React (TypeScript), Tailwind CSS
*   **Maps**: Leaflet.js, Google Maps
*   **AI & Data**: Google Gemini API (Model: `gemini-2.5-flash`), Google Maps Grounding Tool
*   **Backend / Database**: Firebase Realtime Database (for storing community pins)
*   **Icons**: Lucide React

## Setup

1.  Clone the repository.
2.  Install dependencies: `npm install`
3.  Set up environment variables:
    *   `API_KEY`: Your Google Gemini API Key.
4.  (Optional) Configure Firebase in `services/pinService.ts` for persistent community data.
5.  Run the app: `npm run dev`

## Disclaimer
This code was generated using Google AI Studio.