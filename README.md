# Text-to-Speech Web Application

A modern, responsive web application for converting text to lifelike speech using the Kokoro text-to-speech system.

![TTS Web App](./app-screenshot.png)

## Features

- **Text-to-Speech Conversion**: Generate high-quality speech from text input
- **Real-time Streaming**: Audio begins playing while still being generated
- **Interactive Audio Controls**: Pause, play, seek, rewind, and fast-forward
- **Voice Selection**: Choose from multiple voice options (Lewis, Emma, Brian)
- **Playback Speed Control**: Adjust speed from 0.5x to 2x
- **File Upload**: Import text from files
- **Responsive Design**: Adjustable page width for comfortable reading
- **Progress Tracking**: Visual feedback on streaming and playback progress

## Tech Stack

- **Frontend**: Next.js, React.js, Tailwind CSS
- **Audio Processing**: Web Audio API, HTML5 Audio
- **API Integration**: OpenAI-compatible API client
- **State Management**: React Hooks and Context

## Getting Started

### Prerequisites

- Node.js (v14 or newer)
- Kokoro TTS API server running locally

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/tts-web-app.git
   cd tts-web-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### API Server Setup

This application requires a Kokoro TTS API server running locally. The application is configured to connect to `http://localhost:8880/v1` by default.

If you need to modify the API endpoint, update the `baseURL` in `src/app/hooks/useSpeechGeneration.js`.

## Usage Guide

### Basic Usage

1. Type or paste text into the input area
2. Select a voice from the settings panel (gear icon)
3. Click "Generate" to convert text to speech
4. Use the control panel to manage playback

### Audio Controls

- **Play/Pause**: Start or pause audio playback
- **Forward**: Skip ahead 10 seconds
- **Rewind**: Go back 10 seconds
- **Seek**: Click anywhere on the progress bar to jump to that position
- **Speed**: Adjust playback speed using the dropdown menu

### Customization

- **Page Width**: Adjust the reading area width using the settings panel
- **Voice Selection**: Change the TTS voice using the settings panel

## Project Structure

```
tts-web-app/
├── public/           # Static assets
├── src/
│   ├── app/          # Next.js app directory
│   │   ├── components/  # React components
│   │   │   ├── ControlPanel.js      # Audio playback controls
│   │   │   ├── FileUploadPanel.js   # File import functionality
│   │   │   ├── GenerateButton.js    # TTS generation button
│   │   │   ├── SettingsPanel.js     # Application settings
│   │   │   ├── StatusDisplay.js     # Status and error messages
│   │   │   └── TextInputSection.js  # Text editor component
│   │   ├── hooks/      # Custom React hooks
│   │   │   └── useSpeechGeneration.js  # TTS generation hook
│   │   │   └── useClickOutside.js      # Click detection hook
│   │   ├── utils/      # Utility functions
│   │   │   └── format.js              # Time formatting utils
│   │   ├── page.js     # Main application page
│   │   └── layout.js   # App layout component
├── package.json     # Dependencies and scripts
└── README.md        # Project documentation
```

## Technical Implementation Details

### Audio Streaming Architecture

The application implements a sophisticated audio streaming system that allows real-time playback while content is still being generated:

#### Chunk-Based Processing

1. **Chunk Collection**: Audio data is received in chunks from the API using async iterators
   ```javascript
   for await (const chunk of response.body) {
     chunksRef.current.push(chunk);
     // Process chunk and update UI
   }
   ```

2. **Dynamic Blob Creation**: The application periodically rebuilds an audio blob from accumulated chunks
   ```javascript
   const audioBlob = new Blob(chunksRef.current, { type: 'audio/mpeg' });
   audioBlobUrlRef.current = URL.createObjectURL(audioBlob);
   ```

3. **Seamless Source Updates**: The audio element's source is updated while maintaining playback position
   ```javascript
   const currentPosition = audioElementRef.current.currentTime;
   audioElementRef.current.src = audioBlobUrlRef.current;
   // After loading metadata
   audioElementRef.current.currentTime = currentPosition;
   ```

4. **Resource Management**: Object URLs are properly tracked and revoked to prevent memory leaks
   ```javascript
   if (audioBlobUrlRef.current) {
     URL.revokeObjectURL(audioBlobUrlRef.current);
   }
   ```

#### Streaming Progress Tracking

Instead of relying on the MediaSource API's inconsistent buffered property, the application uses a manual approach:

1. **Chunk Counting**: Received chunks are counted and used to calculate streaming progress
   ```javascript
   setStreamProgress(receivedChunks * 5); // Simple scale for visual feedback
   ```

2. **UI Feedback**: The progress bar visually represents both playback position and buffered content
   ```javascript
   // Buffered progress indicator
   <div className="bg-gray-600" style={{ width: `${getBufferedWidth()}%` }} />
   // Playback progress indicator
   <div className="bg-[#e25822]" style={{ width: `${getProgressWidth()}%` }} />
   ```

3. **Adaptive Playback**: Playback begins after receiving sufficient initial data
   ```javascript
   if (!playbackStarted && receivedChunks >= 2) {
     playbackStarted = true;
     audioElementRef.current.play()
       .then(() => setIsPlaying(true));
   }
   ```

### Component Architecture

The application follows a well-structured component architecture with clear separation of concerns:

#### Core Components

1. **TextInputSection**: Handles text input with proper text selection and resizing capabilities
   ```javascript
   <textarea
     value={text}
     onChange={onTextChange}
     className="w-full px-3 py-2 border border-gray-700 rounded-md..."
   />
   ```

2. **ControlPanel**: Provides sophisticated audio controls with streaming awareness
   ```javascript
   // Progress tracking during streaming
   const getBufferedWidth = () => {
     if (isStreaming) {
       return Math.min(100, Math.max(0, streamProgress));
     }
     return 100;
   };
   ```

3. **SettingsPanel**: Manages application settings with a dropdown interface
   ```javascript
   // Uses useClickOutside hook to detect clicks outside the panel
   useClickOutside(
     panelRef, 
     isOpen, 
     () => setIsOpen(false)
   );
   ```

#### Custom Hooks

1. **useSpeechGeneration**: Encapsulates the entire audio generation and playback system
   ```javascript
   // Exposes a clean interface for components
   return {
     isGenerating, isPlaying, isStreaming, status, error, 
     currentTime, duration, streamProgress,
     generateSpeech, stopPlaying, handlePlayPause, handleSeek, 
     handleSpeedChange, handleRewind, handleForward
   };
   ```

2. **useClickOutside**: Reusable hook for detecting clicks outside elements
   ```javascript
   useEffect(() => {
     const handleClickOutside = (e) => {
       if (ref.current && !ref.current.contains(e.target) && isActive) {
         callback();
       }
     };
     
     document.addEventListener('mousedown', handleClickOutside);
     return () => document.removeEventListener('mousedown', handleClickOutside);
   }, [ref, callback, isActive]);
   ```

### Error Handling & Resilience

The application implements robust error handling throughout:

1. **API Error Handling**: Graceful handling of connection and streaming errors
   ```javascript
   try {
     // API call
   } catch (err) {
     console.error('Error generating speech:', err);
     setError(`Error: ${err.message}`);
     cleanup();
   }
   ```

2. **Audio Playback Error Management**: Detection and reporting of audio element errors
   ```javascript
   audioElementRef.current.addEventListener('error', (e) => {
     console.error('Audio error:', e);
     setError(`Audio error: ${e.message || 'Unknown error'}`);
   });
   ```

3. **Seeking Safeguards**: Prevention of invalid seek operations
   ```javascript
   // Validate seek position before setting
   if (width > 0 && isFinite(audioElementRef.current.duration)) {
     const percentage = Math.min(1, Math.max(0, x / width));
     const seekTime = percentage * audioElementRef.current.duration;
     
     if (isFinite(seekTime) && seekTime >= 0) {
       audioElementRef.current.currentTime = seekTime;
     }
   }
   ```

4. **Resource Cleanup**: Thorough cleanup of resources to prevent memory leaks
   ```javascript
   // Clean up on unmount
   useEffect(() => {
     return () => {
       cleanup();
     };
   }, []);
   ```

### OpenAI-Compatible API Integration

The application connects to the Kokoro TTS service using an OpenAI-compatible client:

1. **Client Initialization**: Configures the OpenAI client with the correct endpoint
   ```javascript
   openaiClientRef.current = new OpenAI({
     baseURL: 'http://localhost:8880/v1',
     apiKey: 'not-needed',
     dangerouslyAllowBrowser: true
   });
   ```

2. **Streaming Request**: Makes a streaming API request for speech generation
   ```javascript
   const response = await openaiClientRef.current.audio.speech.create({
     model: "kokoro",
     voice: voice,
     input: text,
     response_format: "mp3",
     stream: true
   });
   ```

3. **Abort Controller Integration**: Enables request cancellation for user-triggered stops
   ```javascript
   controllerRef.current = new AbortController();
   // Later, if needed:
   if (controllerRef.current) {
     controllerRef.current.abort();
   }
   ```

## License

[MIT](LICENSE)

## Acknowledgements

- This project uses the Kokoro text-to-speech system
- Icons from [Heroicons](https://heroicons.com/)
- Styling with [Tailwind CSS](https://tailwindcss.com/)
