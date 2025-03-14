'use client';

import { useState, useEffect } from 'react';
import TextInputSection from './components/TextInputSection';
import ControlPanel from './components/ControlPanel';
import GenerateButton from './components/GenerateButton';
import StatusDisplay from './components/StatusDisplay';
import SettingsPanel from './components/SettingsPanel';
import FileUploadPanel from './components/FileUploadPanel';
import TimestampedTextDisplay from './components/TimestampedTextDisplay';
import SentenceTextDisplay from './components/SentenceTextDisplay';
import DebugPanel from './components/DebugPanel';
import useSpeechGeneration from './hooks/useSpeechGeneration';

/**
 * Main application component
 */
export default function Home() {
  // Client-side hydration check
  const [isBrowser, setIsBrowser] = useState(false);
  
  // Page layout state
  const [pageWidth, setPageWidth] = useState(95);
  
  // Text and voice state
  const [text, setText] = useState('This is a test of the Kokoro text-to-speech system.');
  const [voice, setVoice] = useState('bm_lewis');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  // Display preferences
  const [useSentenceView, setUseSentenceView] = useState(true);
  
  // Use speech generation hook for TTS functionality
  const speechGen = useSpeechGeneration();
  
  // Fix hydration issues by setting isBrowser state only after component mounts
  useEffect(() => {
    setIsBrowser(true);
  }, []);

  // Handle text changes
  const handleTextChange = (e) => {
    setText(e.target.value);
  };

  // Handle voice selection change
  const handleVoiceChange = (e) => {
    setVoice(e.target.value);
  };

  // Handle page width changes
  const handlePageWidthChange = (e) => {
    setPageWidth(parseInt(e.target.value, 10));
  };
  
  // Toggle between word and sentence view
  const toggleViewMode = () => {
    setUseSentenceView(!useSentenceView);
  };

  // Handle generate/stop button clicks
  const handleActionButtonClick = () => {
    if (speechGen.isGenerating) {
      speechGen.stopPlaying();
    } else {
      speechGen.generateSpeech(text, voice, playbackSpeed);
    }
  };

  // Handle speed change
  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    speechGen.handleSpeedChange(speed);
  };
  
  // Handle clicking on a word in the timestamps display
  const handleWordClick = (time) => {
    console.log('Word clicked with timestamp:', time);
    if (speechGen.audioElementRef?.current) {
      try {
        // Set the current time
        speechGen.audioElementRef.current.currentTime = time;
        console.log('Set audio position to:', time);
        
        // Start playback if paused
        if (speechGen.audioElementRef.current.paused) {
          console.log('Audio was paused, starting playback');
          speechGen.handlePlayPause();
        }
      } catch (error) {
        console.error('Error handling word click:', error);
      }
    } else {
      console.warn('Audio element reference not available for seeking');
    }
  };

  return (
    <main className="min-h-screen bg-[#121212] relative flex">
      {/* Settings Gear Icon */}
      {isBrowser && (
        <SettingsPanel
          voice={voice}
          onVoiceChange={handleVoiceChange}
          pageWidth={pageWidth}
          onPageWidthChange={handlePageWidthChange}
        />
      )}

      {/* Left Panel - File Upload */}
      <div className="w-24 border-r border-gray-800 bg-[#1a1a1a] overflow-y-auto flex-shrink-0">
        <FileUploadPanel onFileContent={setText} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-auto">
        {/* Audio Controls */}
        <div className="w-full sticky top-0 z-20">
          {isBrowser && (
            <ControlPanel
              isPlaying={speechGen.isPlaying}
              isStreaming={speechGen.isStreaming}
              currentTime={speechGen.currentTime}
              duration={speechGen.duration}
              streamProgress={speechGen.streamProgress}
              playbackSpeed={playbackSpeed}
              onPlayPause={speechGen.handlePlayPause}
              onSeek={speechGen.handleSeek}
              onRewind={speechGen.handleRewind}
              onForward={speechGen.handleForward}
              onSpeedChange={handleSpeedChange}
            />
          )}
        </div>

        {/* Main Content */}
        <div className="mx-auto p-6 w-full" style={{ maxWidth: `${pageWidth}%` }}>
          {/* Text Input with Highlighting */}
          <TextInputSection
            text={text}
            onTextChange={handleTextChange}
            timestamps={speechGen.timestamps}
            currentWordIndex={speechGen.currentWordIndex}
            originalText={speechGen.originalText}
            isPlaying={speechGen.isPlaying}
          />

          {/* Display Options */}
          {isBrowser && speechGen.timestamps && speechGen.timestamps.length > 0 && (
            <div className="flex justify-end mt-4 mb-2">
              <button 
                onClick={toggleViewMode}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md"
              >
                {useSentenceView ? 'Switch to Word View' : 'Switch to Sentence View'}
              </button>
            </div>
          )}

          {/* Timestamped Text Display */}
          {isBrowser && (
            <>
              {speechGen.timestamps && speechGen.timestamps.length > 0 ? (
                <>
                  {useSentenceView ? (
                    <SentenceTextDisplay
                      timestamps={speechGen.timestamps}
                      currentWordIndex={speechGen.currentWordIndex}
                      onWordClick={handleWordClick}
                    />
                  ) : (
                    <TimestampedTextDisplay
                      timestamps={speechGen.timestamps}
                      currentWordIndex={speechGen.currentWordIndex}
                      onWordClick={handleWordClick}
                      originalText={speechGen.originalText || text}
                    />
                  )}
                  
                  {/* Debug info */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="mt-2 mb-4 p-2 bg-gray-800 text-xs text-gray-400 rounded">
                      <p>Current word index: {speechGen.currentWordIndex}</p>
                      <p>Total words: {speechGen.timestamps.length}</p>
                      <p>Current time: {speechGen.currentTime.toFixed(2)}s</p>
                    </div>
                  )}
                </>
              ) : (
                speechGen.isGenerating && (
                  <div className="mt-4 mb-6 text-sm text-gray-400">
                    <p>Timestamps will be available as soon as possible during audio playback...</p>
                  </div>
                )
              )}
            </>
          )}

          {/* Action Buttons */}
          <div className="flex justify-center space-x-4">
            <GenerateButton
              onClick={handleActionButtonClick}
              isGenerating={speechGen.isGenerating}
              disabled={!text.trim()}
            />
          </div>

          {/* Status and Error Messages */}
          <StatusDisplay status={speechGen.status} error={speechGen.error} />
        </div>
      </div>
      
      {/* Debug Panel */}
      {isBrowser && <DebugPanel />}
    </main>
  );
}

