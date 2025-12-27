import React, { useState } from 'react';
import { LatLng, Pin, SafetyLevel } from '../types';
import { ShieldCheck, AlertTriangle, AlertOctagon, X } from 'lucide-react';

interface Props {
  location: LatLng;
  onClose: () => void;
  onSubmit: (pin: Omit<Pin, 'id' | 'timestamp'>) => void;
}

const PinCreationModal: React.FC<Props> = ({ location, onClose, onSubmit }) => {
  const [level, setLevel] = useState<SafetyLevel>(SafetyLevel.SAFE);
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      lat: location.lat,
      lng: location.lng,
      safetyLevel: level,
      description: description || "No description provided.",
      userId: 'user' // In a real app, from auth
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-800 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-gray-700 animate-slide-up">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Rate Location Safety</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full text-gray-400">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setLevel(SafetyLevel.SAFE)}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                level === SafetyLevel.SAFE 
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' 
                : 'border-gray-700 bg-gray-800 text-gray-500 hover:border-gray-600'
              }`}
            >
              <ShieldCheck size={28} className="mb-2" />
              <span className="text-sm font-medium">Safe</span>
            </button>

            <button
              type="button"
              onClick={() => setLevel(SafetyLevel.CAUTION)}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                level === SafetyLevel.CAUTION 
                ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400' 
                : 'border-gray-700 bg-gray-800 text-gray-500 hover:border-gray-600'
              }`}
            >
              <AlertTriangle size={28} className="mb-2" />
              <span className="text-sm font-medium">Caution</span>
            </button>

            <button
              type="button"
              onClick={() => setLevel(SafetyLevel.DANGER)}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                level === SafetyLevel.DANGER 
                ? 'border-red-500 bg-red-500/20 text-red-400' 
                : 'border-gray-700 bg-gray-800 text-gray-500 hover:border-gray-600'
              }`}
            >
              <AlertOctagon size={28} className="mb-2" />
              <span className="text-sm font-medium">Danger</span>
            </button>
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">What did you notice?</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Streetlights are broken, very dark alley, friendly police presence..."
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 h-24 resize-none"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-blue-900/20"
          >
            Drop Safety Pin
          </button>
        </form>
      </div>
    </div>
  );
};

export default PinCreationModal;
