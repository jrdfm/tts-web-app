/**
 * Text alignment utilities
 * These functions help align the original text with timestamp data from TTS
 */

/**
 * Preprocess text for alignment
 * @param {string} text - Text to preprocess
 * @returns {string} Normalized text
 */
export const preprocessText = (text) => {
  if (!text) return '';
  
  return text.toLowerCase()
    // Handle contractions consistently 
    .replace(/(\w)'(\w)/g, '$1$2')  // Remove apostrophes in contractions
    .replace(/(\d),(\d)/g, '$1$2')  // Remove thousands separators in numbers
    .replace(/[""]/g, '"')          // Normalize quotes
    .replace(/['']/g, "'")          // Normalize apostrophes
    .replace(/[…]/g, '...')         // Normalize ellipses
    .replace(/[—–-]/g, '-')         // Normalize dashes
    .trim();
};

/**
 * Tokenize text into words
 * @param {string} text - Text to tokenize
 * @returns {string[]} Array of tokens
 */
export const tokenizeText = (text) => {
  if (!text) return [];
  
  // Split on whitespace and punctuation, keeping punctuation as separate tokens
  return text.split(/(\s+|[.,!?;:"'()\[\]{}])/g)
    .filter(token => token.trim().length > 0);
};

/**
 * Perform sequence alignment between original text and TTS output
 * @param {string} originalText - Original text
 * @param {Array} ttsTimestamps - Array of timestamps from TTS
 * @returns {Array} Aligned data
 */
export const performSequenceAlignment = (originalText, ttsTimestamps) => {
  if (!originalText || !ttsTimestamps || ttsTimestamps.length === 0) {
    return [];
  }
  
  try {
    // Normalize and tokenize the original text
    const normalizedOriginal = preprocessText(originalText);
    const originalTokens = tokenizeText(normalizedOriginal);
    
    // Extract words from TTS timestamps
    const ttsWords = ttsTimestamps.map(ts => ts.word);
    const normalizedTTS = preprocessText(ttsWords.join(' '));
    const ttsTokens = tokenizeText(normalizedTTS);
    
    // Create alignment matrix using dynamic programming
    // This implements Needleman-Wunsch algorithm
    const alignmentResult = alignSequences(originalTokens, ttsTokens, ttsTimestamps);
    
    return alignmentResult;
  } catch (error) {
    console.error('Error during sequence alignment:', error);
    return [];
  }
};

/**
 * Aligns sequences using Needleman-Wunsch algorithm
 * @param {string[]} originalTokens - Tokens from original text
 * @param {string[]} ttsTokens - Tokens from TTS output
 * @param {Array} ttsTimestamps - Timestamps from TTS
 * @returns {Array} Alignment result
 */
export const alignSequences = (originalTokens, ttsTokens, ttsTimestamps) => {
  // Define scoring parameters
  const MATCH_SCORE = 2;       // Score for matching characters
  const MISMATCH_PENALTY = -1; // Penalty for mismatched characters
  const GAP_PENALTY = -1;      // Penalty for introducing a gap
  
  // Step 1: Create scoring matrix
  const matrix = Array(originalTokens.length + 1)
    .fill()
    .map(() => Array(ttsTokens.length + 1).fill(0));
  
  // Initialize first row and column with gap penalties
  for (let i = 1; i <= originalTokens.length; i++) {
    matrix[i][0] = matrix[i-1][0] + GAP_PENALTY;
  }
  
  for (let j = 1; j <= ttsTokens.length; j++) {
    matrix[0][j] = matrix[0][j-1] + GAP_PENALTY;
  }
  
  // Fill the matrix using dynamic programming
  for (let i = 1; i <= originalTokens.length; i++) {
    for (let j = 1; j <= ttsTokens.length; j++) {
      // Calculate scores for each possible alignment action
      const matchScore = matrix[i-1][j-1] + 
        (originalTokens[i-1] === ttsTokens[j-1] ? MATCH_SCORE : MISMATCH_PENALTY);
      const deleteScore = matrix[i-1][j] + GAP_PENALTY;
      const insertScore = matrix[i][j-1] + GAP_PENALTY;
      
      // Choose best score
      matrix[i][j] = Math.max(matchScore, deleteScore, insertScore);
    }
  }
  
  // Step 2: Trace back through the matrix to find the optimal alignment
  const alignment = [];
  let i = originalTokens.length;
  let j = ttsTokens.length;
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && matrix[i][j] === matrix[i-1][j-1] + 
        (originalTokens[i-1] === ttsTokens[j-1] ? MATCH_SCORE : MISMATCH_PENALTY)) {
      // Matched or mismatched - use original word with timing from TTS
      alignment.unshift({
        originalWord: originalTokens[i-1],
        ttsWord: ttsTokens[j-1],
        isMatch: originalTokens[i-1] === ttsTokens[j-1],
        timestamp: j > 0 ? ttsTimestamps[j-1] : null,
        type: 'match'
      });
      i--; j--;
    } else if (j > 0 && (i === 0 || matrix[i][j] === matrix[i][j-1] + GAP_PENALTY)) {
      // Gap in original sequence (insertion in TTS)
      alignment.unshift({
        originalWord: null,
        ttsWord: ttsTokens[j-1],
        isMatch: false,
        timestamp: j > 0 ? ttsTimestamps[j-1] : null,
        type: 'insertion'
      });
      j--;
    } else {
      // Gap in TTS sequence (deletion)
      alignment.unshift({
        originalWord: originalTokens[i-1],
        ttsWord: null,
        isMatch: false,
        timestamp: null,
        type: 'deletion'
      });
      i--;
    }
  }
  
  // Step 3: Post-process to handle common discrepancies like contractions
  const processed = postProcessAlignment(alignment);
  
  return processed;
};

/**
 * Post-process alignment to handle special cases
 * @param {Array} alignment - Raw alignment result
 * @returns {Array} Processed alignment
 */
export const postProcessAlignment = (alignment) => {
  const processed = [];
  let i = 0;
  
  while (i < alignment.length) {
    // Current item
    const current = alignment[i];
    
    // Handle contractions and other common patterns
    if (i < alignment.length - 1) {
      const next = alignment[i + 1];
      
      // Case 1: Split contraction (don't -> don ' t)
      if (current.ttsWord && next.ttsWord && 
          current.originalWord && !next.originalWord &&
          (next.ttsWord === "'" || next.ttsWord === "t" || next.ttsWord === "s" || 
           next.ttsWord === "re" || next.ttsWord === "ve" || next.ttsWord === "ll")) {
        
        processed.push({
          originalWord: current.originalWord,
          ttsWord: current.ttsWord + next.ttsWord,
          isMatch: true,
          timestamp: {
            word: current.ttsWord + next.ttsWord,
            start_time: current.timestamp ? current.timestamp.start_time : next.timestamp.start_time,
            end_time: next.timestamp ? next.timestamp.end_time : current.timestamp.end_time
          },
          type: 'contraction'
        });
        
        i += 2; // Skip both parts of the contraction
        continue;
      }
    }
    
    // No special case, just add the current item
    processed.push(current);
    i++;
  }
  
  return processed;
};

/**
 * Map positions in the original text to timestamp data
 * This converts the alignment result to character position ranges in the original text
 * @param {string} text - Original text
 * @param {Array} alignment - Alignment data
 * @returns {Array} Position mappings with timestamp data
 */
export const mapAlignedPositionsInText = (text, alignment) => {
  if (!text || !alignment || alignment.length === 0) return [];
  
  console.log("Starting position mapping for", alignment.length, "alignment items");
  
  const positions = [];
  let currentPos = 0;
  let alignmentIndex = 0;
  
  // We'll use a more direct approach - scan through text and find word boundaries
  const words = text.split(/(\s+)/);
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // Skip whitespace tokens
    if (!word.trim()) {
      currentPos += word.length;
      continue;
    }
    
    // Try to match with a word from the alignment
    if (alignmentIndex < alignment.length) {
      const alignItem = alignment[alignmentIndex];
      
      if (alignItem.originalWord && alignItem.timestamp) {
        // Normalize for comparison
        const normalizedTextWord = word.toLowerCase().replace(/[^\w]/g, '');
        const normalizedAlignWord = alignItem.originalWord.toLowerCase().replace(/[^\w]/g, '');
        
        // Check for a match with relaxed criteria
        const isMatch = 
          normalizedTextWord === normalizedAlignWord || 
          normalizedTextWord.includes(normalizedAlignWord) || 
          normalizedAlignWord.includes(normalizedTextWord);
        
        if (isMatch) {
          // We found a match - add position info
          positions.push({
            word: word,
            start: currentPos,
            end: currentPos + word.length,
            timestamp: alignItem.timestamp,
            isMatch: alignItem.isMatch,
            alignIndex: alignmentIndex
          });
          
          alignmentIndex++;
        }
      } else {
        // This alignment item has no original word or timestamp, skip it
        alignmentIndex++;
        i--; // Re-try current word with next alignment item
        continue;
      }
    }
    
    // Move to next position in text
    currentPos += word.length;
  }
  
  console.log(`Mapped ${positions.length} positions out of ${alignment.length} alignment items`);
  
  // If we have very few mappings, try a more aggressive approach
  if (positions.length < alignment.length * 0.5) {
    console.log("Poor mapping ratio, trying again with more aggressive matching");
    
    // Reset everything and try again with looser matching
    positions.length = 0;
    currentPos = 0;
    alignmentIndex = 0;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // Skip whitespace tokens
      if (!word.trim()) {
        currentPos += word.length;
        continue;
      }
      
      // Try to find the best matching alignment item
      if (alignmentIndex < alignment.length) {
        // Look ahead a few items to find the best match
        let bestMatchIndex = -1;
        let bestMatchScore = -1;
        
        // Look at the next few alignment items
        for (let j = 0; j < 5 && alignmentIndex + j < alignment.length; j++) {
          const candidateItem = alignment[alignmentIndex + j];
          
          if (candidateItem.originalWord && candidateItem.timestamp) {
            const normalizedTextWord = word.toLowerCase().replace(/[^\w]/g, '');
            const normalizedCandidateWord = candidateItem.originalWord.toLowerCase().replace(/[^\w]/g, '');
            
            // Calculate a similarity score
            let similarityScore = 0;
            
            if (normalizedTextWord === normalizedCandidateWord) {
              similarityScore = 2; // Exact match
            } else if (normalizedTextWord.includes(normalizedCandidateWord) || 
                       normalizedCandidateWord.includes(normalizedTextWord)) {
              similarityScore = 1; // Partial match
            }
            
            if (similarityScore > bestMatchScore) {
              bestMatchScore = similarityScore;
              bestMatchIndex = alignmentIndex + j;
            }
          }
        }
        
        // Use the best match if we found one
        if (bestMatchIndex >= 0) {
          const matchedItem = alignment[bestMatchIndex];
          
          positions.push({
            word: word,
            start: currentPos,
            end: currentPos + word.length,
            timestamp: matchedItem.timestamp,
            isMatch: matchedItem.isMatch,
            alignIndex: bestMatchIndex
          });
          
          // Skip any alignment items we passed over
          alignmentIndex = bestMatchIndex + 1;
        } else {
          // No good match found, skip this word
          alignmentIndex++;
        }
      }
      
      // Move to next position in text
      currentPos += word.length;
    }
    
    console.log(`Second pass: Mapped ${positions.length} positions out of ${alignment.length} alignment items`);
  }
  
  return positions;
}; 