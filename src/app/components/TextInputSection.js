import React from 'react';

/**
 * TextInputSection Component
 * Handles the text input display and editing
 */
export default function TextInputSection({ text, onTextChange }) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-white mb-2">
        Text to Speech
      </label>
      <div className="relative w-full">
        <textarea
          value={text}
          onChange={onTextChange}
          rows={18}
          className="w-full px-3 py-2 border border-gray-700 rounded-md shadow-sm bg-[#222222] text-white min-h-[24rem] h-auto focus:ring-1 focus:ring-[#e25822] focus:border-[#e25822] outline-none"
          placeholder="Enter text to convert to speech..."
          spellCheck="true"
          style={{ fontSize: '1rem', lineHeight: '1.5' }}
        />
      </div>
    </div>
  );
} 