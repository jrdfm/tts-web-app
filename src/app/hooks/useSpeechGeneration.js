import { useState, useRef, useEffect } from 'react';

/**
 * Custom hook for generating and streaming speech with word-level timestamps
 * @returns {Object} Speech generation state and controls
 */
export default function useSpeechGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Track manually instead of relying on MediaSource API
  const [streamProgress, setStreamProgress] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  
  // Timestamps-related state
  const [timestamps, setTimestamps] = useState([]);
  const [timestampsPath, setTimestampsPath] = useState(null);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  
  // Store the original text for alignment
  const [originalText, setOriginalText] = useState('');
  
  // Refs for audio and streaming
  const audioElementRef = useRef(null);
  const audioBlobUrlRef = useRef(null);
  const controllerRef = useRef(null);
  const chunksRef = useRef([]);
  const totalChunksRef = useRef(0);
  const timestampIntervalRef = useRef(null);
  const playbackStartedRef = useRef(false);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Update time tracking
  useEffect(() => {
    const updateTime = () => {
      if (audioElementRef.current) {
        setCurrentTime(audioElementRef.current.currentTime);
        
        if (audioElementRef.current.duration && !isNaN(audioElementRef.current.duration)) {
          setDuration(audioElementRef.current.duration);
        }
      }
    };

    if (audioElementRef.current) {
      audioElementRef.current.addEventListener('timeupdate', updateTime);
      audioElementRef.current.addEventListener('loadedmetadata', updateTime);
      audioElementRef.current.addEventListener('durationchange', updateTime);
    }

    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.removeEventListener('timeupdate', updateTime);
        audioElementRef.current.removeEventListener('loadedmetadata', updateTime);
        audioElementRef.current.removeEventListener('durationchange', updateTime);
      }
    };
  }, [audioElementRef.current]);

  // Update current word based on timestamps and current time
  useEffect(() => {
    if (isPlaying && timestamps.length > 0) {
      // Clear any existing interval
      if (timestampIntervalRef.current) {
        clearInterval(timestampIntervalRef.current);
      }
      
      // Create new interval to check current word
      timestampIntervalRef.current = setInterval(() => {
        if (!audioElementRef.current) return;
        
        const currentTime = audioElementRef.current.currentTime;
        
        // Simple, direct approach - find the timestamp whose range contains the current time
        let foundIndex = -1;
        
        // Direct match - most efficient
        for (let i = 0; i < timestamps.length; i++) {
          const { start_time, end_time } = timestamps[i];
          if (currentTime >= start_time && currentTime <= end_time) {
            foundIndex = i;
            break;
          }
        }
        
        // Only update if we found a valid index that's different from current
        if (foundIndex !== -1 && foundIndex !== currentWordIndex) {
          // Only log occasionally to reduce console spam
          if (foundIndex % 10 === 0) {
            console.log(`Setting word index to ${foundIndex} at time ${currentTime.toFixed(2)}s`);
          }
          setCurrentWordIndex(foundIndex);
        }
      }, 60); // 60ms is fast enough for responsive highlighting without too much overhead
    } else {
      // Clear interval if not playing
      if (timestampIntervalRef.current) {
        clearInterval(timestampIntervalRef.current);
        timestampIntervalRef.current = null;
      }
    }
    
    return () => {
      if (timestampIntervalRef.current) {
        clearInterval(timestampIntervalRef.current);
        timestampIntervalRef.current = null;
      }
    };
  }, [isPlaying, timestamps, currentWordIndex]);

  // Clean up resources
  const cleanup = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = '';
    }
    
    // Release any object URLs
    if (audioBlobUrlRef.current) {
      URL.revokeObjectURL(audioBlobUrlRef.current);
      audioBlobUrlRef.current = null;
    }
    
    if (timestampIntervalRef.current) {
      clearInterval(timestampIntervalRef.current);
      timestampIntervalRef.current = null;
    }
    
    // Reset the playback started flag
    playbackStartedRef.current = false;
    
    chunksRef.current = [];
    totalChunksRef.current = 0;
    setIsStreaming(false);
    setStreamProgress(0);
    setTimestamps([]);
    setTimestampsPath(null);
    setCurrentWordIndex(-1);
    // Do not clear originalText here to allow alignment after playback stops
  };

  // Stop playing audio
  const stopPlaying = () => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    
    cleanup();
    setIsPlaying(false);
    setIsGenerating(false);
    // We keep originalText to allow alignment to work even after stopping
  };
  
  // Fetch timestamps from the server with retry
  const fetchTimestamps = async (path, retryCount = 0) => {
    try {
      // Skip if we already have timestamps
      if (timestamps && timestamps.length > 0) {
        console.log('Timestamps already loaded, skipping fetch');
        return timestamps;
      }
      
      console.log(`Fetching timestamps from path: ${path} (attempt ${retryCount + 1})`);
      
      // First try the direct path as provided
      let response = await fetch(`http://localhost:8880/dev/timestamps/${path}`);
      
      // If that fails with 404, try common variations
      if (response.status === 404 && retryCount < 2) {
        // Try without .json extension
        if (path.endsWith('.json')) {
          const pathWithoutExt = path.substring(0, path.length - 5);
          console.log(`Trying path without extension: ${pathWithoutExt}`);
          response = await fetch(`http://localhost:8880/dev/timestamps/${pathWithoutExt}`);
        } 
        // Try with .json extension
        else {
          const pathWithExt = `${path}.json`;
          console.log(`Trying path with extension: ${pathWithExt}`);
          response = await fetch(`http://localhost:8880/dev/timestamps/${pathWithExt}`);
        }
      }
      
      if (response.status === 500 && retryCount < 5) {
        // If we get a 500 error, the timestamps might not be ready yet
        const backoffTime = Math.min(500, (retryCount + 1) * 100); // Faster retries
        console.log(`Timestamp fetch returned 500, retrying in ${backoffTime}ms...`);
        
        // Wait with shorter backoff
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        
        // Retry the fetch
        return fetchTimestamps(path, retryCount + 1);
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch timestamps: ${response.status}`);
      }
      
      try {
        const data = await response.json();
        console.log('Timestamps data received:', data);
        
        // Make sure we have valid data before setting it
        if (Array.isArray(data) && data.length > 0) {
          // Make sure each timestamp has the required properties
          const validData = data.every(item => 
            item && typeof item.word === 'string' && 
            typeof item.start_time === 'number' && 
            typeof item.end_time === 'number'
          );
          
          if (validData) {
            console.log(`Setting ${data.length} valid timestamps`);
            setTimestamps(data);
            return data;
          } else {
            console.error('Invalid timestamp format in data');
            return [];
          }
        } else {
          console.error('Invalid timestamp data format:', data);
          return [];
        }
      } catch (jsonError) {
        console.error('Error parsing timestamp JSON:', jsonError);
        throw new Error(`Failed to parse timestamp data: ${jsonError.message}`);
      }
    } catch (error) {
      if (retryCount < 5) {
        const backoffTime = Math.min(1000, (retryCount + 1) * 200); // Faster retries
        console.log(`Error fetching timestamps, retrying in ${backoffTime}ms...`, error);
        
        // Wait with shorter backoff
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        
        // Retry the fetch
        return fetchTimestamps(path, retryCount + 1);
      } else {
        console.error('Error fetching timestamps after retries:', error);
        
        // Even after failing, generate basic timestamps so we have something
        if (chunksRef.current.length > 0 && audioElementRef.current && audioElementRef.current.duration) {
          console.log('Generating fallback timestamps after fetch failures');
          const fallbackTimestamps = generateBasicTimestamps(chunksRef.current, audioElementRef.current.duration);
          if (fallbackTimestamps.length > 0) {
            console.log('Setting generated fallback timestamps');
            setTimestamps(fallbackTimestamps);
          }
        }
        
        setError(`Failed to fetch word timestamps after ${retryCount + 1} attempts.`);
        return [];
      }
    }
  };
  
  // Generate speech from text
  const generateSpeech = async (text, voice, speed = 1.0) => {
    if (!text.trim()) {
      setError('Please enter or upload some text first.');
      return;
    }

    try {
      // Store the original text for alignment
      setOriginalText(text);
      
      // Reset state
      setError('');
      setStatus('Generating speech...');
      setIsGenerating(true);
      setIsStreaming(true);
      setStreamProgress(0);
      setTimestamps([]);
      setCurrentWordIndex(-1);
      
      // Stop any currently playing audio
      cleanup();
      
      // Create a new audio element for this session
      audioElementRef.current = new Audio();
      audioElementRef.current.preload = 'auto';
      
      // Keep track of last processed chunk count for updates
      let lastProcessedChunkCount = 0;
      
      // Add event listeners
      audioElementRef.current.addEventListener('play', () => {
        console.log('Audio play event');
        setIsPlaying(true);
      });
      
      audioElementRef.current.addEventListener('pause', () => {
        console.log('Audio pause event');
        if (!audioElementRef.current.ended) {
          setIsPlaying(false);
        }
      });
      
      audioElementRef.current.addEventListener('ended', () => {
        console.log('Audio ended event fired');
        
        // Always try to continue if we have more chunks
        if (chunksRef.current.length > lastProcessedChunkCount) {
          console.log(`Audio ended with more chunks available, continuing playback`);
          lastProcessedChunkCount = chunksRef.current.length;
          updateAudioFromChunks(true); // Force play because it ended
        } else {
          console.log('Audio ended with no more chunks, finishing playback');
          setIsPlaying(false);
          setStatus('Playback complete');
        }
      });
      
      audioElementRef.current.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        setError(`Audio error: ${e.message || 'Unknown error'}`);
      });
      
      // Create a new abort controller
      controllerRef.current = new AbortController();
      
      // Reset chunks
      chunksRef.current = [];
      totalChunksRef.current = 0;
      
      console.log('Starting speech generation with fetch API...');
      console.log(`Using voice: ${voice}, speed: ${speed}`);
      
      const response = await fetch("http://localhost:8880/dev/captioned_speech", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "kokoro",
          input: text,
          voice: voice,
          speed: speed,
          response_format: "mp3",
          stream: true
        }),
        signal: controllerRef.current.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      setStatus('Receiving audio stream...');
      
      // Read line by line to get JSON data
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let receivedChunks = 0;
      let incompleteChunk = '';
      let allTimestamps = [];
      
      // Process chunks from the stream
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Stream complete');
          break;
        }
        
        // Decode the data as text
        const textChunk = decoder.decode(value, { stream: true });
        
        // Handle potentially incomplete JSON chunks
        const lines = (incompleteChunk + textChunk).split('\n');
        incompleteChunk = lines.pop() || ''; // Store incomplete line for next iteration
        
        // Process each complete line
        for (const line of lines) {
          if (!line.trim()) continue; // Skip empty lines
          
          try {
            // Parse the JSON chunk
            const chunkJson = JSON.parse(line);
            
            // Extract audio (base64) and timestamps
            if (chunkJson.audio) {
              receivedChunks++;
              console.log(`Received chunk ${receivedChunks} with ${chunkJson.audio.length} bytes of base64 audio`);
              
              // Decode base64 audio to binary
              const audioBytes = base64ToArrayBuffer(chunkJson.audio);
              
              // Add audio chunk to our collection
              chunksRef.current.push(audioBytes);
              totalChunksRef.current = receivedChunks;
              
              // Handle timestamps if present
              if (chunkJson.timestamps) {
                // Validate and process the timestamps
                if (Array.isArray(chunkJson.timestamps)) {
                  // Check if timestamps have required fields
                  const validTimestamps = chunkJson.timestamps.filter(ts => 
                    ts && typeof ts.word === 'string' && 
                    typeof ts.start_time === 'number' && 
                    typeof ts.end_time === 'number'
                  );
                  
                  if (validTimestamps.length > 0) {
                    // If this is the first set, just use it
                    if (allTimestamps.length === 0) {
                      allTimestamps = validTimestamps;
                    } else {
                      // Otherwise, merge with existing timestamps
                      allTimestamps = [...allTimestamps, ...validTimestamps];
                    }
                    
                    // Update timestamps in the UI
                    setTimestamps(allTimestamps);
                  }
                }
              }
              
              // Update the display status
              setStatus(`Processing chunk ${receivedChunks}`);
              setStreamProgress(Math.min(receivedChunks * 5, 99));
              
              // Handle new chunk logic in the stream processing
              if (receivedChunks === 1) {
                console.log("Starting initial playback with first chunk");
                await updateAudioFromChunks(true); // Force play first chunk
                lastProcessedChunkCount = 1;
              } 
              // Always update when we have new chunks
              else if (chunksRef.current.length > lastProcessedChunkCount) {
                console.log(`Updating audio with new chunks (${chunksRef.current.length - lastProcessedChunkCount} new chunks)`);
                const wasEnded = audioElementRef.current && audioElementRef.current.ended;
                await updateAudioFromChunks(wasEnded); // Only force play if it ended
                lastProcessedChunkCount = chunksRef.current.length;
              }
            }
          } catch (parseError) {
            console.error('Error parsing JSON chunk:', parseError, 'Line:', line);
          }
        }
      }
      
      // Final update when stream is complete
      console.log('Stream complete, final audio update');
      
      // If playback stopped prematurely, try one final restart
      if (audioElementRef.current && (audioElementRef.current.paused || audioElementRef.current.ended) && 
          chunksRef.current.length > lastProcessedChunkCount) {
        console.log('Final attempt to resume playback with all chunks');
        await updateAudioFromChunks(true);
      }
      
      // Complete
      setIsGenerating(false);
      setIsStreaming(false);
      setStreamProgress(100);
      setStatus('Audio generation complete');
      
    } catch (err) {
      console.error('Error generating speech:', err);
      setError(`Error: ${err.message}`);
      setIsGenerating(false);
      setIsPlaying(false);
      setStatus('');
      setIsStreaming(false);
      cleanup();
    }
  };

  // Helper function to convert base64 to ArrayBuffer
  const base64ToArrayBuffer = (base64) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  // Update audio from chunks - simplified to work with binary data directly
  const updateAudioFromChunks = async (forcePlay = false) => {
    try {
      if (!audioElementRef.current) {
        console.error('Audio element not available');
        return;
      }

      // Log what we're doing
      console.log(`Creating audio blob with ${chunksRef.current.length} chunks`);
      
      // Capture current playback state
      const wasPlaying = !audioElementRef.current.paused;
      const currentPosition = audioElementRef.current.currentTime || 0;
      
      // Create a blob from all chunks received so far
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/mpeg' });
      
      // Clean up old URL if needed
      if (audioBlobUrlRef.current) {
        URL.revokeObjectURL(audioBlobUrlRef.current);
      }
      
      // Create new URL for the blob
      audioBlobUrlRef.current = URL.createObjectURL(audioBlob);
      
      // Handle differently based on whether this is the first chunk or an update
      if (totalChunksRef.current === 1 || !playbackStartedRef.current) {
        console.log('First audio update - initializing audio');
        
        // For first chunk, just set the source and play when ready
        audioElementRef.current.src = audioBlobUrlRef.current;
        
        // Wait for audio to be ready with a short timeout
        const canPlay = await new Promise(resolve => {
          const onCanPlay = () => {
            audioElementRef.current.removeEventListener('canplaythrough', onCanPlay);
            resolve(true);
          };
          audioElementRef.current.addEventListener('canplaythrough', onCanPlay, { once: true });
          
          // Short timeout for first chunk - don't wait too long
          setTimeout(() => resolve(false), 300);
        });
        
        if (canPlay && forcePlay) {
          try {
            await audioElementRef.current.play();
            playbackStartedRef.current = true;
            console.log('Initial playback started successfully');
          } catch (err) {
            console.error('Initial play failed (possibly autoplay restriction):', err);
            setStatus('Click play to start (browser restriction)');
          }
        }
      } else {
        // This is a subsequent update - we need to maintain playback state
        console.log(`Updating existing audio, position: ${currentPosition}, playing: ${wasPlaying}`);
        
        // Update the source
        audioElementRef.current.src = audioBlobUrlRef.current;
        
        // Wait for audio to be ready - but with shorter timeout
        await new Promise(resolve => {
          const onCanPlay = () => {
            audioElementRef.current.removeEventListener('canplaythrough', onCanPlay);
            resolve();
          };
          audioElementRef.current.addEventListener('canplaythrough', onCanPlay, { once: true });
          
          // Shorter timeout for subsequent chunks
          setTimeout(resolve, 200);
        });
        
        // Restore position if needed
        if (currentPosition > 0 && !isNaN(currentPosition)) {
          try {
            audioElementRef.current.currentTime = currentPosition;
          } catch (err) {
            console.warn('Could not restore playback position:', err);
          }
        }
        
        // Resume playback if it was playing before
        if (wasPlaying) {
          try {
            console.log('Resuming playback');
            await audioElementRef.current.play();
          } catch (err) {
            console.error('Failed to resume playback:', err);
          }
        }
      }
    } catch (error) {
      console.error('Error updating audio:', error);
    }
  };

  // Handle play/pause toggle
  const handlePlayPause = () => {
    if (!audioElementRef.current) {
      console.error('No audio element available');
      return;
    }
    
    if (isPlaying) {
      console.log('Pausing audio playback');
      audioElementRef.current.pause();
      // We'll let the 'pause' event listener update the state
    } else {
      console.log('Starting audio playback');
      try {
        // Get current audio state
        if (audioElementRef.current.readyState >= 2) { // HAVE_CURRENT_DATA or better
          const playPromise = audioElementRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.error("Error playing audio:", error);
              setError("Browser blocked autoplay. Please try again.");
            });
          }
          // We'll let the 'play' event listener update the state
        } else {
          setStatus('Audio not ready yet, try again in a moment');
        }
      } catch (error) {
        console.error('Error in handlePlayPause:', error);
      }
    }
  };

  // Handle seeking in the audio
  const handleSeek = (e) => {
    if (audioElementRef.current && audioElementRef.current.duration) {
      const progressBar = e.currentTarget;
      const bounds = progressBar.getBoundingClientRect();
      const x = Math.max(0, e.clientX - bounds.left);
      const width = bounds.width;
      
      // Ensure we don't divide by zero and percentage is between 0 and 1
      if (width > 0) {
        const percentage = Math.min(1, Math.max(0, x / width));
        const seekTime = percentage * audioElementRef.current.duration;
        
        console.log(`Seeking to ${seekTime.toFixed(2)}s (duration: ${audioElementRef.current.duration.toFixed(2)}s)`);
        
        // Seek to the desired time
        try {
          audioElementRef.current.currentTime = seekTime;
          
          // Update current word based on seek position
          if (timestamps.length > 0) {
            for (let i = 0; i < timestamps.length; i++) {
              if (seekTime >= timestamps[i].start_time && seekTime <= timestamps[i].end_time) {
                setCurrentWordIndex(i);
                break;
              }
            }
          }
          
          // Auto-play if paused
          if (audioElementRef.current.paused) {
            const playPromise = audioElementRef.current.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => setIsPlaying(true))
                .catch(error => console.error("Error playing after seek:", error));
            } else {
              setIsPlaying(true);
            }
          }
        } catch (error) {
          console.error('Error seeking:', error);
        }
      }
    }
  };

  // Handle speed change
  const handleSpeedChange = (speed) => {
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = speed;
    }
  };

  // Handle rewind
  const handleRewind = () => {
    if (audioElementRef.current) {
      const newTime = Math.max(0, audioElementRef.current.currentTime - 10);
      audioElementRef.current.currentTime = newTime;
      
      // Update current word based on new position
      if (timestamps.length > 0) {
        for (let i = 0; i < timestamps.length; i++) {
          if (newTime >= timestamps[i].start_time && newTime <= timestamps[i].end_time) {
            setCurrentWordIndex(i);
            break;
          }
        }
      }
    }
  };

  // Handle forward
  const handleForward = () => {
    if (audioElementRef.current) {
      const newTime = Math.min(
        audioElementRef.current.duration || 0,
        audioElementRef.current.currentTime + 10
      );
      audioElementRef.current.currentTime = newTime;
      
      // Update current word based on new position
      if (timestamps.length > 0) {
        for (let i = 0; i < timestamps.length; i++) {
          if (newTime >= timestamps[i].start_time && newTime <= timestamps[i].end_time) {
            setCurrentWordIndex(i);
            break;
          }
        }
      }
    }
  };

  // Find word at specific time
  const getWordAtTime = (time) => {
    if (!timestamps || timestamps.length === 0) return null;
    
    for (let i = 0; i < timestamps.length; i++) {
      if (time >= timestamps[i].start_time && time <= timestamps[i].end_time) {
        return timestamps[i];
      }
    }
    
    return null;
  };

  // Generate simple timestamps manually when server fails to provide them
  const generateBasicTimestamps = (text, audioDuration) => {
    if (!text || !audioDuration) return [];
    
    console.log('Generating basic timestamps for text with duration:', audioDuration.toFixed(2) + 's');
    
    // Handle different input types (text string or chunks)
    let cleanedText = '';
    
    // If input is a typed array or array buffer, try to convert it
    if (typeof text !== 'string') {
      try {
        // If it's an array of chunks, try to decode it
        if (Array.isArray(text)) {
          console.log('Input appears to be an array of chunks, attempting to decode');
          // Convert chunks to a string
          const decoder = new TextDecoder();
          const chunks = text.map(chunk => {
            if (chunk instanceof Uint8Array) return chunk;
            return new Uint8Array(chunk);
          });
          
          // Try to decode the audio as text (this will likely be garbled if it's raw MP3 data)
          // but might work for some formats
          cleanedText = chunks.map(chunk => decoder.decode(chunk, {stream: true})).join('');
          
          // If we got gibberish (which is likely), use a placeholder
          if (cleanedText.replace(/[a-zA-Z0-9\s.,?!]/g, '').length > cleanedText.length * 0.5) {
            console.log('Decoded text appears to be binary data, using placeholder');
            // Create a placeholder text with a sensible number of words based on audio duration
            // Assume average of 2-3 words per second of audio
            const wordCount = Math.max(5, Math.round(audioDuration * 2.5));
            console.log(`Generating ${wordCount} placeholder words`);
            cleanedText = Array(wordCount).fill('word').join(' ');
          }
        }
      } catch (e) {
        console.error('Error decoding input:', e);
        cleanedText = 'Error decoding speech text';
      }
    } else {
      cleanedText = text;
    }
    
    // Clean up text - remove extra whitespace, handle punctuation
    cleanedText = cleanedText.trim()
      // Replace multiple spaces with a single space
      .replace(/\s+/g, ' ')
      // Add space after punctuation if missing
      .replace(/([.,!?:;])(\w)/g, '$1 $2');
      
    // Split text into words, preserving punctuation with the previous word
    const wordMatches = cleanedText.match(/\S+\s*/g) || [];
    const words = wordMatches.map(w => w.trim());
    
    if (words.length === 0) return [];
    
    console.log(`Found ${words.length} words to timestamp`);
    
    // Adjust timing
    const totalAdjustedDuration = audioDuration * 0.97; // Allow space at the end
    const avgWordDuration = totalAdjustedDuration / words.length;
    
    // Add slight pauses after punctuation
    const pauseAfterPunctuation = {
      '.': avgWordDuration * 0.3,
      '!': avgWordDuration * 0.3,
      '?': avgWordDuration * 0.3,
      ',': avgWordDuration * 0.1,
      ':': avgWordDuration * 0.2,
      ';': avgWordDuration * 0.2,
    };
    
    // Create timestamps
    const timestamps = [];
    let currentTime = 0;
    
    words.forEach((word, index) => {
      // Calculate this word's duration
      let wordDuration = avgWordDuration;
      const lastChar = word.slice(-1);
      
      // Adjust duration based on word length and punctuation
      if (word.length > 8) {
        wordDuration *= 1.1; // Longer words take more time
      } else if (word.length < 3) {
        wordDuration *= 0.8; // Shorter words take less time
      }
      
      const start_time = currentTime;
      const end_time = start_time + wordDuration;
      
      timestamps.push({
        word: word,
        start_time: start_time,
        end_time: end_time
      });
      
      // Move current time forward, adding pause if needed
      currentTime = end_time;
      if (pauseAfterPunctuation[lastChar]) {
        currentTime += pauseAfterPunctuation[lastChar];
      }
    });
    
    // Scale timestamps to fit the audio duration if needed
    if (timestamps.length > 0 && timestamps[timestamps.length - 1].end_time > audioDuration) {
      const scaleFactor = audioDuration / timestamps[timestamps.length - 1].end_time;
      
      for (const ts of timestamps) {
        ts.start_time *= scaleFactor;
        ts.end_time *= scaleFactor;
      }
    }
    
    console.log(`Generated ${timestamps.length} basic timestamps over ${audioDuration.toFixed(2)}s`);
    return timestamps;
  };

  // Add a new function for fetching timestamps per chunk
  const fetchTimestampsForChunk = async (basePath, chunkIndex) => {
    if (timestamps && timestamps.length > 0) {
      console.log('Timestamps already loaded, skipping fetch');
      return;
    }
    
    try {
      console.log(`Fetching timestamps for chunk ${chunkIndex}, path: ${basePath}`);
      
      // Try multiple variations of the path at once to increase chances of success
      const pathVariations = [
        // Direct request with chunk
        `http://localhost:8880/dev/timestamps/${basePath}?chunk=${chunkIndex}`,
        // Standard path without query
        `http://localhost:8880/dev/timestamps/${basePath}`,
        // With chunk in the path
        `http://localhost:8880/dev/timestamps/${basePath}_${chunkIndex}`,
        // With and without .json extension
        basePath.endsWith('.json') 
          ? `http://localhost:8880/dev/timestamps/${basePath.substring(0, basePath.length - 5)}` 
          : `http://localhost:8880/dev/timestamps/${basePath}.json`,
        // Alternate format that some servers might use
        `http://localhost:8880/dev/timestamps?path=${basePath}&chunk=${chunkIndex}`
      ];
      
      // Log all the paths we're trying
      console.log('Trying multiple timestamp path variations:', pathVariations);
      
      // Try each path until one works
      for (const url of pathVariations) {
        try {
          console.log(`Attempting fetch from: ${url}`);
          const response = await fetch(url);
          
          // Handle different status codes
          if (response.status === 200) {
            try {
              const data = await response.json();
              if (isValidTimestampData(data)) {
                console.log(`Successfully fetched ${data.length} timestamps from ${url}`);
                setTimestamps(data);
                return data;
              } else {
                console.log(`Data from ${url} is not valid timestamp format`);
              }
            } catch (jsonError) {
              console.log(`Error parsing JSON from ${url}:`, jsonError.message);
            }
          } else if (response.status === 404) {
            console.log(`Path not found (404): ${url}`);
          } else if (response.status === 500) {
            console.log(`Server error (500) for ${url} - likely still processing`);
            // Server reported an error, we might want to retry this path specifically
          } else {
            console.log(`Unexpected status ${response.status} from ${url}`);
          }
        } catch (fetchError) {
          console.log(`Network error fetching ${url}:`, fetchError.message);
        }
      }
      
      // None of the paths worked, log the attempt
      console.log(`All timestamp fetch attempts failed for chunk ${chunkIndex}`);
      
      // Return null to indicate failure
      return null;
    } catch (error) {
      console.warn(`Error in fetchTimestampsForChunk:`, error);
      return null;
    }
  };

  // Helper function to validate timestamp data
  const isValidTimestampData = (data) => {
    return Array.isArray(data) && data.length > 0 && data.every(item => 
      item && typeof item.word === 'string' && 
      typeof item.start_time === 'number' && 
      typeof item.end_time === 'number'
    );
  };

  return {
    // State
    isGenerating,
    isPlaying,
    isStreaming,
    status,
    error,
    currentTime,
    duration,
    streamProgress,
    
    // Timestamp related
    timestamps,
    currentWordIndex,
    originalText,  // Expose the original text
    
    // Refs
    audioElementRef,
    
    // Methods
    generateSpeech,
    stopPlaying,
    handlePlayPause,
    handleSeek,
    handleSpeedChange,
    handleRewind,
    handleForward,
    getWordAtTime,
  };
} 