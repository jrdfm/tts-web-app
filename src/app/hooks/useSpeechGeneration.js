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
    setCurrentWordIndex(-1);
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
              if (chunkJson.timestamps && Array.isArray(chunkJson.timestamps)) {
                allTimestamps = [...allTimestamps, ...chunkJson.timestamps];
                setTimestamps(allTimestamps);
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