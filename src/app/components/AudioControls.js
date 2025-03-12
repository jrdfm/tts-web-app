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
  onSeek
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
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      {/* Progress Bar */}
      <div 
        className="h-1 bg-gray-200 dark:bg-gray-700 cursor-pointer"
        onClick={handleSeek}
      >
        <div 
          className="h-full bg-blue-500 transition-all duration-100" 
          style={{ width: getProgressWidth() }}
        />
      </div>

      {/* Controls Container */}
      <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-2">
        {/* Left: Logo and Time */}
        <div className="flex items-center space-x-4">
          <div className="text-blue-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <div className="text-sm text-gray-500">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {/* Center: Main Controls */}
        <div className="flex items-center space-x-6">
          {/* Rewind Button */}
          <button
            onClick={onRewind}
            className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-blue-500 transition-colors relative"
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
            className="w-10 h-10 flex items-center justify-center bg-blue-500 rounded-full text-white hover:bg-blue-600 transition-colors"
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
            className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-blue-500 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 11-9-9" strokeLinecap="round" />
              <path d="M12 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Right: Speed Control */}
        <div className="flex items-center">
          <button
            onClick={() => onSpeedChange(playbackSpeed === 1 ? 1.5 : 1)}
            className="px-2 py-1 text-sm font-medium text-gray-700 hover:text-blue-500 transition-colors"
          >
            {playbackSpeed}x
          </button>
        </div>
      </div>
    </div>
  );
};

export default AudioControls; 