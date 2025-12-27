import React, { useEffect, useRef, useState } from 'react';
import { LatLng, Pin, SafetyLevel } from '../types';

interface MapComponentProps {
  center: LatLng;
  pins: Pin[];
  route?: LatLng[];
  destination?: LatLng;
  onMapClick: (location: LatLng) => void;
  onPinClick: (pin: Pin) => void;
  interactive: boolean;
}

const MapComponent: React.FC<MapComponentProps> = ({ center, pins, route, destination, onMapClick, onPinClick, interactive }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeLayerRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);
  const animationFrameRef = useRef<number>(0);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstance) return;

    if (window.L) {
      const map = window.L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([center.lat, center.lng], 15);

      // Light mode tiles
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy;OpenStreetMap, &copy;CartoDB',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);
      
      setMapInstance(map);
    }
  }, []); // Only run once on mount

  // Handle Click Listener Updates
  useEffect(() => {
    if (!mapInstance) return;

    const handler = (e: any) => {
      if (interactive) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    };

    mapInstance.on('click', handler);

    return () => {
      mapInstance.off('click', handler);
    };
  }, [mapInstance, interactive, onMapClick]);

  // Update Center
  useEffect(() => {
    if (mapInstance) {
      mapInstance.flyTo([center.lat, center.lng], mapInstance.getZoom());
    }
  }, [center, mapInstance]);

  // Update Route Polyline
  useEffect(() => {
    if (!mapInstance || !window.L) return;

    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    // Cancel previous animation frame if exists
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
    }

    if (route && route.length > 0) {
      const pointList = route.map(p => [p.lat, p.lng]);
      
      // Create the polyline
      routeLayerRef.current = window.L.polyline(pointList, {
        color: '#10b981', // Emerald 500 (slightly lighter/softer)
        weight: 5,        // Slightly thinner
        opacity: 0.7,     // More transparent
        dashArray: '8, 16', // Longer dashes, more spacing for subtle flow
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(mapInstance);

      // Animate dash offset for "walking" effect
      let offset = 0;
      const animateLine = () => {
        if (routeLayerRef.current) {
            // Decrease speed: previously -1 per frame, now -0.15 per frame
            offset = (offset - 0.15); 
            routeLayerRef.current.setStyle({ dashOffset: offset.toString() });
            animationFrameRef.current = requestAnimationFrame(animateLine);
        }
      };
      animateLine();

      // Fit bounds to show full route
      const bounds = window.L.latLngBounds(pointList);
      mapInstance.fitBounds(bounds, { padding: [50, 50] });
    }

    return () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
    };

  }, [route, mapInstance]);

  // Update Destination Marker
  useEffect(() => {
    if (!mapInstance || !window.L) return;

    if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
        destinationMarkerRef.current = null;
    }

    if (destination) {
        const flagIconHtml = `
          <div class="flex items-center justify-center relative w-8 h-8 text-blue-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#2563eb" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-flag drop-shadow-md"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>
          </div>
        `;
        
        const flagIcon = window.L.divIcon({
            className: 'custom-pin',
            html: flagIconHtml,
            iconSize: [32, 32],
            iconAnchor: [4, 32] // Anchor bottom-left
        });

        destinationMarkerRef.current = window.L.marker([destination.lat, destination.lng], { icon: flagIcon, zIndexOffset: 900 }).addTo(mapInstance);
    }

  }, [destination, mapInstance]);

  // Update Pins
  useEffect(() => {
    if (!mapInstance || !window.L) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    pins.forEach(pin => {
      const colorClass = 
        pin.safetyLevel === SafetyLevel.SAFE ? 'text-emerald-600' :
        pin.safetyLevel === SafetyLevel.CAUTION ? 'text-yellow-600' :
        'text-red-600';
      
      const fillHex = 
        pin.safetyLevel === SafetyLevel.SAFE ? '#059669' : 
        pin.safetyLevel === SafetyLevel.CAUTION ? '#ca8a04' : 
        '#dc2626';

      const iconHtml = `
        <div class="flex items-center justify-center relative w-8 h-8 ${colorClass}">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="${fillHex}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin drop-shadow-md"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="white" /></svg>
        </div>
      `;

      const icon = window.L.divIcon({
        className: 'custom-pin',
        html: iconHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      });

      const marker = window.L.marker([pin.lat, pin.lng], { icon }).addTo(mapInstance);
      marker.on('click', () => onPinClick(pin));
      markersRef.current.push(marker);
    });
  }, [pins, onPinClick, mapInstance]);

  // Add User Location Marker
  useEffect(() => {
    if (!mapInstance || !window.L) return;
    
    // Remove old user marker if exists (though usually handled by recreating map, but for safety in dev)
    const existingMarkers = []; 
    
    const userIconHtml = `
      <div class="relative w-4 h-4">
         <span class="pulse-ring absolute inset-0 bg-blue-600 rounded-full"></span>
         <div class="w-4 h-4 bg-blue-600 border-2 border-white rounded-full relative z-10 shadow-sm"></div>
      </div>
    `;

    const userIcon = window.L.divIcon({
        className: 'custom-pin',
        html: userIconHtml,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });
    
    const userMarker = window.L.marker([center.lat, center.lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(mapInstance);

    return () => {
        userMarker.remove();
    }
  }, [center, mapInstance]);

  return <div ref={mapContainerRef} className="w-full h-full z-0 bg-gray-100" />;
};

export default MapComponent;
