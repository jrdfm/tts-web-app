import { useState, useRef, useEffect } from 'react';
import OpenAI from 'openai';

/**
 * Custom hook for generating and streaming speech
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
  
  // Refs for audio and streaming
  const audioElementRef = useRef(null);
  const audioBlobUrlRef = useRef(null);
  const controllerRef = useRef(null);
  const openaiClientRef = useRef(null);
  const chunksRef = useRef([]);
  const totalChunksRef = useRef(0);

  // Initialize OpenAI client
  useEffect(() => {
    if (typeof window !== 'undefined' && !openaiClientRef.current) {
      openaiClientRef.current = new OpenAI({
        baseURL: 'http://localhost:8880/v1',
        apiKey: 'not-needed',
        dangerouslyAllowBrowser: true
      });
    }
  }, []);

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
    
    chunksRef.current = [];
    totalChunksRef.current = 0;
    setIsStreaming(false);
    setStreamProgress(0);
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
  };
  
  // Create audio from received chunks and play it
  const updateAudioFromChunks = async () => {
    try {
      // Create a new Blob from all chunks received so far
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/mpeg' });
      
      // Create or update the URL for the audio blob
      if (audioBlobUrlRef.current) {
        URL.revokeObjectURL(audioBlobUrlRef.current);
      }
      
      audioBlobUrlRef.current = URL.createObjectURL(audioBlob);
      
      // Store current time to restore position after source change
      const currentPosition = audioElementRef.current ? audioElementRef.current.currentTime : 0;
      const wasPlaying = audioElementRef.current ? !audioElementRef.current.paused : false;
      
      // Create a new audio element if needed
      if (!audioElementRef.current) {
        audioElementRef.current = new Audio();
        
        // Add event listeners for the audio element
        audioElementRef.current.addEventListener('ended', () => {
          setIsPlaying(false);
          setStatus('Playback complete');
        });
        
        audioElementRef.current.addEventListener('error', (e) => {
          console.error('Audio error:', e);
          setError(`Audio error: ${e.message || 'Unknown error'}`);
        });
      }
      
      // Update the source
      audioElementRef.current.src = audioBlobUrlRef.current;
      
      // Wait for metadata to load
      await new Promise((resolve) => {
        const handleLoaded = () => {
          audioElementRef.current.removeEventListener('loadedmetadata', handleLoaded);
          resolve();
        };
        audioElementRef.current.addEventListener('loadedmetadata', handleLoaded, { once: true });
        
        // In case the event doesn't fire
        setTimeout(resolve, 1000);
      });
      
      // Restore position
      if (currentPosition > 0 && currentPosition < audioElementRef.current.duration) {
        audioElementRef.current.currentTime = currentPosition;
      }
      
      // Resume playback if it was playing
      if (wasPlaying) {
        try {
          const playPromise = audioElementRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => console.error("Error playing updated audio:", error));
          }
        } catch (e) {
          console.error("Error resuming playback:", e);
        }
      }
    } catch (error) {
      console.error("Error updating audio from chunks:", error);
    }
  };

  // Generate speech from text
  const generateSpeech = async (text, voice) => {
    if (!text.trim()) {
      setError('Please enter or upload some text first.');
      return;
    }

    try {
      setError('');
      setStatus('Generating speech...');
      setIsGenerating(true);
      setIsStreaming(true);
      setStreamProgress(0);
      
      // Stop any currently playing audio
      cleanup();
      
      // Create a new abort controller
      controllerRef.current = new AbortController();
      
      // Reset chunks
      chunksRef.current = [];
      totalChunksRef.current = 0;
      
      try {
        // Use the OpenAI client for streaming
        console.log('Starting speech generation with OpenAI client...');
        console.log(`Using voice: ${voice}`);
        
        const response = await openaiClientRef.current.audio.speech.create({
          model: "kokoro",
          voice: voice,
          input: text,
          response_format: "mp3",
          stream: true
        });
        
        setStatus('Receiving audio stream...');
        
        let receivedChunks = 0;
        let totalBytes = 0;
        let playbackStarted = false;
        
        // Process the streaming response
        for await (const chunk of response.body) {
          receivedChunks++;
          totalBytes += chunk.byteLength;
          
          // Add chunk to our collection
          chunksRef.current.push(chunk);
          totalChunksRef.current = receivedChunks;
          
          // Update the display status
          setStatus(`Received chunk ${receivedChunks} (${(chunk.byteLength / 1024).toFixed(1)} KB)`);
          
          // Update progress percentage (arbitrary scale for visual feedback)
          setStreamProgress(receivedChunks * 5); // Simple scale for visual feedback
          
          // Create/update audio playback every few chunks to allow seeking
          if (receivedChunks % 5 === 0 || receivedChunks === 1) {
            await updateAudioFromChunks();
            
            // Start playback after receiving some data
            if (!playbackStarted && receivedChunks >= 2) {
              playbackStarted = true;
              
              try {
                const playPromise = audioElementRef.current.play();
                if (playPromise !== undefined) {
                  playPromise
                    .then(() => setIsPlaying(true))
                    .catch(error => console.error("Error starting playback:", error));
                } else {
                  setIsPlaying(true);
                }
              } catch (playError) {
                console.error("Error playing audio:", playError);
              }
            }
          }
        }
        
        // Final update with all chunks
        await updateAudioFromChunks();
        
        // Streaming is complete
        setIsStreaming(false);
        setStatus('Audio streaming complete');
        
      } catch (err) {
        console.error('Error with OpenAI client streaming:', err);
        setIsStreaming(false);
        throw err;
      } finally {
        setIsGenerating(false);
      }
      
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

  // Handle play/pause toggle
  const handlePlayPause = () => {
    if (audioElementRef.current) {
      if (isPlaying) {
        audioElementRef.current.pause();
        setIsPlaying(false);
      } else {
        const playPromise = audioElementRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => setIsPlaying(true))
            .catch(error => console.error("Error starting playback:", error));
        } else {
          setIsPlaying(true);
        }
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
      audioElementRef.current.currentTime = Math.max(0, audioElementRef.current.currentTime - 10);
    }
  };

  // Handle forward
  const handleForward = () => {
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = Math.min(
        audioElementRef.current.duration || 0,
        audioElementRef.current.currentTime + 10
      );
    }
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
    
    // Methods
    generateSpeech,
    stopPlaying,
    handlePlayPause,
    handleSeek,
    handleSpeedChange,
    handleRewind,
    handleForward,
  };
} 