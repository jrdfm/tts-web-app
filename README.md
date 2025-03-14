# TTS Web App with Real-time Word Highlighting

A Next.js web application that provides Text-to-Speech functionality with real-time word highlighting and streaming audio playback.

## Technical Implementation

### Audio Streaming and Word Timing

The application uses a streaming approach to handle audio generation and playback:

1. **Audio Generation and Streaming**
   - Makes a POST request to `/dev/captioned_speech` endpoint
   - Uses streaming response with JSON lines format
   - Each chunk contains:
     - `audio`: Base64 encoded MP3 audio data
     - `timestamps`: Array of word-level timing information

2. **Audio Processing (`useSpeechGeneration.js`)**
   - Maintains audio chunks in `chunksRef` using `ArrayBuffer`
   - Creates a single Blob from accumulated chunks
   - Uses `URL.createObjectURL()` for audio source
   - Handles playback state preservation during updates
   - Manages audio element lifecycle and event listeners

3. **Word Timing Implementation**
   - Timestamps format:
   ```typescript
   interface WordTimestamp {
     word: string;
     start_time: number;  // seconds
     end_time: number;    // seconds
   }
   ```
   - Updates current word index based on audio playback position
   - Uses 60ms interval for smooth word highlighting
   - Maintains synchronization during seeking and playback speed changes

### UI Components

1. **TimestampedTextDisplay**
   - Groups words into sentences for better readability
   - Provides word-level click navigation
   - Implements auto-scrolling to keep current word visible
   - Handles error states and loading conditions

2. **Audio Controls**
   - Play/Pause toggle
   - Seek functionality with progress bar
   - Playback speed control
   - 10-second forward/backward navigation

### Key Features

1. **Streaming Audio Playback**
   - Starts playback with first chunk
   - Continuously updates audio source with new chunks
   - Preserves playback position during updates
   - Handles browser autoplay restrictions

2. **Word Synchronization**
   - Real-time word highlighting during playback
   - Click-to-seek functionality at word level
   - Maintains sync during speed changes and seeking
   - Handles edge cases like sentence boundaries

3. **Error Handling**
   - Validates timestamp data
   - Manages audio element errors
   - Handles stream parsing errors
   - Provides user feedback for error states

## Technical Requirements

- Node.js 18+
- Next.js 14
- Modern browser with Web Audio API support
- Backend server supporting streaming responses

## API Endpoint Specification

The `/dev/captioned_speech` endpoint expects:

```json
{
  "model": "kokoro",
  "input": "text to synthesize",
  "voice": "voice_id",
  "speed": 1.0,
  "response_format": "mp3",
  "stream": true
}
```

Response format (JSON lines):
```json
{
  "audio": "base64_encoded_audio_chunk",
  "timestamps": [
    {
      "word": "example",
      "start_time": 0.0,
      "end_time": 0.5
    }
  ]
}
```

## Performance Considerations

1. **Memory Management**
   - Releases audio Blob URLs when no longer needed
   - Cleans up event listeners and intervals
   - Manages audio element lifecycle

2. **UI Performance**
   - Uses React.memo and useCallback for optimization
   - Implements throttling for scroll operations
   - Efficient word highlighting updates

3. **Stream Processing**
   - Handles incomplete JSON chunks
   - Efficient base64 to ArrayBuffer conversion
   - Optimized timestamp array operations

## Browser Compatibility

- Requires browsers with support for:
  - Fetch API with streaming
  - Audio element with MP3 support
  - URL.createObjectURL
  - Web Audio API
  - Modern JavaScript features
