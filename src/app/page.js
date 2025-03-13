'use client';

import { useState, useRef, useEffect } from 'react';
import OpenAI from 'openai';
import AudioControls from './components/AudioControls';

export default function Home() {
  const [text, setText] = useState('This is a test of the Kokoro text-to-speech system.');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [file, setFile] = useState(null);
  const [voice, setVoice] = useState('bm_lewis');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isBrowser, setIsBrowser] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedOptions, setShowSpeedOptions] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [pageWidth, setPageWidth] = useState(95);
  const [isDragging, setIsDragging] = useState(false);
  const [highlightStart, setHighlightStart] = useState(0);
  const [highlightEnd, setHighlightEnd] = useState(0);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [wordTimestamps, setWordTimestamps] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const textContainerRef = useRef(null);
  
  const audioRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const sourceBufferRef = useRef(null);
  const audioElementRef = useRef(null);
  const downloadUrlRef = useRef(null);
  const controllerRef = useRef(null);
  const openaiClientRef = useRef(null);
  const settingsRef = useRef(null);
  const speedOptionsRef = useRef(null);

  // Fix hydration issues by setting isBrowser state only after component mounts
  useEffect(() => {
    setIsBrowser(true);
    
    // Initialize the OpenAI client once on the client side
    if (typeof window !== 'undefined') {
      openaiClientRef.current = new OpenAI({
        baseURL: 'http://localhost:8880/v1',
        apiKey: 'not-needed',
        dangerouslyAllowBrowser: true // Required for client-side usage
      });
    }
  }, []);

  // Add click outside handler for settings dropdown
  useEffect(() => {
    if (!showSettings) return;

    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettings(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettings]);

  // Add click outside handler for speed options dropdown
  useEffect(() => {
    if (!showSpeedOptions) return;

    const handleClickOutside = (event) => {
      if (speedOptionsRef.current && !speedOptionsRef.current.contains(event.target)) {
        setShowSpeedOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSpeedOptions]);

  useEffect(() => {
    // Clean up audio resources on unmount
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = '';
    }
    
    // Release any object URLs
    if (downloadUrlRef.current) {
      URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = null;
    }
    
    // Abort any ongoing fetch
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    
    // Reset highlighting when cleaning up
    setIsHighlighting(false);
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
    
    // If text changes, we need to adjust highlight positions or disable highlighting
    if (isHighlighting) {
      const newLength = e.target.value.length;
      const oldLength = text.length;
      
      // Simple approach: if text got shorter, potentially disable highlighting
      if (newLength < oldLength && (highlightStart >= newLength || highlightEnd >= newLength)) {
        setIsHighlighting(false);
      }
    }
  };

  const handleVoiceChange = (e) => {
    setVoice(e.target.value);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      
      // Read the file content and set it as text
      const reader = new FileReader();
      reader.onload = (event) => {
        setText(event.target.result);
      };
      reader.readAsText(selectedFile);
    }
  };

  // Handle drag events for file upload
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      
      // Read the file content and set it as text
      const reader = new FileReader();
      reader.onload = (event) => {
        setText(event.target.result);
      };
      reader.readAsText(droppedFile);
    }
  };

  const stopPlaying = () => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    
    cleanup();
    setIsPlaying(false);
    setIsGenerating(false);
  };

  // Update the generateSpeech function to use the standard OpenAI-compatible TTS endpoint and implement a simpler streaming approach
  const generateSpeech = async () => {
    if (!text.trim()) {
      setError('Please enter or upload some text first.');
      return;
    }

    try {
      setError('');
      setStatus('Generating speech...');
      setIsGenerating(true);
      setWordTimestamps([]);
      setCurrentWordIndex(-1);
      
      // Stop any currently playing audio
      cleanup();
      
      // Create a new abort controller for the fetch request
      controllerRef.current = new AbortController();
      
      try {
        // Simpler approach - use the OpenAI-compatible TTS endpoint
        setStatus('Starting speech generation...');
        
        // Generate timestamps for the words in the text
        const words = [];
        let position = 0;
        const textWords = text.match(/\S+/g) || [];
        
        for (const word of textWords) {
          // Find the position in the original text
          const pos = text.indexOf(word, position);
          if (pos >= 0) {
            words.push({
              text: word,
              pos: pos
            });
            position = pos + word.length;
          }
        }
        
        // Use the OpenAI API client to generate speech
        const audioResponse = await fetch('http://localhost:8880/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: "kokoro",
            voice: voice,
            input: text,
            response_format: "mp3",
            speed: playbackSpeed
          }),
          signal: controllerRef.current.signal,
        });
        
        if (!audioResponse.ok) {
          throw new Error(`API request failed with status ${audioResponse.status}: ${await audioResponse.text()}`);
        }
        
        // Get the audio data as a blob
        const audioBlob = await audioResponse.blob();
        
        // Create a URL for the audio blob
        if (downloadUrlRef.current) {
          URL.revokeObjectURL(downloadUrlRef.current);
        }
        const audioUrl = URL.createObjectURL(audioBlob);
        downloadUrlRef.current = audioUrl;
        
        // Create the audio element
        audioElementRef.current = new Audio(audioUrl);
        
        // Add event listeners
        audioElementRef.current.addEventListener('ended', () => {
          setIsPlaying(false);
          setStatus('Playback complete');
        });
        
        audioElementRef.current.addEventListener('error', (e) => {
          console.error('Audio error:', e);
          setError(`Audio error: ${e.message || 'Unknown error'}`);
        });
        
        // Set the playback speed
        audioElementRef.current.playbackRate = playbackSpeed;
        
        // Start playing immediately - no need to wait for all data
        audioElementRef.current.addEventListener('loadedmetadata', () => {
          // Generate approximate timestamps based on audio duration
          generateApproximateTimestamps(audioElementRef.current.duration);
        });
        
        await audioElementRef.current.play();
        setIsPlaying(true);
        setStatus('Playing audio...');
        
      } catch (err) {
        console.error('Error with speech generation:', err);
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
      cleanup();
    }
  };
  
  // Function to generate approximate timestamps based on total duration
  const generateApproximateTimestamps = (duration) => {
    // Simple tokenization of words in text
    const words = text.trim().split(/\s+/);
    
    if (words.length === 0 || !duration) {
      return;
    }
    
    // Create a simple linear model of word timing
    // We'll spread the words evenly across the duration
    const timestamps = [];
    let position = 0;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // Find position in original text (with proper spacing)
      const wordPos = text.indexOf(word, position);
      if (wordPos === -1) continue;
      
      position = wordPos + word.length;
      
      // Estimate start time based on word position
      const startTime = (i / words.length) * duration;
      
      timestamps.push({
        text: word,
        start: startTime,
        end: ((i + 1) / words.length) * duration,
        pos: wordPos
      });
    }
    
    // Set the timestamps
    setWordTimestamps(timestamps);
  };

  const downloadAudio = () => {
    if (!audioElementRef.current || !audioElementRef.current.src) {
      setError('No audio available to download');
      return;
    }
    
    try {
      // Create a MediaRecorder to capture audio from the current audio element
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaElementSource(audioElementRef.current.cloneNode());
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);
      
      // Create a MediaRecorder to capture the output
      const recorder = new MediaRecorder(destination.stream);
      const chunks = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        
        // Create a download link
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const a = document.createElement('a');
        a.href = url;
        a.download = `tts_${voice}_${timestamp}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up
        URL.revokeObjectURL(url);
      };
      
      // Start recording
      recorder.start();
      
      // Play the audio for recording (at max speed to save time)
      const tempAudio = source.mediaElement;
      tempAudio.currentTime = 0;
      tempAudio.playbackRate = 2; // Faster playback for quicker capturing
      
      // Once played through, stop the recorder
      tempAudio.onended = () => {
        recorder.stop();
        audioContext.close();
      };
      
      // Start playing
      tempAudio.play().catch(err => {
        console.error('Error capturing audio for download:', err);
        setError('Failed to capture audio for download');
      });
      
      setStatus('Processing download...');
    } catch (error) {
      console.error('Error downloading audio:', error);
      setError(`Download error: ${error.message}`);
    }
  };

  // Enhanced function to handle speed change
  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = speed;
    }
    setShowSpeedOptions(false);
    
    // Reset current word index to force re-evaluation of highlighting on speed change
    setCurrentWordIndex(-1);
  };

  // Toggle speed options dropdown
  const toggleSpeedOptions = () => {
    setShowSpeedOptions(!showSpeedOptions);
  };

  // Add function to handle rewind
  const handleRewind = () => {
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = Math.max(0, audioElementRef.current.currentTime - 10);
      // Reset current word index to force re-evaluation of highlighting position
      setCurrentWordIndex(-1);
    }
  };

  // Add function to handle forward
  const handleForward = () => {
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = Math.min(
        audioElementRef.current.duration,
        audioElementRef.current.currentTime + 10
      );
      // Reset current word index to force re-evaluation of highlighting position
      setCurrentWordIndex(-1);
    }
  };

  // Add function to handle play/pause
  const handlePlayPause = () => {
    if (audioElementRef.current) {
      if (isPlaying) {
        audioElementRef.current.pause();
      } else {
        audioElementRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Add function to update time
  useEffect(() => {
    const updateTime = () => {
      if (audioElementRef.current) {
        setCurrentTime(audioElementRef.current.currentTime);
        setDuration(audioElementRef.current.duration || 0);
      }
    };

    if (audioElementRef.current) {
      audioElementRef.current.addEventListener('timeupdate', updateTime);
      audioElementRef.current.addEventListener('loadedmetadata', updateTime);
    }

    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.removeEventListener('timeupdate', updateTime);
        audioElementRef.current.removeEventListener('loadedmetadata', updateTime);
      }
    };
  }, [audioElementRef.current]);

  // Add handleSeek function
  const handleSeek = (e) => {
    if (audioElementRef.current && duration > 0) {
      const progressBar = e.currentTarget;
      const bounds = progressBar.getBoundingClientRect();
      const x = e.clientX - bounds.left;
      const width = bounds.width;
      const percentage = x / width;
      const seekTime = percentage * duration;
      audioElementRef.current.currentTime = seekTime;
      
      // Reset current word index to force re-evaluation of highlighting position
      setCurrentWordIndex(-1);
    }
  };

  // Toggle settings dropdown
  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  // Handle page width change
  const handlePageWidthChange = (e) => {
    setPageWidth(parseInt(e.target.value, 10));
  };

  // Function to render highlighted text
  const renderHighlightedText = () => {
    if (!text) return null;
    
    // If no highlighting is active, return the plain text
    if (!isHighlighting || highlightStart === highlightEnd || highlightStart >= text.length) {
      return <div className="whitespace-pre-wrap">{text}</div>;
    }
    
    // Ensure valid highlighting positions
    const start = Math.max(0, Math.min(highlightStart, text.length));
    const end = Math.max(start, Math.min(highlightEnd, text.length));
    
    // Split the text into three parts: before highlight, highlighted, and after highlight
    const beforeHighlight = text.substring(0, start);
    const highlighted = text.substring(start, end);
    const afterHighlight = text.substring(end);
    
    return (
      <div className="whitespace-pre-wrap">
        {beforeHighlight}
        <span className="bg-[#e25822] bg-opacity-40 text-white font-medium rounded highlighted-text transition-all duration-300">{highlighted}</span>
        {afterHighlight}
      </div>
    );
  };

  // Function to test highlighting (will be removed later)
  const testHighlighting = () => {
    if (text.length < 10) return;
    
    // Generate random start and end positions
    const start = Math.floor(Math.random() * (text.length - 10));
    const end = start + Math.floor(Math.random() * 20) + 10; // Highlight between 10-30 chars
    
    setHighlightStart(start);
    setHighlightEnd(Math.min(end, text.length));
    setIsHighlighting(true);
  };

  // Function to update highlighting based on audio playback and timestamps
  useEffect(() => {
    if (!isPlaying || !text || !audioElementRef.current || wordTimestamps.length === 0) {
      return;
    }

    // Find the current word based on audio currentTime
    const currentTime = audioElementRef.current.currentTime;
    let newWordIndex = -1;
    
    // Find the word that corresponds to the current time
    for (let i = 0; i < wordTimestamps.length; i++) {
      const timestamp = wordTimestamps[i];
      
      // If this is the last word or the current time is between this word's start and the next word's start
      if (
        i === wordTimestamps.length - 1 || 
        (currentTime >= timestamp.start && currentTime < wordTimestamps[i + 1].start)
      ) {
        newWordIndex = i;
        break;
      }
    }
    
    // If we found a different word than before, update the highlighting
    if (newWordIndex !== -1 && newWordIndex !== currentWordIndex) {
      setCurrentWordIndex(newWordIndex);
      
      // Find the text positions for the current word
      const currentWord = wordTimestamps[newWordIndex];
      
      if (currentWord && currentWord.text && typeof currentWord.pos === 'number') {
        // Calculate start and end positions in the text
        const wordStart = currentWord.pos;
        const wordEnd = wordStart + currentWord.text.length;
        
        // Look ahead to highlight multiple words (more natural reading experience)
        let endPos = wordEnd;
        const lookAheadCount = 5; // Number of words to look ahead
        
        if (newWordIndex + lookAheadCount < wordTimestamps.length) {
          const futureWord = wordTimestamps[newWordIndex + lookAheadCount];
          if (futureWord && typeof futureWord.pos === 'number') {
            endPos = futureWord.pos + futureWord.text.length;
          }
        } else if (wordTimestamps.length > 0) {
          // If near the end, highlight to the end of the last word
          const lastWord = wordTimestamps[wordTimestamps.length - 1];
          endPos = lastWord.pos + lastWord.text.length;
        }
        
        setHighlightStart(wordStart);
        setHighlightEnd(endPos);
        setIsHighlighting(true);
      }
    }
  }, [isPlaying, currentTime, wordTimestamps, currentWordIndex, text]);

  // Reset highlighting when audio stops playing
  useEffect(() => {
    if (!isPlaying) {
      setIsHighlighting(false);
    }
  }, [isPlaying]);

  // Auto-scroll to keep highlighted text visible
  useEffect(() => {
    if (isHighlighting && textContainerRef.current) {
      // Find the highlighted element
      const highlightElement = textContainerRef.current.querySelector('.highlighted-text');
      
      if (highlightElement) {
        // Get the container's scroll position and dimensions
        const container = textContainerRef.current;
        const containerRect = container.getBoundingClientRect();
        const highlightRect = highlightElement.getBoundingClientRect();
        
        // Check if the highlight is outside the visible area
        const isVisible = 
          highlightRect.top >= containerRect.top && 
          highlightRect.bottom <= containerRect.bottom;
        
        if (!isVisible) {
          // Scroll the highlight into view with a small offset
          const scrollOffset = 50;
          const targetScroll = 
            highlightRect.top - 
            containerRect.top - 
            scrollOffset + 
            container.scrollTop;
          
          container.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
          });
        }
      }
    }
  }, [isHighlighting, highlightStart, highlightEnd]);

  return (
    <main className="min-h-screen bg-[#121212] relative flex">
      {/* Settings Gear Icon - Fixed at top right */}
      {isBrowser && (
        <div className="absolute top-3 right-4 z-30">
          <button
            onClick={toggleSettings}
            className="w-8 h-8 flex items-center justify-center text-white hover:text-[#e25822] transition-colors"
            aria-label="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          
          {/* Settings Dropdown */}
          {showSettings && (
            <div ref={settingsRef} className="absolute right-0 top-[calc(100%+4px)] z-10 w-64 bg-[#222222] border border-gray-700 rounded-md shadow-lg">
              <div className="p-3">
                <h3 className="text-white font-medium mb-2">Settings</h3>
                <div className="mb-3">
                  <label className="block text-sm text-white mb-1">
                    Voice
                  </label>
                  <select
                    value={voice}
                    onChange={handleVoiceChange}
                    className="w-full px-2 py-1.5 border border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-[#e25822] focus:border-[#e25822] bg-[#1a1a1a] text-white text-sm"
                  >
                    <option value="bm_lewis">Lewis</option>
                    <option value="bm_emma">Emma</option>
                    <option value="bm_brian">Brian</option>
                  </select>
                </div>
                
                <div className="mb-3">
                  <label className="block text-sm text-white mb-1">
                    Page Width ({pageWidth}%)
                  </label>
                  <input
                    type="range"
                    min="60"
                    max="95"
                    value={pageWidth}
                    onChange={handlePageWidthChange}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>60%</span>
                    <span>95%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Left Panel - Fixed width */}
      <div className="w-24 border-r border-gray-800 bg-[#1a1a1a] overflow-y-auto flex-shrink-0">
        <div className="p-2 pt-16"> {/* Increased top padding to move content down from gear icon */}
          {/* File Upload - No labels */}
          <div 
            className={`flex flex-col items-center justify-center p-2 border-2 border-dashed ${isDragging ? 'border-[#e25822] bg-[#2a2a2a]' : 'border-gray-700 bg-[#222222]'} rounded-md hover:border-[#e25822] transition-colors cursor-pointer`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Upload Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <input
              type="file"
              accept=".txt"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="px-2 py-1 bg-[#2a2a2a] rounded-md text-xs text-white hover:bg-[#333333] cursor-pointer text-center w-full">
              Browse
            </label>
            {file && (
              <div className="mt-2 text-xs text-gray-300 truncate max-w-full overflow-hidden text-center">
                {file.name.length > 8 ? file.name.substring(0, 8) + '...' : file.name}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-auto">
        {/* Audio Controls with Speed Control */}
        <div className="w-full sticky top-0 z-20">
          {isBrowser && (
            <div className="bg-[#1a1a1a] border-b border-gray-800 w-full">
              {/* Controls Container */}
              <div className="max-w-screen-xl mx-auto flex items-center justify-between px-4 py-2 relative">
                {/* Left: Time */}
                <div className="flex items-center space-x-4">
                  <div className="text-[#e25822]">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <div className="text-sm text-white">
                    {!isFinite(duration) || duration === 0 
                      ? `${Math.floor(currentTime / 60)}:${String(Math.floor(currentTime % 60)).padStart(2, '0')} / --:--` 
                      : `${Math.floor(currentTime / 60)}:${String(Math.floor(currentTime % 60)).padStart(2, '0')} / ${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`
                    }
                  </div>
                </div>

                {/* Center: Main Controls */}
                <div className="flex items-center space-x-6">
                  {/* Rewind Button */}
                  <button
                    onClick={handleRewind}
                    className="w-8 h-8 flex items-center justify-center text-white hover:text-[#e25822] transition-colors relative"
                    style={{ transform: 'scaleX(-1)' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 11-9-9" strokeLinecap="round" />
                      <path d="M12 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {/* Play/Pause Button */}
                  <button
                    onClick={handlePlayPause}
                    className="w-10 h-10 flex items-center justify-center bg-[#e25822] rounded-full text-white hover:bg-[#d04d1d] transition-colors"
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
                    onClick={handleForward}
                    className="w-8 h-8 flex items-center justify-center text-white hover:text-[#e25822] transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 11-9-9" strokeLinecap="round" />
                      <path d="M12 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {/* Speed Control Dropdown - Next to Forward Button */}
                  <div className="relative ml-4">
                    <button
                      onClick={toggleSpeedOptions}
                      className="px-2 py-1 text-sm font-medium text-white hover:text-[#e25822] transition-colors flex items-center"
                    >
                      <span>{playbackSpeed}x</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    {showSpeedOptions && (
                      <div ref={speedOptionsRef} className="absolute left-0 top-full mt-1 w-24 bg-[#222222] border border-gray-700 rounded-md shadow-lg z-30">
                        <div className="py-1">
                          {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((speed) => (
                            <button
                              key={speed}
                              onClick={() => handleSpeedChange(speed)}
                              className={`block w-full text-left px-3 py-1 text-sm ${playbackSpeed === speed ? 'text-[#e25822] bg-[#2a2a2a]' : 'text-white hover:bg-[#2a2a2a]'}`}
                            >
                              {speed}x
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Empty Right Side for Balance */}
                <div className="w-24"></div>
              </div>
              
              {/* Progress Bar - Now at the bottom */}
              <div 
                className="h-1 bg-gray-800 cursor-pointer mt-2"
                onClick={handleSeek}
              >
                <div 
                  className="h-full bg-[#e25822] transition-all duration-100" 
                  style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Main Content - Controlled Width */}
        <div className="mx-auto p-6 w-full" style={{ maxWidth: `${pageWidth}%` }}>
          {/* Text Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-white mb-2">
              Text to Speech
            </label>
            <div className="relative w-full">
              {/* Visible text display with highlighting */}
              <div 
                ref={textContainerRef}
                className="w-full px-3 py-2 border border-gray-700 rounded-md shadow-sm bg-[#222222] text-white min-h-[18rem] overflow-y-auto"
              >
                {renderHighlightedText()}
              </div>
              
              {/* Hidden textarea for editing */}
              <textarea
                value={text}
                onChange={handleTextChange}
                rows={18}
                className="absolute top-0 left-0 w-full h-full opacity-0 cursor-text"
                placeholder="Enter text to convert to speech..."
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex justify-center space-x-4">
            <button
              onClick={isGenerating ? stopPlaying : generateSpeech}
              disabled={!text.trim()}
              className={`px-6 py-3 rounded-md font-medium ${
                isGenerating
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : text.trim()
                  ? 'bg-[#e25822] hover:bg-[#d04d1d] text-white'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isGenerating ? 'Stop' : 'Generate & Play Speech'}
            </button>
            
            {/* Test Highlight Button - For development only */}
            <button
              onClick={testHighlighting}
              className="px-6 py-3 rounded-md font-medium bg-gray-700 hover:bg-gray-600 text-white"
            >
              Test Highlight
            </button>
          </div>

          {/* Status and Error Messages */}
          {status && (
            <div className="mt-4 text-center text-sm text-gray-300">
              {status}
            </div>
          )}
          {error && (
            <div className="mt-4 text-center text-sm text-red-400">
              {error}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
