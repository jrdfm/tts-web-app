import React from 'react';

/**
 * Component to display word-level timestamps
 * @param {Object} props Component props
 * @param {Array} props.timestamps Array of timestamp objects
 * @param {Number} props.currentWordIndex Index of the current word being spoken
 * @returns {JSX.Element} TimestampDisplay component
 */
const TimestampDisplay = ({ timestamps, currentWordIndex }) => {
  if (!timestamps || timestamps.length === 0) {
    return (
      <div className="timestamps-container bg-gray-100 p-4 rounded-lg shadow-sm text-gray-500 overflow-y-auto max-h-96">
        <p className="text-center italic">No timestamps available yet</p>
      </div>
    );
  }

  return (
    <div className="timestamps-container bg-gray-100 p-4 rounded-lg shadow-sm overflow-y-auto max-h-96">
      <h3 className="text-lg font-medium mb-2">Word Timestamps</h3>
      <div className="timestamps-words flex flex-wrap">
        {timestamps.map((ts, index) => (
          <span
            key={`${ts.word}-${index}`}
            className={`mr-1 px-1 py-0.5 rounded ${
              index === currentWordIndex 
                ? 'bg-blue-500 text-white font-medium' 
                : 'hover:bg-gray-200 cursor-pointer'
            }`}
            title={`${ts.start_time.toFixed(2)}s - ${ts.end_time.toFixed(2)}s`}
          >
            {ts.word}
          </span>
        ))}
      </div>
      
      {/* Show detailed timestamp info for current word */}
      {currentWordIndex >= 0 && currentWordIndex < timestamps.length && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <h4 className="font-medium">Current Word</h4>
          <div className="mt-1 text-sm">
            <p><span className="font-bold">{timestamps[currentWordIndex].word}</span></p>
            <p className="text-gray-600">
              Start: {timestamps[currentWordIndex].start_time.toFixed(2)}s | 
              End: {timestamps[currentWordIndex].end_time.toFixed(2)}s
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimestampDisplay; 