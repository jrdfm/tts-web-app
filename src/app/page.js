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
    
    if (mediaSourceRef.current && mediaSourceRef.current.readyState === 'open') {
      try {
        mediaSourceRef.current.endOfStream();
      } catch (e) {
        console.error('Error ending media source stream:', e);
      }
    }
    
    // Release any object URLs
    if (downloadUrlRef.current) {
      URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = null;
    }
    
    mediaSourceRef.current = null;
    sourceBufferRef.current = null;
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
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

  const generateSpeech = async () => {
    if (!text.trim()) {
      setError('Please enter or upload some text first.');
      return;
    }

    try {
      setError('');
      setStatus('Generating speech...');
      setIsGenerating(true);
      
      // Stop any currently playing audio
      cleanup();
      
      // Create a new abort controller
      controllerRef.current = new AbortController();
      
      // Initialize MediaSource
      mediaSourceRef.current = new MediaSource();
      audioElementRef.current = new Audio();
      audioElementRef.current.src = URL.createObjectURL(mediaSourceRef.current);
      
      // Set up MediaSource when it opens
      await new Promise((resolve) => {
        mediaSourceRef.current.addEventListener('sourceopen', () => {
          sourceBufferRef.current = mediaSourceRef.current.addSourceBuffer('audio/mpeg');
          sourceBufferRef.current.mode = 'sequence';
          resolve();
        });
      });
      
      // Add event listeners
      audioElementRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
        setStatus('Playback complete');
      });
      
      audioElementRef.current.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        setError(`Audio error: ${e.message || 'Unknown error'}`);
      });

      try {
        // Use the OpenAI client for streaming
        console.log('Starting speech generation with OpenAI client...');
        
        const response = await openaiClientRef.current.audio.speech.create({
          model: "kokoro",
          voice: voice,
          input: text,
          response_format: "mp3",
          stream: true
        });
        
        setStatus('Receiving audio stream...');
        
        let hasStartedPlaying = false;
        let receivedChunks = 0;
        
        // Process the streaming response
        for await (const chunk of response.body) {
          receivedChunks++;
          setStatus(`Received chunk ${receivedChunks}`);
          
          // Wait for previous update to complete
          if (sourceBufferRef.current.updating) {
            await new Promise(resolve => {
              sourceBufferRef.current.addEventListener('updateend', resolve, { once: true });
            });
          }
          
          // Append the new chunk
          sourceBufferRef.current.appendBuffer(chunk);
          
          // Start playback once we have some data
          if (!hasStartedPlaying && sourceBufferRef.current.buffered.length > 0) {
            hasStartedPlaying = true;
            audioElementRef.current.play();
            setIsPlaying(true);
          }
          
          // Clean up old data if needed
          if (sourceBufferRef.current.buffered.length > 0) {
            const currentTime = audioElementRef.current.currentTime;
            const start = sourceBufferRef.current.buffered.start(0);
            const end = sourceBufferRef.current.buffered.end(0);
            
            // Remove data more than 30 seconds behind current playback
            if (currentTime - start > 30) {
              const removeEnd = Math.max(start, currentTime - 15);
              if (removeEnd > start && !sourceBufferRef.current.updating) {
                sourceBufferRef.current.remove(start, removeEnd);
              }
            }
          }
        }
        
        // End the stream when done
        if (mediaSourceRef.current.readyState === 'open') {
          mediaSourceRef.current.endOfStream();
        }
        
        setStatus('Audio streaming complete');
        
      } catch (err) {
        console.error('Error with OpenAI client streaming:', err);
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

  const downloadAudio = () => {
    if (!downloadUrlRef.current) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const a = document.createElement('a');
    a.href = downloadUrlRef.current;
    a.download = `tts_${voice}_${timestamp}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Enhanced function to handle speed change
  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = speed;
    }
    setShowSpeedOptions(false);
  };

  // Toggle speed options dropdown
  const toggleSpeedOptions = () => {
    setShowSpeedOptions(!showSpeedOptions);
  };

  // Add function to handle rewind
  const handleRewind = () => {
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = Math.max(0, audioElementRef.current.currentTime - 10);
    }
  };

  // Add function to handle forward
  const handleForward = () => {
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = Math.min(
        audioElementRef.current.duration,
        audioElementRef.current.currentTime + 10
      );
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
            <textarea
              value={text}
              onChange={handleTextChange}
              rows={18}
              className="w-full px-3 py-2 border border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-[#e25822] focus:border-[#e25822] bg-[#222222] text-white"
              placeholder="Enter text to convert to speech..."
            />
          </div>

          {/* Generate Button */}
          <div className="flex justify-center">
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
