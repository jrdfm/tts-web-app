import React from 'react';

/**
 * GenerateButton Component
 * Main button for generating speech or stopping playback
 */
export default function GenerateButton({ onClick, isGenerating, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-6 py-3 rounded-md font-medium ${
        isGenerating
          ? 'bg-red-600 hover:bg-red-700 text-white'
          : disabled
          ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
          : 'bg-[#e25822] hover:bg-[#d04d1d] text-white'
      }`}
    >
      {isGenerating ? 'Stop' : 'Generate & Play Speech'}
    </button>
  );
} 