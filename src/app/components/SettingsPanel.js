import React, { useState, useRef } from 'react';
import useClickOutside from '../hooks/useClickOutside';

/**
 * SettingsPanel Component
 * Provides app settings like voice selection and page width
 */
export default function SettingsPanel({ voice, onVoiceChange, pageWidth, onPageWidthChange }) {
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef(null);
  
  // Use the click outside hook
  useClickOutside(
    settingsRef, 
    showSettings, 
    () => setShowSettings(false)
  );

  // Toggle settings visibility
  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  return (
    <div className="absolute top-3 right-4 z-30">
      <button
        onClick={toggleSettings}
        className="w-8 h-8 flex items-center justify-center text-white hover:text-[#e25822] transition-colors"
        aria-label="Settings"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      
      {/* Settings Dropdown */}
      {showSettings && (
        <div ref={settingsRef} className="absolute right-0 top-[calc(100%+4px)] z-10 w-64 bg-[#222222] border border-gray-700 rounded-md shadow-lg">
          <div className="p-3">
            <h3 className="text-white font-medium mb-2">Settings</h3>
            <div className="mb-3">
              <label className="block text-sm text-white mb-1">
                Voice
              </label>
              <select
                value={voice}
                onChange={onVoiceChange}
                className="w-full px-2 py-1.5 border border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-[#e25822] focus:border-[#e25822] bg-[#1a1a1a] text-white text-sm"
              >
                <option value="bm_lewis">Lewis</option>
                <option value="bm_emma">Emma</option>
                <option value="bm_brian">Brian</option>
              </select>
            </div>
            
            <div className="mb-3">
              <label className="block text-sm text-white mb-1">
                Page Width ({pageWidth}%)
              </label>
              <input
                type="range"
                min="60"
                max="95"
                value={pageWidth}
                onChange={onPageWidthChange}
                className="w-full accent-[#e25822]"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>60%</span>
                <span>95%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 