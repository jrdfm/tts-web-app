'use client';

import { useState, useEffect } from 'react';
import TextInputSection from './components/TextInputSection';
import ControlPanel from './components/ControlPanel';
import GenerateButton from './components/GenerateButton';
import StatusDisplay from './components/StatusDisplay';
import SettingsPanel from './components/SettingsPanel';
import FileUploadPanel from './components/FileUploadPanel';
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

  // Handle generate/stop button clicks
  const handleActionButtonClick = () => {
    if (speechGen.isGenerating) {
      speechGen.stopPlaying();
    } else {
      speechGen.generateSpeech(text, voice);
    }
  };

  // Handle speed change
  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    speechGen.handleSpeedChange(speed);
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
          />

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
    </main>
  );
}

