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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  
  const audioRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const sourceBufferRef = useRef(null);
  const audioElementRef = useRef(null);
  const downloadUrlRef = useRef(null);
  const controllerRef = useRef(null);
  const openaiClientRef = useRef(null);
  const settingsRef = useRef(null);

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

  // Add new function to handle speed change
  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = speed;
    }
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
  const handleSeek = (seekTime) => {
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = seekTime;
    }
  };

  // Toggle settings dropdown
  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  return (
    <main className="min-h-screen bg-[#121212]">
      {/* Audio Controls */}
      {isBrowser && (
        <div className="relative">
          <AudioControls
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            onPlay={() => handlePlayPause()}
            onPause={() => handlePlayPause()}
            onRewind={handleRewind}
            onForward={handleForward}
            playbackSpeed={playbackSpeed}
            onSpeedChange={handleSpeedChange}
            onSeek={handleSeek}
            onSettingsClick={toggleSettings}
          />
          
          {/* Settings Dropdown */}
          {showSettings && (
            <div ref={settingsRef} className="absolute right-4 top-[calc(100%+4px)] z-10 w-64 bg-[#222222] border border-gray-700 rounded-md shadow-lg">
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
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-3xl mx-auto p-4">
        {/* Text Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-white mb-1">
            Text to Speech
          </label>
          <textarea
            value={text}
            onChange={handleTextChange}
            rows={6}
            className="w-full px-3 py-2 border border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-[#e25822] focus:border-[#e25822] bg-[#222222] text-white"
            placeholder="Enter text to convert to speech..."
          />
        </div>

        {/* File Upload */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-white mb-1">
            Or upload a text file
          </label>
          <input
            type="file"
            accept=".txt"
            onChange={handleFileChange}
            className="w-full text-white"
          />
        </div>

        {/* Generate Button */}
        <div className="flex justify-center">
          <button
            onClick={isGenerating ? stopPlaying : generateSpeech}
            disabled={!text.trim()}
            className={`px-4 py-2 rounded-md font-medium ${
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
    </main>
  );
}
