import React, { useState, useEffect } from 'react';
import HighlightedTextInput from './HighlightedTextInput';

/**
 * TextInputSection Component
 * Handles the text input display and editing
 */
export default function TextInputSection({ 
  text, 
  onTextChange, 
  timestamps = null, 
  currentWordIndex = -1, 
  originalText = null,
  isPlaying = false,
  onPlaybackPositionChange,
  wordCount
}) {
  const [highlightMode, setHighlightMode] = useState(false);
  const [viewMode, setViewMode] = useState('word'); // 'word' or 'sentence'
  
  // Toggle between edit and highlight modes
  const toggleHighlightMode = () => {
    setHighlightMode(!highlightMode);
    console.log(`Toggled highlight mode: ${!highlightMode}`);
  };
  
  // Toggle view mode between word and sentence
  const toggleViewMode = () => {
    const newMode = viewMode === 'word' ? 'sentence' : 'word';
    setViewMode(newMode);
    console.log(`Toggled view mode to: ${newMode}`);
  };
  
  // Whether highlighting is possible
  const canHighlight = timestamps && timestamps.length > 0 && originalText;
  
  // Auto-enable highlight mode when playback starts
  useEffect(() => {
    if (isPlaying && canHighlight) {
      console.log("Auto-enabling highlight mode due to playback starting");
      setHighlightMode(true);
    }
  }, [isPlaying, canHighlight]);
  
  // Log state for debugging
  useEffect(() => {
    console.log("TextInputSection state:", { 
      highlightMode, 
      viewMode,
      canHighlight, 
      isPlaying, 
      wordCount: wordCount || 0,
      currentWordIndex
    });
  }, [highlightMode, viewMode, canHighlight, isPlaying, wordCount, currentWordIndex]);
  
  return (
    <div className="flex flex-col space-y-3 w-[95%] mx-auto">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-semibold text-white">Your Text</h2>
        
        <div className="flex space-x-3">
          {/* View Mode Toggle (Only shown when highlight mode is active) */}
          {highlightMode && canHighlight && (
            <button
              onClick={toggleViewMode}
              className={`
                px-3 py-1.5 rounded-md text-sm font-medium
                transition-all duration-300 ease-in-out
                ${viewMode === 'word' 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-purple-600 hover:bg-purple-700 text-white'}
              `}
            >
              {viewMode === 'word' ? 'Word View' : 'Phrase View'}
            </button>
          )}
          
          {/* Highlight Mode Toggle */}
          <button
            onClick={toggleHighlightMode}
            disabled={!canHighlight}
            className={`
              px-3 py-1.5 rounded-md text-sm font-medium 
              transition-all duration-300 ease-in-out
              ${!canHighlight 
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                : highlightMode
                  ? 'bg-[#d45822] hover:bg-[#c04822] text-white border-2 border-orange-300'
                  : 'bg-gray-600 hover:bg-gray-500 text-white'}
            `}
          >
            {highlightMode ? 'Edit Text' : 'Show Highlighting'}
          </button>
        </div>
      </div>
      
      {/* Status message for highlighting */}
      {canHighlight && highlightMode && (
        <div className="text-sm text-gray-300 italic bg-gray-800 px-2 py-1 rounded flex items-center justify-between mb-1 animate-fadeIn">
          <div>
            <span className="text-[#e25822] font-medium">
              {viewMode === 'word' ? 'Word highlighting' : 'Phrase highlighting'}
            </span>{' '}
            active - following audio playback
          </div>
          
          {viewMode === 'word' ? (
            <span className="text-xs text-gray-400">Switch to phrase view for easier reading</span>
          ) : (
            <span className="text-xs text-gray-400">Switch to word view for precise tracking</span>
          )}
        </div>
      )}
      
      <HighlightedTextInput
        text={text}
        originalText={originalText || text}
        timestamps={timestamps}
        currentWordIndex={isPlaying && highlightMode ? currentWordIndex : -1}
        onTextChange={onTextChange}
        isEditable={!highlightMode}
        viewMode={viewMode}
      />
      
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
} 