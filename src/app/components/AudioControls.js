import React from 'react';

const AudioControls = ({ 
  currentTime, 
  duration, 
  isPlaying, 
  onPlay, 
  onPause,
  onRewind,
  onForward,
  playbackSpeed,
  onSpeedChange,
  onSeek,
  onSettingsClick
}) => {
  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e) => {
    if (!duration || isNaN(duration) || duration <= 0) return;
    
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const seekTime = Math.max(0, Math.min(percentage * duration, duration));
    
    if (isFinite(seekTime)) {
      onSeek(seekTime);
    }
  };

  const getProgressWidth = () => {
    if (!duration || isNaN(duration) || duration <= 0) return 0;
    const percentage = (currentTime / duration) * 100;
    return isFinite(percentage) ? `${percentage}%` : '0%';
  };

  return (
    <div className="bg-[#1a1a1a] border-b border-gray-800">
      {/* Progress Bar */}
      <div 
        className="h-1 bg-gray-800 cursor-pointer"
        onClick={handleSeek}
      >
        <div 
          className="h-full bg-[#e25822] transition-all duration-100" 
          style={{ width: getProgressWidth() }}
        />
      </div>

      {/* Controls Container */}
      <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-2 relative">
        {/* Left: Logo and Time */}
        <div className="flex items-center space-x-4">
          <div className="text-[#e25822]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <div className="text-sm text-white">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {/* Center: Main Controls */}
        <div className="flex items-center space-x-6">
          {/* Rewind Button */}
          <button
            onClick={onRewind}
            className="w-8 h-8 flex items-center justify-center text-white hover:text-[#e25822] transition-colors relative"
            style={{ transform: 'scaleX(-1)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 11-9-9" strokeLinecap="round" />
              <path d="M12 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Play/Pause Button */}
          <button
            onClick={isPlaying ? onPause : onPlay}
            className="w-10 h-10 flex items-center justify-center bg-[#e25822] rounded-full text-white hover:bg-[#d04d1d] transition-colors"
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
            className="w-8 h-8 flex items-center justify-center text-white hover:text-[#e25822] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 11-9-9" strokeLinecap="round" />
              <path d="M12 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Right Section: Speed Control and Settings */}
        <div className="flex items-center space-x-4">
          {/* Speed Control */}
          <button
            onClick={() => onSpeedChange(playbackSpeed === 1 ? 1.5 : 1)}
            className="px-2 py-1 text-sm font-medium text-white hover:text-[#e25822] transition-colors"
          >
            {playbackSpeed}x
          </button>
          
          {/* Settings Gear Icon */}
          <button
            onClick={onSettingsClick}
            className="w-8 h-8 flex items-center justify-center text-white hover:text-[#e25822] transition-colors"
            aria-label="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AudioControls; 