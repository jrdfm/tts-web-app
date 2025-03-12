'use client';

import { useState, useRef, useEffect } from 'react';
import OpenAI from 'openai';

export default function Home() {
  const [text, setText] = useState('This is a test of the Kokoro text-to-speech system.');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [file, setFile] = useState(null);
  const [voice, setVoice] = useState('bm_lewis');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isBrowser, setIsBrowser] = useState(false);
  
  const audioRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const sourceBufferRef = useRef(null);
  const audioElementRef = useRef(null);
  const downloadUrlRef = useRef(null);
  const controllerRef = useRef(null);
  const openaiClientRef = useRef(null);

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

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6 md:p-24">
      <div className="z-10 w-full max-w-3xl bg-white dark:bg-slate-800 rounded-lg p-8 shadow-xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-6 text-center">
          Kokoro TTS Web Application
        </h1>
        
        <div className="mb-6">
          <label htmlFor="voice" className="block text-sm font-medium mb-2">
            Select Voice:
          </label>
          <select
            id="voice"
            value={voice}
            onChange={handleVoiceChange}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="bm_lewis">bm_lewis (Male)</option>
            <option value="af_bella">af_bella (Female)</option>
            <option value="en_jenny">en_jenny (Female)</option>
          </select>
        </div>
        
        <div className="mb-6">
          <label htmlFor="file" className="block text-sm font-medium mb-2">
            Upload Text File:
          </label>
          <input
            type="file"
            id="file"
            accept=".txt"
            onChange={handleFileChange}
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>
        
        <div className="mb-6">
          <label htmlFor="text" className="block text-sm font-medium mb-2">
            Text to Convert:
          </label>
          <textarea
            id="text"
            value={text}
            onChange={handleTextChange}
            rows={8}
            className="w-full p-3 border border-gray-300 rounded-md"
            placeholder="Enter text to convert to speech..."
          ></textarea>
        </div>
        
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-2 justify-center mb-4">
          <button
            onClick={generateSpeech}
            disabled={isGenerating}
            className={`py-2 px-6 rounded-md font-medium ${
              isGenerating
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isGenerating ? 'Generating...' : 'Generate & Play Speech'}
          </button>
          
          <button
            onClick={stopPlaying}
            disabled={!isPlaying && !isGenerating}
            className={`py-2 px-6 rounded-md font-medium ${
              !isPlaying && !isGenerating
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            Stop Playback
          </button>
          
          {downloadUrlRef.current && (
            <button
              onClick={downloadAudio}
              className="py-2 px-6 rounded-md font-medium bg-green-600 hover:bg-green-700 text-white"
            >
              Download Audio
            </button>
          )}
        </div>
        
        {status && (
          <div className="mt-4 p-2 bg-blue-100 text-blue-800 rounded-md">
            <p>{status}</p>
          </div>
        )}
        
        {error && (
          <div className="mt-4 p-2 bg-red-100 text-red-800 rounded-md">
            <p>{error}</p>
          </div>
        )}
      </div>
    </main>
  );
}
