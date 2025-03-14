import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';

/**
 * TimestampedTextDisplay Component
 * Displays word-level timestamps with highlighting for the currently playing word
 */
export default function TimestampedTextDisplay({ timestamps, currentWordIndex, onWordClick }) {
  // Local state for error tracking
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [sentences, setSentences] = useState([]);
  
  // Ref for the container div to enable auto-scrolling
  const containerRef = useRef(null);
  const wordRefs = useRef({});
  const lastScrollTimeRef = useRef(0);
  
  // Debug timestamps data
  useEffect(() => {
    // Reduce verbosity by only logging when timestamps change significantly
    if (!timestamps || timestamps.length === 0) return;
    
    console.log('TimestampedTextDisplay received timestamps:', 
                timestamps.length > 20 ? `${timestamps.length} words` : timestamps);
  }, [timestamps ? timestamps.length : 0]);
  
  // Group words into sentences
  const processedSentences = useMemo(() => {
    if (!timestamps || timestamps.length === 0) return [];
    
    const sentenceGroups = [];
    let currentSentence = {
      words: [],
      wordIndices: [],
      startTime: null,
      endTime: null
    };
    
    timestamps.forEach((word, index) => {
      // Start a new sentence if this is the first word
      if (currentSentence.words.length === 0) {
        currentSentence.startTime = word.start_time;
      }
      
      // Add the word to the current sentence
      currentSentence.words.push(word);
      currentSentence.wordIndices.push(index);
      currentSentence.endTime = word.end_time;
      
      // Check if this word ends a sentence
      const endsWithPunctuation = /[.!?]$/.test(word.word);
      const isLastWord = index === timestamps.length - 1;
      
      if (endsWithPunctuation || isLastWord) {
        sentenceGroups.push(currentSentence);
        
        // Reset for the next sentence
        currentSentence = {
          words: [],
          wordIndices: [],
          startTime: null,
          endTime: null
        };
      }
    });
    
    console.log('Created', sentenceGroups.length, 'word groups');
    return sentenceGroups;
  }, [timestamps]);
  
  // Update sentences state only when processed sentences change
  useEffect(() => {
    setSentences(processedSentences);
  }, [processedSentences]);
  
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
  
  // Handle clicking on a word to seek to that timestamp - memo for performance
  const handleWordClick = useCallback((index) => {
    if (onWordClick && timestamps[index]) {
      console.log(`Clicking on word at index ${index}:`, timestamps[index]);
      onWordClick(timestamps[index].start_time);
    }
  }, [onWordClick, timestamps]);
  
  // Auto-scroll to keep the current word visible in the container
  useEffect(() => {
    // Skip scrolling if word index hasn't changed or no ref exists
    if (currentWordIndex < 0 || !wordRefs.current[currentWordIndex] || !containerRef.current) {
      return;
    }
    
    // Throttle scrolling to avoid excessive DOM operations
    const now = Date.now();
    if (now - lastScrollTimeRef.current < 100) {
      // Skip this scroll if it's too soon after the last one
      return;
    }
    lastScrollTimeRef.current = now;
    
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
  }, [currentWordIndex]);

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

  return (
    <div className="mb-6 mt-4">
      <label className="block text-sm font-medium text-white mb-2">
        <span>Word Timestamps {timestamps.length > 0 ? `(${timestamps.length} words)` : ''}</span>
      </label>
      <div 
        ref={containerRef}
        className="w-full px-4 py-3 border border-gray-700 rounded-md shadow-sm bg-[#222222] text-white min-h-[5rem] max-h-[15rem] overflow-y-auto"
      >
        <div className="text-gray-300 leading-relaxed" style={{ lineHeight: '1.6' }}>
          {sentences.length > 0 ? (
            sentences.map((sentence, sentenceIndex) => {
              // Check if this sentence ends with punctuation
              const lastWord = sentence.words[sentence.words.length - 1];
              const endsWithPunctuation = lastWord && /[.!?]$/.test(lastWord.word);
              
              return (
                <span
                  key={`sentence-${sentenceIndex}`}
                  className="inline"
                >
                  {sentence.words.map((word, wordIndex) => {
                    const globalIndex = sentence.wordIndices[wordIndex];
                    const isPunctuation = /^[.,!?:;]$/.test(word.word.trim());
                    
                    // Determine if we need space before this word
                    const needsSpace = wordIndex > 0 && !isPunctuation;
                    
                    // Check if this word is the current word - using equality check for performance
                    const isCurrentWord = globalIndex === currentWordIndex;
                    
                    return (
                      <React.Fragment key={`word-${globalIndex}`}>
                        {needsSpace && <span> </span>}
                        <span
                          ref={el => wordRefs.current[globalIndex] = el}
                          className={`${
                            isCurrentWord
                              ? 'bg-[#e25822] text-white font-medium px-1 py-0.5 rounded'
                              : 'hover:underline hover:text-white'
                          } cursor-pointer`}
                          title={`${word.word}: ${word.start_time.toFixed(2)}s - ${word.end_time.toFixed(2)}s`}
                          onClick={() => handleWordClick(globalIndex)}
                        >
                          {word.word}
                        </span>
                      </React.Fragment>
                    );
                  })}
                  {/* Add space between sentences (more after end of sentence) */}
                  {sentenceIndex < sentences.length - 1 && (
                    <span>{endsWithPunctuation ? '  ' : ' '}</span>
                  )}
                </span>
              );
            })
          ) : (
            // Fallback to the flat word list if no sentences were created
            timestamps.map((item, index) => {
              const isPunctuation = /^[.,!?:;]$/.test(item.word.trim());
              const needsSpace = index > 0 && !isPunctuation;
              
              // Check if this word is the current word - using equality check for performance
              const isCurrentWord = index === currentWordIndex;
              
              return (
                <React.Fragment key={`word-fallback-${index}`}>
                  {needsSpace && <span> </span>}
                  <span
                    ref={el => wordRefs.current[index] = el}
                    className={`${
                      isCurrentWord
                        ? 'bg-[#e25822] text-white font-medium px-1 py-0.5 rounded'
                        : 'hover:underline hover:text-white'
                    } cursor-pointer`}
                    title={`${item.word}: ${item.start_time.toFixed(2)}s - ${item.end_time.toFixed(2)}s`}
                    onClick={() => handleWordClick(index)}
                  >
                    {item.word}
                  </span>
                </React.Fragment>
              );
            })
          )}
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