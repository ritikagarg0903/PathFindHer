// Global Leaflet Type Declaration for CDN usage
declare global {
  interface Window {
    L: any;
  }
}

export interface LatLng {
  lat: number;
  lng: number;
}

export enum SafetyLevel {
  SAFE = 'SAFE',
  CAUTION = 'CAUTION',
  DANGER = 'DANGER',
}

export interface Pin {
  id: string;
  lat: number;
  lng: number;
  safetyLevel: SafetyLevel;
  description: string;
  timestamp: number;
  userId: string;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
    placeAnswerSources?: {
      reviewSnippets?: {
        content: string;
        author: string;
      }[];
    }[];
  };
}

export interface GeminiAnalysis {
  text: string;
  groundingChunks: GroundingChunk[];
}

export interface RouteResponse {
  route: LatLng[];
  duration?: string;
  safetyNote?: string;
}

export interface PlaceSuggestion {
  name: string;
  location: LatLng;
  address?: string;
}
