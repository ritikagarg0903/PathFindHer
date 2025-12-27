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
const checkRouteConflicts = (routePath: LatLng[], pins: Pin[]): Pin[] => {
  const DANGER_THRESHOLD_METERS = 80; // Distance to consider "too close"
  const dangerPins = pins.filter(p => p.safetyLevel === SafetyLevel.DANGER);
  const conflicts = new Set<Pin>();

  // Sample route points to avoid excessive calculation (check every 5th point)
  for (let i = 0; i < routePath.length; i += 5) {
    const point = routePath[i];
    for (const pin of dangerPins) {
      if (getDistanceMeters(point, pin) < DANGER_THRESHOLD_METERS) {
        conflicts.add(pin);
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

  const response = await fetch(url);
  const data = await response.json();
  
  if (!data.routes || data.routes.length === 0) {
    return null;
  }
  return data.routes[0];
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
    let routeData = await fetchOSRMRoute(start, destinationLoc);
    
    if (!routeData) {
       throw new Error("No route found");
    }

    let routeCoordinates = routeData.geometry.coordinates.map((c: number[]) => ({ lat: c[1], lng: c[0] }));
    
    // 2. Check for Safety Conflicts
    let conflicts = checkRouteConflicts(routeCoordinates, pins);
    let detourTaken = false;

    // 3. Attempt Detour if Conflicts Exist
    if (conflicts.length > 0) {
      const conflictPin = conflicts[0]; // Handle the first major conflict
      
      // Calculate a detour point:
      // We want a point perpendicular to the path start->end, offset by some distance.
      // Simple Heuristic: Shift the conflict pin's location by ~0.003 degrees (approx 300m) 
      // in a direction that might clear the area.
      
      // Offset logic: try to move North-East or South-West away from the pin
      // This is a rough heuristic for "going around the block"
      const detourLat = conflictPin.lat + (start.lat < destinationLoc.lat ? 0.003 : -0.003);
      const detourLng = conflictPin.lng + (start.lng < destinationLoc.lng ? -0.003 : 0.003);
      
      const detourPoint = { lat: detourLat, lng: detourLng };

      // Fetch Alternate Route
      const altRouteData = await fetchOSRMRoute(start, destinationLoc, detourPoint);
      
      if (altRouteData) {
        const altCoordinates = altRouteData.geometry.coordinates.map((c: number[]) => ({ lat: c[1], lng: c[0] }));
        const altConflicts = checkRouteConflicts(altCoordinates, pins);
        
        // If alternate route has fewer conflicts, use it
        if (altConflicts.length < conflicts.length) {
           routeData = altRouteData;
           routeCoordinates = altCoordinates;
           conflicts = altConflicts;
           detourTaken = true;
        }
      }
    }

    // 4. Final Route Processing
    const duration = formatDuration(routeData.duration);
    
    // 5. Generate Safety Note with Gemini
    // We inform Gemini if we took a detour or if dangers still exist.
    const dangerCount = conflicts.length;
    
    const prompt = `
      I am walking from coordinates (${start.lat}, ${start.lng}) to "${destinationName}".
      The calculated walk time is ${duration}.
      
      Context:
      - Detour taken to avoid danger: ${detourTaken ? "YES" : "NO"}
      - Remaining danger zones on this specific path: ${dangerCount}
      
      Provide a concise "Safety Note" (max 1 sentence).
      If a detour was taken, mention that the route was adjusted for safety.
      If danger zones remain, warn the user specifically.
      Otherwise, give general advice.
      
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

    // Fallback if AI fails but we know we have conflicts
    if (dangerCount > 0 && safetyNote === "Stay aware of your surroundings.") {
        safetyNote = "Warning: This route passes near reported danger zones. Please exercise extreme caution.";
    }

    return {
      route: routeCoordinates,
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