import React, { useRef, useEffect, useState, useMemo } from 'react';

/**
 * SentenceTextDisplay Component
 * Displays text with sentence-level timestamps and highlighting
 */
export default function SentenceTextDisplay({ timestamps, currentWordIndex, onWordClick }) {
  const [sentences, setSentences] = useState([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1);
  
  // Ref for the container div to enable auto-scrolling
  const containerRef = useRef(null);
  const sentenceRefs = useRef({});
  
  // Group words into sentences based on punctuation
  useEffect(() => {
    if (!timestamps || timestamps.length === 0) return;
    
    const sentenceGroups = [];
    let currentSentence = {
      words: [],
      startTime: null,
      endTime: null,
      text: ''
    };
    
    timestamps.forEach((word, index) => {
      // Start a new sentence if this is the first word
      if (currentSentence.words.length === 0) {
        currentSentence.startTime = word.start_time;
      }
      
      // Add the word to the current sentence
      currentSentence.words.push(word);
      currentSentence.endTime = word.end_time;
      
      // Check if this word ends a sentence
      const endsWithPunctuation = /[.!?]$/.test(word.word);
      const isLastWord = index === timestamps.length - 1;
      
      if (endsWithPunctuation || isLastWord) {
        // Finalize this sentence
        currentSentence.text = currentSentence.words.map(w => w.word).join(' ')
          .replace(/ ([,.!?;:])/g, '$1'); // Fix punctuation spacing
        
        sentenceGroups.push(currentSentence);
        
        // Reset for the next sentence
        currentSentence = {
          words: [],
          startTime: null,
          endTime: null,
          text: ''
        };
      }
    });
    
    console.log('Created', sentenceGroups.length, 'sentence groups');
    setSentences(sentenceGroups);
  }, [timestamps]);
  
  // Update current sentence based on current word index
  useEffect(() => {
    if (currentWordIndex < 0 || sentences.length === 0) {
      setCurrentSentenceIndex(-1);
      return;
    }
    
    // Find which sentence contains the current word
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const wordIndices = sentence.words.map(word => timestamps.indexOf(word));
      
      if (wordIndices.includes(currentWordIndex)) {
        if (i !== currentSentenceIndex) {
          console.log(`Current sentence is now ${i}`);
          setCurrentSentenceIndex(i);
        }
        break;
      }
    }
  }, [currentWordIndex, sentences, timestamps, currentSentenceIndex]);
  
  // Auto-scroll to keep the current sentence visible
  useEffect(() => {
    if (currentSentenceIndex >= 0 && 
        sentenceRefs.current[currentSentenceIndex] && 
        containerRef.current) {
      
      const container = containerRef.current;
      const element = sentenceRefs.current[currentSentenceIndex];
      
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      
      // Check if element is not fully visible
      if (
        elementRect.top < containerRect.top ||
        elementRect.bottom > containerRect.bottom
      ) {
        // Scroll to make the element visible with some padding
        const scrollTop = 
          element.offsetTop - 
          container.offsetHeight / 4;
        
        container.scrollTo({
          top: Math.max(0, scrollTop),
          behavior: 'smooth'
        });
      }
    }
  }, [currentSentenceIndex]);
  
  // Handle clicking on a sentence to seek to that timestamp
  const handleSentenceClick = (index) => {
    if (onWordClick && sentences[index] && sentences[index].startTime !== null) {
      console.log(`Clicking on sentence at index ${index}:`, sentences[index]);
      onWordClick(sentences[index].startTime);
    }
  };
  
  if (!timestamps || timestamps.length === 0) {
    return (
      <div className="mb-6 mt-4">
        <label className="block text-sm font-medium text-white mb-2">
          Text with Timestamps
        </label>
        <div className="w-full px-4 py-3 border border-gray-700 rounded-md shadow-sm bg-[#222222] text-white min-h-[5rem]">
          <p className="text-gray-400">Waiting for timestamps to be available...</p>
        </div>
      </div>
    );
  }
  
  if (sentences.length === 0) {
    return (
      <div className="mb-6 mt-4">
        <label className="block text-sm font-medium text-white mb-2">
          Text with Timestamps
        </label>
        <div className="w-full px-4 py-3 border border-gray-700 rounded-md shadow-sm bg-[#222222] text-white min-h-[5rem]">
          <p className="text-gray-400">Processing sentences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 mt-4">
      <label className="block text-sm font-medium text-white mb-2 flex justify-between">
        <span>Text with Timestamps ({sentences.length} sentences)</span>
      </label>
      <div 
        ref={containerRef}
        className="w-full px-4 py-3 border border-gray-700 rounded-md shadow-sm bg-[#222222] text-white min-h-[5rem] max-h-[25rem] overflow-y-auto"
      >
        <div className="space-y-2">
          {sentences.map((sentence, index) => (
            <p
              key={`sentence-${index}`}
              ref={el => sentenceRefs.current[index] = el}
              className={`p-2 rounded cursor-pointer ${
                currentSentenceIndex === index
                  ? 'bg-[#4a3020] text-white'
                  : 'hover:bg-gray-800'
              }`}
              title={`${sentence.startTime.toFixed(2)}s - ${sentence.endTime.toFixed(2)}s`}
              onClick={() => handleSentenceClick(index)}
            >
              {sentence.text}
            </p>
          ))}
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-400">
        <p>Click on a sentence to jump to that point in the audio.</p>
      </div>
    </div>
  );
} 