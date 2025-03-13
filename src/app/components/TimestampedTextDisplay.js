import React, { useRef, useEffect, useState } from 'react';

/**
 * TimestampedTextDisplay Component
 * Displays word-level timestamps with highlighting for the currently playing word
 */
export default function TimestampedTextDisplay({ timestamps, currentWordIndex, onWordClick }) {
  // Local state for error tracking
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isManualTimestamps, setIsManualTimestamps] = useState(false);
  
  // Ref for the container div to enable auto-scrolling
  const containerRef = useRef(null);
  const wordRefs = useRef({});
  
  // Debug timestamps data and check for manually generated timestamps
  useEffect(() => {
    console.log('TimestampedTextDisplay received timestamps:', timestamps);
    console.log('Current word index:', currentWordIndex);
    
    // Check if these look like manually generated timestamps (very regular spacing)
    if (timestamps && timestamps.length > 2) {
      // Check for perfectly even spacing which would indicate manual generation
      const interval1 = timestamps[1].start_time - timestamps[0].start_time;
      const interval2 = timestamps[2].start_time - timestamps[1].start_time;
      const isRegular = Math.abs(interval1 - interval2) < 0.001;
      
      if (isRegular) {
        console.log('Detected manually generated timestamps');
        setIsManualTimestamps(true);
      } else {
        setIsManualTimestamps(false);
      }
    }
  }, [timestamps]);
  
  // Error handling if timestamps are invalid
  useEffect(() => {
    if (timestamps && timestamps.length > 0) {
      // Check for missing required fields
      const hasInvalidItem = timestamps.some(
        item => typeof item.word !== 'string' || 
                typeof item.start_time !== 'number' || 
                typeof item.end_time !== 'number'
      );
      
      if (hasInvalidItem) {
        setHasError(true);
        setErrorMessage('Invalid timestamp format - missing required fields');
        console.error('Invalid timestamp format:', timestamps[0]);
      } else {
        setHasError(false);
        setErrorMessage('');
      }
    }
  }, [timestamps]);
  
  if (!timestamps || timestamps.length === 0) {
    return (
      <div className="mb-6 mt-4">
        <label className="block text-sm font-medium text-white mb-2">
          Word Timestamps
        </label>
        <div className="w-full px-4 py-3 border border-gray-700 rounded-md shadow-sm bg-[#222222] text-white min-h-[5rem]">
          <p className="text-gray-400">Waiting for timestamps to be available...</p>
        </div>
      </div>
    );
  }
  
  if (hasError) {
    return (
      <div className="mb-6 mt-4">
        <label className="block text-sm font-medium text-white mb-2">
          Word Timestamps
        </label>
        <div className="w-full px-4 py-3 border border-red-800 rounded-md shadow-sm bg-[#2a1a1a] text-white min-h-[5rem]">
          <p className="text-red-400">Error with timestamps: {errorMessage}</p>
        </div>
      </div>
    );
  }

  // Handle clicking on a word to seek to that timestamp
  const handleWordClick = (index) => {
    if (onWordClick && timestamps[index]) {
      console.log(`Clicking on word at index ${index}:`, timestamps[index]);
      onWordClick(timestamps[index].start_time);
    }
  };
  
  // Auto-scroll to keep the current word visible in the container
  useEffect(() => {
    if (currentWordIndex >= 0 && wordRefs.current[currentWordIndex] && containerRef.current) {
      const container = containerRef.current;
      const element = wordRefs.current[currentWordIndex];
      
      console.log(`Auto-scrolling to word at index ${currentWordIndex}`);
      
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      
      // Check if element is not fully visible
      if (
        elementRect.top < containerRect.top ||
        elementRect.bottom > containerRect.bottom
      ) {
        // Calculate scroll position - center the element in the container
        const scrollTop = 
          element.offsetTop - 
          container.offsetHeight / 2 + 
          element.offsetHeight / 2;
        
        container.scrollTo({
          top: scrollTop,
          behavior: 'smooth'
        });
      }
    }
  }, [currentWordIndex]);

  // Helper to modify word rendering for display
  const getDisplayWord = (word, index) => {
    // Remove spaces before/after punctuation to avoid extra spacing
    if (['.', ',', '!', '?', ':', ';'].includes(word)) {
      return word;
    }
    
    // Check if the next word is punctuation and shouldn't have a space
    const nextItem = index < timestamps.length - 1 ? timestamps[index + 1] : null;
    if (nextItem && ['.', ',', '!', '?', ':', ';'].includes(nextItem.word)) {
      return word;
    }
    
    return word;
  };

  return (
    <div className="mb-6 mt-4">
      <label className="block text-sm font-medium text-white mb-2 flex justify-between">
        <span>Word Timestamps {timestamps.length > 0 ? `(${timestamps.length} words)` : ''}</span>
        {isManualTimestamps && (
          <span className="text-yellow-500 text-xs">Using estimated timestamps</span>
        )}
      </label>
      <div 
        ref={containerRef}
        className="w-full px-4 py-3 border border-gray-700 rounded-md shadow-sm bg-[#222222] text-white min-h-[5rem] max-h-[15rem] overflow-y-auto"
      >
        <div style={{ display: 'inline', lineHeight: '2rem' }}>
          {timestamps.map((item, index) => (
            <span
              key={`${item.word}-${index}`}
              ref={el => wordRefs.current[index] = el}
              className={`px-1 py-0.5 rounded ${
                currentWordIndex === index
                  ? 'bg-[#e25822] text-white font-medium'
                  : 'bg-gray-800 text-gray-300'
              } cursor-pointer transition-colors duration-150 ease-in-out hover:bg-gray-700`}
              style={{ margin: 0, display: 'inline-block' }}
              title={`${item.word}: ${item.start_time.toFixed(2)}s - ${item.end_time.toFixed(2)}s`}
              onClick={() => handleWordClick(index)}
            >
              {item.word}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-400 flex justify-between">
        <p>Click on a word to jump to that point in the audio.</p>
        {currentWordIndex >= 0 && timestamps[currentWordIndex] && (
          <p>Current word: "{timestamps[currentWordIndex].word}" ({timestamps[currentWordIndex].start_time.toFixed(2)}s)</p>
        )}
      </div>
    </div>
  );
} 