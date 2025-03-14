import React, { useState, useEffect, useRef, useMemo } from 'react';
import { performSequenceAlignment, mapAlignedPositionsInText } from '../utils/textAlignmentUtils';

/**
 * HighlightedTextInput Component
 * Displays text with the current word highlighted based on audio playback
 */
export default function HighlightedTextInput({ 
  text, 
  originalText,
  timestamps, 
  currentWordIndex,
  onTextChange,
  isEditable = true,
  viewMode = 'word' // 'word' or 'sentence'
}) {
  const textareaRef = useRef(null);
  const highlightContainerRef = useRef(null);
  const [highlightedRanges, setHighlightedRanges] = useState([]);
  const [currentHighlight, setCurrentHighlight] = useState(null);
  const [alignedData, setAlignedData] = useState(null);
  const [sentences, setSentences] = useState([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1);
  
  // Debug the current state
  useEffect(() => {
    console.log("HighlightedTextInput state:", {
      isEditable,
      viewMode,
      hasTimestamps: timestamps?.length > 0,
      currentWordIndex,
      rangesCount: highlightedRanges?.length || 0,
      sentencesCount: sentences?.length || 0,
      hasCurrentHighlight: !!currentHighlight,
      currentSentenceIndex
    });
  }, [isEditable, viewMode, timestamps, currentWordIndex, highlightedRanges, sentences, currentHighlight, currentSentenceIndex]);
  
  // Perform sequence alignment when timestamps or text changes
  useEffect(() => {
    if (originalText && timestamps && timestamps.length > 0) {
      try {
        console.log("Performing alignment for", timestamps.length, "timestamps");
        
        // Perform alignment between original text and TTS output
        const aligned = performSequenceAlignment(originalText, timestamps);
        setAlignedData(aligned);
        
        // Map aligned data to positions in the original text
        const positions = mapAlignedPositionsInText(originalText, aligned);
        setHighlightedRanges(positions);
        
        console.log("Alignment complete with", positions.length, "mapped positions");
      } catch (error) {
        console.error('Error aligning text:', error);
      }
    } else {
      console.log("Missing data for alignment:", { 
        hasText: !!originalText, 
        timestampCount: timestamps?.length || 0 
      });
      setAlignedData(null);
      setHighlightedRanges([]);
    }
  }, [originalText, timestamps]);
  
  // Group positions into sentences
  const sentenceGroups = useMemo(() => {
    if (!originalText || !highlightedRanges.length) return [];
    
    const groups = [];
    let currentGroup = {
      words: [],
      startPos: null,
      endPos: null,
      startTime: null,
      endTime: null
    };
    
    // Sort ranges by position in text
    const sortedRanges = [...highlightedRanges].sort((a, b) => a.start - b.start);
    
    // Force split long text into smaller phrases (not full sentences)
    // This ensures we don't highlight the entire text as one big sentence
    const maxWordsPerPhrase = 10; // Increased from 6 to 10 words per phrase
    
    sortedRanges.forEach((range, index) => {
      // Start a new phrase if this is the first word
      if (currentGroup.words.length === 0) {
        currentGroup.startPos = range.start;
        currentGroup.startTime = range.timestamp?.start_time;
      }
      
      // Add the word to the current phrase
      currentGroup.words.push(range);
      currentGroup.endPos = range.end;
      currentGroup.endTime = range.timestamp?.end_time;
      
      // Check if this word ends a phrase
      const wordText = originalText.substring(range.start, range.end);
      const endsWithPunctuation = /[.!?]$/.test(wordText);
      const isLastWord = index === sortedRanges.length - 1;
      const reachedMaxLength = currentGroup.words.length >= maxWordsPerPhrase;
      
      if (endsWithPunctuation || isLastWord || reachedMaxLength) {
        // Finalize this phrase
        groups.push({...currentGroup});
        
        // Reset for the next phrase
        currentGroup = {
          words: [],
          startPos: null,
          endPos: null,
          startTime: null,
          endTime: null
        };
      }
    });
    
    console.log(`Created ${groups.length} phrases from ${sortedRanges.length} words:`);
    groups.forEach((group, idx) => {
      const preview = originalText.substring(group.startPos, Math.min(group.startPos + 30, group.endPos));
      console.log(`  Phrase ${idx}: ${preview}${group.endPos - group.startPos > 30 ? '...' : ''} (${group.words.length} words, ${group.startTime?.toFixed(2) || '?'}s - ${group.endTime?.toFixed(2) || '?'}s)`);
    });
    
    return groups;
  }, [originalText, highlightedRanges]);
  
  // Update sentences state when sentence groups change
  useEffect(() => {
    setSentences(sentenceGroups);
  }, [sentenceGroups]);
  
  // Update current sentence based on current word index
  useEffect(() => {
    if (currentWordIndex < 0 || sentences.length === 0 || !timestamps) {
      setCurrentSentenceIndex(-1);
      return;
    }
    
    // Debug current timestamp
    const currentTime = timestamps[currentWordIndex]?.start_time;
    console.log(`Finding sentence for word index ${currentWordIndex} at time ${currentTime?.toFixed(2)}s`);
    
    // IMPROVED APPROACH: Be more selective about which sentence is active
    // This prevents the early issue where the entire text gets highlighted
    
    // Always limit to a reasonable range around the current word
    // This is particularly important during the initial chunks
    if (currentWordIndex === 0) {
      // For the very first word, always use the first sentence
      // and ensure we don't highlight everything
      console.log('First word detected, ensuring we use only the first phrase');
      setCurrentSentenceIndex(0);
      return;
    }
    
    // Find which sentence contains the current word
    let foundIndex = -1;
    
    // First approach: Check if any word in each sentence has matching alignIndex
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      
      // Check if any word in this sentence has the alignIndex matching currentWordIndex
      const hasMatchingWord = sentence.words.some(word => word.alignIndex === currentWordIndex);
      
      if (hasMatchingWord) {
        foundIndex = i;
        console.log(`Found sentence ${i} by exact word index match`);
        break;
      }
    }
    
    // Second approach: Try to find by timestamp (if first approach failed)
    if (foundIndex === -1 && currentTime !== undefined) {
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        
        // Check if the current timestamp falls within this sentence's time range
        if (sentence.startTime !== undefined && sentence.endTime !== undefined) {
          // Add a small buffer to the end time to handle edge cases
          const isInTimeRange = 
            sentence.startTime <= currentTime && 
            (currentTime <= sentence.endTime + 0.1);
            
          if (isInTimeRange) {
            foundIndex = i;
            console.log(`Found sentence ${i} by time range match`);
            break;
          }
        }
      }
    }
    
    // If still no match, use an approximate approach
    if (foundIndex === -1) {
      // Don't highlight everything - find the closest sentence by position
      // First, estimate which sentence we're in based on word proportion
      const estimatedIndex = Math.min(
        Math.floor((currentWordIndex / timestamps.length) * sentences.length),
        sentences.length - 1
      );
      
      // Then look at 2 sentences before and after to find the best match
      let bestMatch = estimatedIndex;
      let closestDiff = Infinity;
      
      const startIdx = Math.max(0, estimatedIndex - 2);
      const endIdx = Math.min(sentences.length - 1, estimatedIndex + 2);
      
      for (let i = startIdx; i <= endIdx; i++) {
        if (sentences[i].words.length > 0) {
          // Calculate how close the current word is to this sentence
          const sentenceMiddleIdx = sentences[i].words[Math.floor(sentences[i].words.length / 2)].alignIndex || 0;
          const diff = Math.abs(currentWordIndex - sentenceMiddleIdx);
          
          if (diff < closestDiff) {
            closestDiff = diff;
            bestMatch = i;
          }
        }
      }
      
      foundIndex = bestMatch;
      console.log(`Using approximate sentence ${foundIndex} (closest by position)`);
    }
    
    // Update the state if we found a valid sentence and it's different from the current one
    if (foundIndex !== -1 && foundIndex !== currentSentenceIndex) {
      console.log(`Setting current sentence to ${foundIndex}`);
      setCurrentSentenceIndex(foundIndex);
    }
  }, [currentWordIndex, sentences, timestamps, currentSentenceIndex]);
  
  // Update the current highlight based on the current word index
  useEffect(() => {
    if (
      currentWordIndex >= 0 && 
      highlightedRanges.length > 0
    ) {
      // Find the matching highlight for the current word index
      let found = false;
      
      // First, look for a direct match by alignIndex
      for (let i = 0; i < highlightedRanges.length; i++) {
        if (highlightedRanges[i].alignIndex === currentWordIndex) {
          setCurrentHighlight(highlightedRanges[i]);
          found = true;
          break;
        }
      }
      
      // If no direct match, try to find the closest one by timestamp
      if (!found && timestamps && timestamps[currentWordIndex]) {
        const targetTime = timestamps[currentWordIndex].start_time;
        let bestMatch = null;
        let bestDiff = Infinity;
        
        for (const range of highlightedRanges) {
          if (range.timestamp && typeof range.timestamp.start_time === 'number') {
            const diff = Math.abs(range.timestamp.start_time - targetTime);
            if (diff < bestDiff) {
              bestDiff = diff;
              bestMatch = range;
            }
          }
        }
        
        if (bestMatch) {
          setCurrentHighlight(bestMatch);
          found = true;
        }
      }
      
      // If still no match, but we have positions, use the positional approach (approximate)
      if (!found && highlightedRanges.length > 0) {
        // Try to map by proportion
        const index = Math.min(
          Math.floor(currentWordIndex / timestamps.length * highlightedRanges.length),
          highlightedRanges.length - 1
        );
        setCurrentHighlight(highlightedRanges[index]);
      }
    } else {
      setCurrentHighlight(null);
    }
  }, [currentWordIndex, highlightedRanges, timestamps]);
  
  // Scroll to keep the current word/sentence visible when in read-only mode
  useEffect(() => {
    if (!isEditable && highlightContainerRef.current) {
      try {
        if (viewMode === 'word' && currentHighlight) {
          // Find the highlight element by data attribute
          const highlightEl = highlightContainerRef.current.querySelector(
            `[data-highlight-index="${highlightedRanges.indexOf(currentHighlight)}"]`
          );
          
          if (highlightEl) {
            // Scroll the element into view
            highlightEl.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
          }
        } else if (viewMode === 'sentence' && currentSentenceIndex >= 0) {
          // Find the sentence element by data attribute
          const sentenceEl = highlightContainerRef.current.querySelector(
            `[data-sentence-index="${currentSentenceIndex}"]`
          );
          
          if (sentenceEl) {
            // Scroll the element into view
            sentenceEl.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
          }
        }
      } catch (error) {
        console.error('Error scrolling to highlighted element:', error);
      }
    }
  }, [currentHighlight, currentSentenceIndex, viewMode, isEditable, highlightedRanges]);
  
  // Handle text changes when editable
  const handleTextChange = (e) => {
    if (onTextChange) {
      onTextChange(e);
    }
  };
  
  // Render the text with highlighted words
  const renderHighlightedWords = () => {
    if (!originalText || highlightedRanges.length === 0) {
      return <div className="text-gray-400">{originalText || 'No text available'}</div>;
    }
    
    // Create an array to hold all the text fragments
    const fragments = [];
    let lastEnd = 0;
    
    // Sort the ranges by start position to ensure correct rendering order
    const sortedRanges = [...highlightedRanges].sort((a, b) => a.start - b.start);
    
    // Create text fragments with and without highlighting
    sortedRanges.forEach((range, index) => {
      // Add text before this range
      if (range.start > lastEnd) {
        fragments.push(
          <span key={`text-${lastEnd}`} className="text-gray-300">
            {originalText.substring(lastEnd, range.start)}
          </span>
        );
      }
      
      // Add the highlighted word
      const isCurrentWord = range === currentHighlight;
      fragments.push(
        <span 
          key={`highlight-${range.start}`}
          data-highlight-index={index}
          className={`transition-colors duration-200 ${
            isCurrentWord 
              ? 'bg-[#e25822] text-white px-1 py-0.5 rounded' 
              : 'text-gray-100 hover:bg-gray-700 hover:text-white'
          }`}
          title={`${range.word} (${range.timestamp?.start_time?.toFixed(2) || '?'}s - ${range.timestamp?.end_time?.toFixed(2) || '?'}s)`}
        >
          {originalText.substring(range.start, range.end)}
        </span>
      );
      
      lastEnd = range.end;
    });
    
    // Add any remaining text
    if (lastEnd < originalText.length) {
      fragments.push(
        <span key={`text-end`} className="text-gray-300">
          {originalText.substring(lastEnd)}
        </span>
      );
    }
    
    return fragments;
  };
  
  // Render the text with highlighted sentences (actually smaller phrases)
  const renderHighlightedSentences = () => {
    if (!originalText || sentences.length === 0) {
      return <div className="text-gray-400">{originalText || 'No text available'}</div>;
    }
    
    // Create an array to hold all the text fragments
    const fragments = [];
    let lastEnd = 0;
    
    // Create text fragments with and without highlighting
    sentences.forEach((sentence, index) => {
      // Add text before this sentence
      if (sentence.startPos > lastEnd) {
        fragments.push(
          <span key={`gap-${lastEnd}`} className="text-gray-300">
            {originalText.substring(lastEnd, sentence.startPos)}
          </span>
        );
      }
      
      // Add the highlighted sentence
      const isCurrentSentence = index === currentSentenceIndex;
      fragments.push(
        <span 
          key={`sentence-${index}`}
          data-sentence-index={index}
          className={`transition-colors duration-300 ${
            isCurrentSentence 
              ? 'bg-[#e25822] text-white px-2 py-1 rounded shadow-lg transform font-medium' 
              : 'hover:bg-gray-700 hover:text-white text-gray-100'
          }`}
          title={`Phrase ${index+1}: ${sentence.startTime?.toFixed(2) || '?'}s - ${sentence.endTime?.toFixed(2) || '?'}s`}
        >
          {originalText.substring(sentence.startPos, sentence.endPos)}
        </span>
      );
      
      lastEnd = sentence.endPos;
    });
    
    // Add any remaining text
    if (lastEnd < originalText.length) {
      fragments.push(
        <span key={`end-gap`} className="text-gray-300">
          {originalText.substring(lastEnd)}
        </span>
      );
    }
    
    return fragments;
  };
  
  return (
    <div className="relative w-full">
      {isEditable ? (
        // Editable mode - show textarea
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          rows={18}
          className="w-full px-3 py-2 border border-gray-700 rounded-md shadow-sm bg-[#222222] text-white min-h-[24rem] h-auto focus:ring-1 focus:ring-[#e25822] focus:border-[#e25822] outline-none"
          placeholder="Enter text to convert to speech..."
          spellCheck="true"
          style={{ fontSize: '1rem', lineHeight: '1.5' }}
        />
      ) : (
        // Read-only mode with highlighting
        <div 
          ref={highlightContainerRef}
          className="w-full px-3 py-2 border border-gray-700 rounded-md shadow-sm bg-[#222222] text-white min-h-[24rem] max-h-[24rem] h-auto overflow-y-auto whitespace-pre-wrap"
          style={{ 
            fontSize: '1rem', 
            lineHeight: '1.5',
            userSelect: 'text'
          }}
        >
          {viewMode === 'word' 
            ? renderHighlightedWords() 
            : renderHighlightedSentences()
          }
        </div>
      )}
      
      {/* Show alignment info for debugging */}
      {!isEditable && (
        <div className="absolute bottom-2 right-2 text-xs text-gray-400 bg-gray-800 p-1 rounded">
          {viewMode === 'word' && currentHighlight && (
            <span>Word: "{currentHighlight.word}" at {currentHighlight.timestamp?.start_time?.toFixed(2) || '?'}s</span>
          )}
          {viewMode === 'sentence' && currentSentenceIndex >= 0 && sentences[currentSentenceIndex] && (
            <span>Sentence {currentSentenceIndex + 1} at {sentences[currentSentenceIndex].startTime?.toFixed(2) || '?'}s</span>
          )}
        </div>
      )}
    </div>
  );
} 