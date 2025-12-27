import React, { useState, useEffect, useCallback } from 'react';
import { LatLng, GeminiAnalysis } from '../types';
import { analyzeSafety } from '../services/geminiService';
import { Sparkles, X, ArrowRight } from 'lucide-react';

interface Props {
  currentLocation: LatLng;
  onClose: () => void;
}

const SafetyAdvisor: React.FC<Props> = ({ currentLocation, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<GeminiAnalysis | null>(null);

  // Auto-start analysis when component mounts
  useEffect(() => {
    let mounted = true;
    
    const runAnalysis = async () => {
        setLoading(true);
        const result = await analyzeSafety(currentLocation);
        if (mounted) {
            setAnalysis(result);
            setLoading(false);
        }
    };

    runAnalysis();

    return () => { mounted = false; };
  }, []); // Run once on mount

  const handleRefresh = async () => {
    setLoading(true);
    setAnalysis(null);
    const result = await analyzeSafety(currentLocation);
    setAnalysis(result);
    setLoading(false);
  };

  // Extract and limit valid places
  const validPlaces = analysis?.groundingChunks
    ? analysis.groundingChunks
        .map(chunk => {
           const item = chunk.maps || chunk.web;
           return item ? { ...item, originalChunk: chunk } : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .slice(0, 5)
    : [];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900 border-t border-gray-800 shadow-2xl rounded-t-3xl max-h-[85vh] overflow-y-auto transition-transform duration-300 animate-slide-up">
      <div className="p-1 flex justify-center">
         <div className="w-16 h-1 bg-gray-700 rounded-full my-2"></div>
      </div>
      
      <div className="p-6 pt-2 pb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="text-purple-400" size={24} />
            <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              AI Safety Advisor
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-white bg-gray-800 rounded-full">
            <X size={20} />
          </button>
        </div>

        {loading && (
          <div className="py-16 flex flex-col items-center justify-center space-y-6">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <Sparkles size={20} className="text-purple-400 animate-pulse" />
              </div>
            </div>
            <div className="text-center space-y-1">
               <p className="text-white font-medium">Scanning immediate surroundings...</p>
               <p className="text-sm text-gray-400">Locating police, hospitals, and transit...</p>
            </div>
          </div>
        )}

        {!loading && analysis && (
          <div className="animate-fade-in space-y-6">
             <div className="bg-gray-800/50 p-5 rounded-2xl border border-gray-700/50">
               <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                 {analysis.text}
               </p>
             </div>

             {validPlaces.length > 0 ? (
               <div>
                 <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">Nearby Safe Havens (Verified)</h3>
                 <div className="space-y-3">
                   {validPlaces.map((item, idx) => {
                     const review = item.originalChunk.maps?.placeAnswerSources?.[0]?.reviewSnippets?.[0]?.content;
                     
                     return (
                       <a 
                         key={idx}
                         href={item.uri}
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="block bg-gray-800 p-4 rounded-xl hover:bg-gray-750 transition-all border border-gray-700 hover:border-purple-500/50 group"
                       >
                         <div className="flex items-start justify-between gap-4">
                            <div>
                                <h4 className="font-semibold text-blue-300 group-hover:text-blue-200 text-sm">{item.title}</h4>
                                {review && (
                                   <p className="text-xs text-gray-400 mt-2 italic line-clamp-2 leading-relaxed">
                                     "{review}"
                                   </p>
                                )}
                            </div>
                            <ArrowRight size={16} className="text-gray-600 group-hover:text-purple-400 mt-1 shrink-0" />
                         </div>
                       </a>
                     );
                   })}
                 </div>
               </div>
             ) : (
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-200/80 text-sm text-center">
                   No specific verified safe havens found nearby.
                </div>
             )}
             
             <button 
               onClick={handleRefresh} 
               className="w-full py-4 text-sm font-bold text-gray-400 hover:text-white transition-colors border-t border-gray-800 mt-4"
             >
               Refresh Analysis
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SafetyAdvisor;