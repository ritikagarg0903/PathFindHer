import React, { useEffect, useState, useCallback } from 'react';
import { LatLng, Pin, PlaceSuggestion, SafetyLevel } from './types';
import MapComponent from './components/MapComponent';
import PinCreationModal from './components/PinCreationModal';
import SafetyAdvisor from './components/SafetyAdvisor';
import { subscribeToPins, addPin, seedData, removePin } from './services/pinService';
import { getSafeRoute, searchPlaces } from './services/geminiService';
import { Plus, Navigation, Map as MapIcon, ShieldAlert, Info, ArrowLeft, Footprints, Search, XCircle, MapPin, Trash2, Loader2, Sparkles } from 'lucide-react';

// Default to San Francisco if Geo fails
const DEFAULT_CENTER: LatLng = { lat: 37.7749, lng: -122.4194 };

type AppMode = 'MENU' | 'NAVIGATING_INPUT' | 'NAVIGATING_PICK_MAP' | 'NAVIGATING_SHOW' | 'REPORTING';

function App() {
  const [center, setCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [pins, setPins] = useState<Pin[]>([]);
  
  // App State
  const [mode, setMode] = useState<AppMode>('MENU');
  
  // Navigation State
  const [destinationName, setDestinationName] = useState('');
  const [destinationLoc, setDestinationLoc] = useState<LatLng | undefined>(undefined);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [route, setRoute] = useState<LatLng[] | undefined>(undefined);
  const [routeInfo, setRouteInfo] = useState<{duration: string, safetyNote: string} | null>(null);
  const [isRouting, setIsRouting] = useState(false);

  // Reporting State
  const [tempPinLocation, setTempPinLocation] = useState<LatLng | null>(null);
  
  // Other UI State
  const [showAdvisor, setShowAdvisor] = useState(false);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Initialize Data
  useEffect(() => {
    // Attempt Geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          setCenter({ lat: userLat, lng: userLng });
          seedData(userLat, userLng);
        },
        (error) => {
          console.error("Geolocation error:", error);
          seedData(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
        }
      );
    } else {
        seedData(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
    }
  }, []);

  // Subscribe to Pins (Database or Local)
  useEffect(() => {
    const unsubscribe = subscribeToPins((updatedPins) => {
      setPins(updatedPins);
    });
    return () => unsubscribe();
  }, []);

  // Debounce Search
  useEffect(() => {
    if (mode !== 'NAVIGATING_INPUT' || !destinationName || destinationLoc) {
        setSuggestions([]);
        return;
    }

    const timer = setTimeout(async () => {
        if (destinationName.length > 2) {
            setIsSearching(true);
            const results = await searchPlaces(destinationName, center);
            setSuggestions(results);
            setIsSearching(false);
        }
    }, 800);

    return () => clearTimeout(timer);
  }, [destinationName, center, mode, destinationLoc]);

  const calculateRoute = async (destLoc: LatLng, destName: string) => {
      setIsRouting(true);
      const result = await getSafeRoute(center, destLoc, destName, pins);
      if (result.route.length > 0) {
        setRoute(result.route);
        setRouteInfo({ duration: result.duration || '', safetyNote: result.safetyNote || '' });
        setMode('NAVIGATING_SHOW');
      } else {
        alert("Could not calculate a route.");
      }
      setIsRouting(false);
  };

  const handleSelectSuggestion = async (place: PlaceSuggestion) => {
      setDestinationName(place.name);
      setDestinationLoc(place.location);
      setSuggestions([]); // Clear suggestions
      calculateRoute(place.location, place.name);
  };

  const handleMapClick = useCallback((loc: LatLng) => {
    if (mode === 'REPORTING') {
      setTempPinLocation(loc);
    } else if (mode === 'NAVIGATING_PICK_MAP') {
      setDestinationLoc(loc);
      setDestinationName("Pinned Location");
    } else {
      setSelectedPin(null);
    }
  }, [mode]);

  const handlePinSubmit = async (pinData: Omit<Pin, 'id' | 'timestamp'>) => {
    await addPin(pinData);
    setTempPinLocation(null);
    setMode('MENU');
  };

  const handleDeletePin = async (pinId: string) => {
    if (confirm("Are you sure you want to delete this report?")) {
        setIsDeleting(true);
        try {
            await removePin(pinId);
            setSelectedPin(null);
        } catch (e) {
            console.error(e);
            alert("Failed to delete pin. Please try again.");
        } finally {
            setIsDeleting(false);
        }
    }
  };

  const resetNavigation = () => {
    setRoute(undefined);
    setRouteInfo(null);
    setDestinationName('');
    setDestinationLoc(undefined);
    setSuggestions([]);
    setMode('MENU');
  };

  const handleClearSearch = () => {
      setDestinationName('');
      setDestinationLoc(undefined);
      setSuggestions([]);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 relative">
      
      {/* Top Header */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4 pointer-events-none">
        <div className="bg-gray-900/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-700 p-4 flex justify-between items-center pointer-events-auto">
          <div>
            <h1 className="text-white font-bold text-lg flex items-center gap-2">
              <ShieldAlert className="text-emerald-400" />
              PathFindHer: Walk Without Fear
            </h1>
          </div>
          <button 
            onClick={() => setShowAdvisor(true)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-bold border border-white/10 shadow-lg shadow-purple-500/30 transition-all hover:scale-105"
          >
            <Sparkles size={14} className="text-purple-100" />
            Scan Area Safety
          </button>
        </div>
      </div>

      {/* Map Layer */}
      <div className="flex-1 relative">
         <MapComponent 
            center={center} 
            pins={pins}
            route={route}
            destination={destinationLoc}
            onMapClick={handleMapClick}
            onPinClick={(pin) => setSelectedPin(pin)}
            interactive={mode !== 'NAVIGATING_INPUT'}
         />
      </div>

      {/* Bottom Controls Area */}
      <div className="absolute bottom-0 left-0 right-0 z-30 p-4 pb-8 bg-gradient-to-t from-gray-900 via-gray-900/90 to-transparent pointer-events-none">
        <div className="pointer-events-auto max-w-lg mx-auto">
          
          {/* Main Menu */}
          {mode === 'MENU' && (
            <div className="grid grid-cols-2 gap-4 animate-slide-up">
              <button
                onClick={() => setMode('NAVIGATING_INPUT')}
                className="bg-blue-600 hover:bg-blue-500 text-white p-6 rounded-2xl shadow-xl flex flex-col items-center justify-center gap-3 transition-transform hover:scale-105"
              >
                <Navigation size={32} />
                <span className="font-bold text-lg">Navigate</span>
                <span className="text-xs text-blue-200">Find safe paths</span>
              </button>
              
              <button
                onClick={() => setMode('REPORTING')}
                className="bg-gray-800 hover:bg-gray-700 text-white p-6 rounded-2xl shadow-xl border border-gray-700 flex flex-col items-center justify-center gap-3 transition-transform hover:scale-105"
              >
                <Plus size={32} className="text-emerald-400" />
                <span className="font-bold text-lg">Report</span>
                <span className="text-xs text-gray-400">Drop a safety pin</span>
              </button>
            </div>
          )}

          {/* Reporting Banner */}
          {mode === 'REPORTING' && !tempPinLocation && (
             <div className="bg-gray-800 text-white p-4 rounded-2xl shadow-xl border border-gray-700 flex justify-between items-center animate-slide-up">
                <div className="flex items-center gap-3">
                   <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                   <span>Tap the map to pin a hazard</span>
                </div>
                <button 
                  onClick={() => setMode('MENU')}
                  className="px-4 py-2 bg-gray-700 rounded-lg text-sm hover:bg-gray-600"
                >
                  Cancel
                </button>
             </div>
          )}

          {/* Navigation Input */}
          {mode === 'NAVIGATING_INPUT' && (
            <div className="bg-gray-800 p-4 rounded-2xl shadow-xl border border-gray-700 animate-slide-up relative">
               <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => setMode('MENU')} className="text-gray-400 hover:text-white">
                    <ArrowLeft size={20} />
                  </button>
                  <h3 className="font-bold text-white">Where to?</h3>
               </div>
               
               <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <Search size={18} className="text-gray-500" />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Search destination..."
                    value={destinationName}
                    onChange={(e) => {
                        setDestinationName(e.target.value);
                        setDestinationLoc(undefined); // Reset loc on type
                    }}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 pl-10 pr-10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                  {destinationName && (
                      <button onClick={handleClearSearch} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-white">
                          <XCircle size={18} />
                      </button>
                  )}
               </div>

               {/* Button to pick on map */}
               {!isSearching && suggestions.length === 0 && (
                   <button 
                     onClick={() => {
                       setMode('NAVIGATING_PICK_MAP');
                       setDestinationLoc(undefined); // Clear any previous selection
                     }}
                     className="mt-4 w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-white font-medium flex items-center justify-center gap-2 transition-colors border border-gray-600"
                   >
                     <MapPin size={18} className="text-emerald-400" />
                     Choose destination on map
                   </button>
               )}

               {/* Autocomplete Suggestions */}
               {(suggestions.length > 0 || isSearching) && (
                   <div className="mt-2 bg-gray-900 border border-gray-700 rounded-xl max-h-48 overflow-y-auto">
                       {isSearching && (
                           <div className="p-3 text-gray-400 text-sm flex items-center gap-2">
                               <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                               Searching places...
                           </div>
                       )}
                       {suggestions.map((place, idx) => (
                           <button 
                                key={idx}
                                onClick={() => handleSelectSuggestion(place)}
                                className="w-full text-left p-3 hover:bg-gray-800 border-b border-gray-800 last:border-0 transition-colors"
                           >
                               <div className="text-white font-medium text-sm">{place.name}</div>
                               {place.address && <div className="text-gray-500 text-xs truncate">{place.address}</div>}
                           </button>
                       ))}
                   </div>
               )}

               {isRouting && (
                   <div className="mt-4 p-4 bg-blue-900/30 border border-blue-500/30 rounded-xl flex items-center justify-center gap-3 text-blue-200">
                        <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                        <span>Calculating safe route...</span>
                   </div>
               )}
            </div>
          )}

          {/* Pick on Map Mode */}
          {mode === 'NAVIGATING_PICK_MAP' && (
             <div className="bg-gray-800 p-4 rounded-2xl shadow-xl border border-gray-700 animate-slide-up">
                <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                        <MapPin className="text-emerald-400" size={20} />
                        <span className="font-bold text-white">Tap destination on map</span>
                    </div>
                    <button onClick={() => setMode('NAVIGATING_INPUT')} className="text-gray-400 hover:text-white">
                        <XCircle size={20}/>
                    </button>
                </div>
                
                {destinationLoc ? (
                    <div>
                        <div className="bg-gray-900 p-3 rounded-lg border border-gray-700 mb-3">
                            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Selected Coordinates</p>
                            <p className="text-white font-mono text-sm">{destinationLoc.lat.toFixed(4)}, {destinationLoc.lng.toFixed(4)}</p>
                        </div>
                        <button
                            onClick={() => calculateRoute(destinationLoc, "Pinned Location")}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
                        >
                            Confirm Destination
                        </button>
                    </div>
                ) : (
                    <div className="text-gray-400 text-sm py-2 italic text-center">
                        Tap any location on the map...
                    </div>
                )}
             </div>
          )}

          {/* Route Display */}
          {mode === 'NAVIGATING_SHOW' && routeInfo && (
            <div className="bg-gray-800 p-5 rounded-2xl shadow-xl border border-gray-700 animate-slide-up">
               <div className="flex justify-between items-start mb-2">
                 <div>
                    <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                       <ShieldAlert size={18} /> Safe Route Found
                    </h3>
                    <p className="text-white font-medium mt-1">{routeInfo.duration}</p>
                 </div>
                 <button onClick={resetNavigation} className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg">
                    End
                 </button>
               </div>
               <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700/50 mt-2">
                 <p className="text-sm text-gray-300 italic">"{routeInfo.safetyNote}"</p>
               </div>
            </div>
          )}

        </div>
      </div>

      {/* Modals */}
      {mode === 'REPORTING' && tempPinLocation && (
        <PinCreationModal 
          location={tempPinLocation}
          onClose={() => setTempPinLocation(null)}
          onSubmit={handlePinSubmit}
        />
      )}

      {showAdvisor && (
        <SafetyAdvisor 
          currentLocation={center}
          onClose={() => setShowAdvisor(false)}
        />
      )}

      {selectedPin && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setSelectedPin(null)}>
           <div className="bg-gray-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-gray-700 mb-20 animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="flex items-start gap-4">
                 <div className={`p-3 rounded-xl ${
                    selectedPin.safetyLevel === SafetyLevel.SAFE ? 'bg-emerald-500/20 text-emerald-400' :
                    selectedPin.safetyLevel === SafetyLevel.CAUTION ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                 }`}>
                    {selectedPin.safetyLevel === SafetyLevel.SAFE ? <ShieldAlert size={32} /> : <Info size={32} />}
                 </div>
                 <div className="flex-1">
                    <h3 className="text-lg font-bold text-white capitalize">{selectedPin.safetyLevel.toLowerCase()} Area</h3>
                    <p className="text-gray-300 mt-2 text-sm leading-relaxed">{selectedPin.description}</p>
                    <div className="flex justify-between items-center mt-4">
                        <p className="text-gray-500 text-xs">Reported {new Date(selectedPin.timestamp).toLocaleDateString()}</p>
                        <button 
                            onClick={() => handleDeletePin(selectedPin.id)}
                            disabled={isDeleting}
                            className="flex items-center gap-1 text-red-400 hover:text-red-300 text-xs font-medium px-2 py-1 rounded-lg hover:bg-red-900/20 transition-colors disabled:opacity-50"
                        >
                            {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            {isDeleting ? "Removing..." : "Remove"}
                        </button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}

export default App;