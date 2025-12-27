import { GoogleGenAI } from "@google/genai";
import { GeminiAnalysis, LatLng, Pin, PlaceSuggestion, RouteResponse, SafetyLevel } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Helpers ---

// Approximate distance in meters between two coordinates
const getDistanceMeters = (p1: LatLng, p2: LatLng) => {
  const R = 6371e3; // Earth radius
  const φ1 = p1.lat * Math.PI / 180;
  const φ2 = p2.lat * Math.PI / 180;
  const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
  const Δλ = (p2.lng - p1.lng) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Calculate bearing between two points (in degrees)
const getBearing = (start: LatLng, end: LatLng) => {
  const startLat = start.lat * Math.PI / 180;
  const startLng = start.lng * Math.PI / 180;
  const destLat = end.lat * Math.PI / 180;
  const destLng = end.lng * Math.PI / 180;

  const y = Math.sin(destLng - startLng) * Math.cos(destLat);
  const x = Math.cos(startLat) * Math.sin(destLat) -
            Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
  const brng = Math.atan2(y, x);
  return (brng * 180 / Math.PI + 360) % 360;
};

// Calculate a new point given start, distance and bearing
const getDestinationPoint = (start: LatLng, distanceMeters: number, bearing: number): LatLng => {
  const R = 6371e3; // Earth Radius
  const angDist = distanceMeters / R;
  const brng = bearing * Math.PI / 180;
  const lat1 = start.lat * Math.PI / 180;
  const lon1 = start.lng * Math.PI / 180;

  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angDist) +
                         Math.cos(lat1) * Math.sin(angDist) * Math.cos(brng));
  const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(angDist) * Math.cos(lat1),
                                 Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat2));

  return {
    lat: lat2 * 180 / Math.PI,
    lng: lon2 * 180 / Math.PI
  };
};

const formatDuration = (seconds: number): string => {
  // Add 20% buffer for realistic walking speed (lights, crossings)
  const adjustedSeconds = seconds * 1.2;
  const totalMinutes = Math.ceil(adjustedSeconds / 60);
  
  if (totalMinutes < 60) {
    return `${totalMinutes} min walk`;
  }
  
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours} hr ${mins} min walk`;
};

// Check if route passes near danger pins
const checkRouteConflicts = (routePath: LatLng[], pins: Pin[], startLoc: LatLng, endLoc: LatLng): Pin[] => {
  const DANGER_THRESHOLD_METERS = 150; // VERY WIDE berth for safety
  const IGNORE_TERMINAL_DISTANCE = 80; // If you are within 80m of start/end, we can't avoid it.
  
  const dangerPins = pins.filter(p => p.safetyLevel === SafetyLevel.DANGER);
  const conflicts = new Set<Pin>();

  // Iterate every single point for maximum safety accuracy
  for (const point of routePath) {
    for (const pin of dangerPins) {
        const distToPin = getDistanceMeters(point, pin);
        
        if (distToPin < DANGER_THRESHOLD_METERS) {
            // Check if this "conflict" is just because we are starting/ending there
            const distToStart = getDistanceMeters(pin, startLoc);
            const distToEnd = getDistanceMeters(pin, endLoc);
            
            if (distToStart > IGNORE_TERMINAL_DISTANCE && distToEnd > IGNORE_TERMINAL_DISTANCE) {
                conflicts.add(pin);
            }
        }
    }
  }
  return Array.from(conflicts);
};

// Fetch raw route from OSRM
const fetchOSRMRoute = async (start: LatLng, dest: LatLng, waypoint?: LatLng) => {
  let url = `https://router.project-osrm.org/route/v1/walking/${start.lng},${start.lat}`;
  
  if (waypoint) {
    url += `;${waypoint.lng},${waypoint.lat}`;
  }
  
  url += `;${dest.lng},${dest.lat}?overview=full&geometries=geojson`;

  try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (!data.routes || data.routes.length === 0) {
        return null;
      }
      return data.routes[0];
  } catch (e) {
      console.error("OSRM Fetch Error", e);
      return null;
  }
};

// --- Main Services ---

export const analyzeSafety = async (location: LatLng): Promise<GeminiAnalysis> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a safety advisor assistant. The user is currently at coordinates ${location.lat}, ${location.lng}.

      Task:
      1. Identify the **nearest** verified "Safe Havens" relative to the user's location. Specifically look for:
         - **Police Stations**
         - **Hospitals or Emergency Care Centers**
         - **Public Transit Stations** (Train, Metro, Bus Terminals)
         - **Major 24-hour Businesses** (e.g., Gas Stations, Pharmacies, large Supermarkets)
      
      2. Provide a concise safety report (max 150 words):
         - **Area Context**: Briefly describe the area (e.g., residential, commercial, isolated).
         - **Nearest Safe Havens**: Explicitly list the identified locations found in step 1.
         - **Safety Tip**: Actionable advice for this specific location.

      Use Google Maps data to verify these locations. Prioritize proximity.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: location.lat,
              longitude: location.lng
            }
          }
        }
      }
    });

    const text = response.text || "Unable to retrieve safety information at this time.";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return {
      text,
      groundingChunks: groundingChunks as any 
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      text: "We couldn't reach the AI service right now. Please rely on community pins and your own judgment.",
      groundingChunks: []
    };
  }
};

export const searchPlaces = async (query: string, center: LatLng): Promise<PlaceSuggestion[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Find up to 4 places matching the query "${query}" near latitude ${center.lat}, longitude ${center.lng}.
      
      Return a JSON array of objects. Each object must have:
      - "name": The name of the place
      - "lat": The latitude (number)
      - "lng": The longitude (number)
      - "address": Short address string
      
      Ensure strict JSON format. Do not use Markdown code blocks. Only return the JSON array.`,
      config: {
        tools: [{ googleMaps: {} }], 
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: center.lat,
              longitude: center.lng
            }
          }
        }
      }
    });

    if (response.text) {
      let jsonStr = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
      const firstBracket = jsonStr.indexOf('[');
      const lastBracket = jsonStr.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1) {
          jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
      }

      const data = JSON.parse(jsonStr);
      if (Array.isArray(data)) {
        return data.map((item: any) => ({
          name: item.name,
          location: { lat: item.lat, lng: item.lng },
          address: item.address
        }));
      }
    }
    return [];

  } catch (error) {
    console.error("Place search failed:", error);
    return [];
  }
};

export const getSafeRoute = async (start: LatLng, destinationLoc: LatLng, destinationName: string, pins: Pin[]): Promise<RouteResponse> => {
  try {
    // 1. Fetch Initial Route (Direct)
    const directRouteData = await fetchOSRMRoute(start, destinationLoc);
    
    if (!directRouteData) {
       throw new Error("No route found");
    }

    const directCoordinates = directRouteData.geometry.coordinates.map((c: number[]) => ({ lat: c[1], lng: c[0] }));
    const directConflicts = checkRouteConflicts(directCoordinates, pins, start, destinationLoc);

    // Initial Selection
    let selectedRoute = {
      coords: directCoordinates,
      data: directRouteData,
      conflicts: directConflicts,
      type: 'direct',
      // SCORING: 1,000,000 penalty per conflict.
      // This ensures even a 10 hour walk (36,000s) is preferred over 1 conflict.
      score: directConflicts.length * 1000000 + directRouteData.duration 
    };

    // 2. If Direct Route is unsafe, attempt AGGRESSIVE multi-path calculations
    if (directConflicts.length > 0) {
      const conflictPin = directConflicts[0]; // Avoid the first danger zone we hit
      const bearing = getBearing(start, destinationLoc);
      
      // Try wide range of offsets: 300m, 600m, 1000m, 1500m
      // Large offsets (1km+) force the router to use completely different main roads
      const offsets = [300, 600, 1000, 1500]; 
      
      // Generate promises for all candidates
      const routePromises = [];
      
      for (const offset of offsets) {
          // Left Waypoint (-90 degrees)
          const leftWp = getDestinationPoint(conflictPin, offset, bearing - 90);
          routePromises.push(fetchOSRMRoute(start, destinationLoc, leftWp).then(data => ({ data, type: `left-${offset}` })));
          
          // Right Waypoint (+90 degrees)
          const rightWp = getDestinationPoint(conflictPin, offset, bearing + 90);
          routePromises.push(fetchOSRMRoute(start, destinationLoc, rightWp).then(data => ({ data, type: `right-${offset}` })));
      }

      const results = await Promise.all(routePromises);

      // Evaluation Helper
      const evaluate = (data: any, type: string) => {
        if (!data) return null;
        const coords = data.geometry.coordinates.map((c: number[]) => ({ lat: c[1], lng: c[0] }));
        const conflicts = checkRouteConflicts(coords, pins, start, destinationLoc);
        
        // Massive Penalty for conflicts
        const score = (conflicts.length * 1000000) + data.duration;
        return { coords, data, conflicts, type, score };
      };

      const candidates = [selectedRoute];
      
      results.forEach(res => {
          if (res.data) {
              const evalResult = evaluate(res.data, res.type);
              if (evalResult) candidates.push(evalResult);
          }
      });

      // Sort by score (ascending) -> Best route first
      candidates.sort((a, b) => a.score - b.score);
      
      // Select the winner
      selectedRoute = candidates[0];
    }

    // 4. Final Route Processing
    const duration = formatDuration(selectedRoute.data.duration);
    const dangerCount = selectedRoute.conflicts.length;
    const isDetour = selectedRoute.type !== 'direct';
    
    // 5. Generate Safety Note with Gemini
    const prompt = `
      I am walking from coordinates (${start.lat}, ${start.lng}) to "${destinationName}".
      The calculated walk time is ${duration}.
      
      Context:
      - Detour Logic Used: ${isDetour ? "YES (Avoided danger zone)" : "NO (Direct path)"}
      - Remaining danger zones on chosen path: ${dangerCount}
      
      Task:
      Provide a concise "Safety Note" (max 1 sentence).
      - If a detour was applied successfully, tell the user the route was adjusted for safety.
      - If danger zones remain, give a STRICT warning.
      - If direct route is clear, be reassuring.
      
      Return JSON: { "safetyNote": "..." }
    `;

    const aiResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    let safetyNote = "Stay aware of your surroundings.";
    if (aiResponse.text) {
        try {
            const json = JSON.parse(aiResponse.text);
            if (json.safetyNote) safetyNote = json.safetyNote;
        } catch (e) { /* ignore */ }
    }

    // Fallback if AI fails
    if (dangerCount > 0 && safetyNote === "Stay aware of your surroundings.") {
        safetyNote = "Warning: Safe path not possible. This route still passes near reported danger zones.";
    }

    return {
      route: selectedRoute.coords,
      duration,
      safetyNote
    };

  } catch (error) {
    console.error("Route generation failed:", error);
    return {
      route: [],
      safetyNote: "Could not calculate safe route. Please check your internet connection."
    };
  }
};