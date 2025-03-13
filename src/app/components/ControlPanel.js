import React, { useState, useRef } from 'react';
import useClickOutside from '../hooks/useClickOutside';
import { formatTime } from '../utils/format';

/**
 * ControlPanel Component
 * Provides playback controls, timeline, and speed options
 */
export default function ControlPanel({ 
  isPlaying, 
  isStreaming,
  currentTime, 
  duration, 
  streamProgress,
  playbackSpeed,
  onPlayPause, 
  onSeek, 
  onRewind, 
  onForward, 
  onSpeedChange 
}) {
  const [showSpeedOptions, setShowSpeedOptions] = useState(false);
  const speedOptionsRef = useRef(null);

  // Use the click outside hook
  useClickOutside(
    speedOptionsRef, 
    showSpeedOptions, 
    () => setShowSpeedOptions(false)
  );

  // Toggle speed options visibility
  const toggleSpeedOptions = () => {
    setShowSpeedOptions(!showSpeedOptions);
  };

  // Calculate the progress width percentage
  const getProgressWidth = () => {
    if (duration <= 0) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  };
  
  // Calculate the buffered width percentage
  const getBufferedWidth = () => {
    // When streaming, use our manual progress tracking
    if (isStreaming) {
      return Math.min(100, Math.max(0, streamProgress));
    }
    
    // When not streaming, buffering is complete
    return 100;
  };

  // Get display time
  const getTimeDisplay = () => {
    return `${formatTime(currentTime)} / ${formatTime(duration || 0)}`;
  };

  return (
    <div className="bg-[#1a1a1a] border-b border-gray-800 w-full">
      {/* Controls Container */}
      <div className="max-w-screen-xl mx-auto flex items-center justify-between px-4 py-2 relative">
        {/* Left: Time */}
        <div className="flex items-center space-x-4">
          <div className="text-[#e25822]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <div className="text-sm text-white">
            {getTimeDisplay()}
          </div>
        </div>

        {/* Center: Main Controls */}
        <div className="flex items-center space-x-6">
          {/* Rewind Button */}
          <button
            onClick={onRewind}
            className={`w-8 h-8 flex items-center justify-center text-white hover:text-[#e25822] transition-colors relative ${currentTime <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ transform: 'scaleX(-1)' }}
            aria-label="Rewind 10 seconds"
            disabled={currentTime <= 0}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 11-9-9" strokeLinecap="round" />
              <path d="M12 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Play/Pause Button */}
          <button
            onClick={onPlayPause}
            className={`w-10 h-10 flex items-center justify-center bg-[#e25822] rounded-full text-white hover:bg-[#d04d1d] transition-colors ${isStreaming && streamProgress < 5 ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label={isPlaying ? "Pause" : "Play"}
            disabled={isStreaming && streamProgress < 5}
          >
            {isPlaying ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Forward Button */}
          <button
            onClick={onForward}
            className={`w-8 h-8 flex items-center justify-center text-white hover:text-[#e25822] transition-colors ${duration > 0 && currentTime >= duration ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label="Forward 10 seconds"
            disabled={duration > 0 && currentTime >= duration}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 11-9-9" strokeLinecap="round" />
              <path d="M12 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Speed Control Dropdown */}
          <div className="relative ml-4">
            <button
              onClick={toggleSpeedOptions}
              className="px-2 py-1 text-sm font-medium text-white hover:text-[#e25822] transition-colors flex items-center"
              aria-label="Playback speed"
            >
              <span>{playbackSpeed}x</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            
            {showSpeedOptions && (
              <div ref={speedOptionsRef} className="absolute left-0 top-full mt-1 w-24 bg-[#222222] border border-gray-700 rounded-md shadow-lg z-30">
                <div className="py-1">
                  {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => {
                        onSpeedChange(speed);
                        setShowSpeedOptions(false);
                      }}
                      className={`block w-full text-left px-3 py-1 text-sm ${playbackSpeed === speed ? 'text-[#e25822] bg-[#2a2a2a]' : 'text-white hover:bg-[#2a2a2a]'}`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Empty Right Side for Balance */}
        <div className="w-24"></div>
      </div>
      
      {/* Progress Bar */}
      <div 
        className="h-1 bg-gray-800 cursor-pointer mt-2 relative"
        onClick={onSeek}
        aria-label="Audio progress"
        role="slider"
        aria-valuemin="0"
        aria-valuemax={100}
        aria-valuenow={getProgressWidth()}
      >
        {/* Loading indicator during streaming */}
        {isStreaming && (
          <div className="absolute inset-0 overflow-hidden">
            <div className="h-full w-full bg-gray-700 animate-pulse opacity-30"></div>
          </div>
        )}
      
        {/* Buffered progress - using gray */}
        <div 
          className="h-full bg-gray-600 absolute top-0 left-0 transition-all duration-100" 
          style={{ width: `${getBufferedWidth()}%` }}
        />
        
        {/* Playback progress - using orange */}
        <div 
          className="h-full bg-[#e25822] absolute top-0 left-0 transition-all duration-100 z-10" 
          style={{ width: `${getProgressWidth()}%` }}
        />
      </div>
    </div>
  );
} 