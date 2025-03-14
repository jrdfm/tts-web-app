# TTS Web App with Real-time Word Highlighting

A Next.js web application that provides Text-to-Speech functionality with real-time word highlighting and streaming audio playback.

## Technical Implementation

### Audio Streaming and Word Timing

The application implements a sophisticated streaming approach for audio generation and playback:

1. **Audio Generation and Streaming**
   - Makes a POST request to `/dev/captioned_speech` endpoint using the Fetch API with streaming enabled:
   ```javascript
   const response = await fetch("http://localhost:8880/dev/captioned_speech", {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       model: "kokoro",
       input: text,
       voice: voice,
       speed: speed,
       response_format: "mp3",
       stream: true
     }),
     signal: controllerRef.current.signal // For cancellation support
   });
   ```
   
   - Processes streaming response using JSON lines format:
   ```javascript
   const reader = response.body.getReader();
   const decoder = new TextDecoder();
   let incompleteChunk = '';
   
   while (true) {
     const { done, value } = await reader.read();
     if (done) break;
     
     const textChunk = decoder.decode(value, { stream: true });
     const lines = (incompleteChunk + textChunk).split('\n');
     incompleteChunk = lines.pop() || '';
     
     for (const line of lines) {
       if (!line.trim()) continue;
       const chunkJson = JSON.parse(line);
       // Process audio and timestamps...
     }
   }
   ```

2. **Audio Processing (`useSpeechGeneration.js`)**
   - Maintains audio chunks using ArrayBuffer for efficient memory management:
   ```javascript
   const chunksRef = useRef([]);
   const totalChunksRef = useRef(0);
   
   // Convert base64 to ArrayBuffer
   const audioBytes = base64ToArrayBuffer(chunkJson.audio);
   chunksRef.current.push(audioBytes);
   ```
   
   - Creates and updates Blob for audio playback:
   ```javascript
   const updateAudioFromChunks = async (forcePlay = false) => {
     const audioBlob = new Blob(chunksRef.current, { type: 'audio/mpeg' });
     const wasPlaying = !audioElementRef.current.paused;
     const currentPosition = audioElementRef.current.currentTime;
     
     // Clean up old URL
     if (audioBlobUrlRef.current) {
       URL.revokeObjectURL(audioBlobUrlRef.current);
     }
     
     audioBlobUrlRef.current = URL.createObjectURL(audioBlob);
     audioElementRef.current.src = audioBlobUrlRef.current;
     
     // Restore playback state
     await new Promise(resolve => {
       audioElementRef.current.addEventListener('canplaythrough', resolve, { once: true });
     });
     
     if (currentPosition > 0) {
       audioElementRef.current.currentTime = currentPosition;
     }
     
     if (wasPlaying || forcePlay) {
       await audioElementRef.current.play();
     }
   };
   ```

3. **Word Timing Implementation**
   - Sophisticated timestamp handling with TypeScript interface:
   ```typescript
   interface WordTimestamp {
     word: string;
     start_time: number;  // seconds
     end_time: number;    // seconds
   }
   ```
   
   - Real-time word tracking implementation:
   ```javascript
   useEffect(() => {
     if (isPlaying && timestamps.length > 0) {
       timestampIntervalRef.current = setInterval(() => {
         if (!audioElementRef.current) return;
         
         const currentTime = audioElementRef.current.currentTime;
         let foundIndex = -1;
         
         for (let i = 0; i < timestamps.length; i++) {
           const { start_time, end_time } = timestamps[i];
           if (currentTime >= start_time && currentTime <= end_time) {
             foundIndex = i;
             break;
           }
         }
         
         if (foundIndex !== -1 && foundIndex !== currentWordIndex) {
           setCurrentWordIndex(foundIndex);
         }
       }, 60); // 60ms interval for smooth updates
     }
     
     return () => {
       if (timestampIntervalRef.current) {
         clearInterval(timestampIntervalRef.current);
       }
     };
   }, [isPlaying, timestamps, currentWordIndex]);
   ```

### UI Components

1. **TimestampedTextDisplay**
   - Advanced sentence grouping algorithm:
   ```javascript
   const processedSentences = useMemo(() => {
     if (!timestamps || timestamps.length === 0) return [];
     
     const sentenceGroups = [];
     let currentSentence = {
       words: [],
       wordIndices: [],
       startTime: null,
       endTime: null
     };
     
     timestamps.forEach((word, index) => {
       if (currentSentence.words.length === 0) {
         currentSentence.startTime = word.start_time;
       }
       
       currentSentence.words.push(word);
       currentSentence.wordIndices.push(index);
       currentSentence.endTime = word.end_time;
       
       const endsWithPunctuation = /[.!?]$/.test(word.word);
       const isLastWord = index === timestamps.length - 1;
       
       if (endsWithPunctuation || isLastWord) {
         sentenceGroups.push(currentSentence);
         currentSentence = {
           words: [],
           wordIndices: [],
           startTime: null,
           endTime: null
         };
       }
     });
     
     return sentenceGroups;
   }, [timestamps]);
   ```
   
   - Intelligent auto-scrolling implementation:
   ```javascript
   useEffect(() => {
     if (currentWordIndex < 0 || !wordRefs.current[currentWordIndex]) return;
     
     const now = Date.now();
     if (now - lastScrollTimeRef.current < 100) return;
     lastScrollTimeRef.current = now;
     
     const container = containerRef.current;
     const element = wordRefs.current[currentWordIndex];
     const containerRect = container.getBoundingClientRect();
     const elementRect = element.getBoundingClientRect();
     
     if (elementRect.top < containerRect.top || 
         elementRect.bottom > containerRect.bottom) {
       const scrollTop = 
         element.offsetTop - 
         container.offsetHeight / 2 + 
         element.offsetHeight / 2;
       
       container.scrollTo({
         top: scrollTop,
         behavior: 'smooth'
       });
     }
   }, [currentWordIndex]);
   ```

2. **Audio Controls**
   - Precise seeking implementation:
   ```javascript
   const handleSeek = (e) => {
     if (!audioElementRef.current?.duration) return;
     
     const progressBar = e.currentTarget;
     const bounds = progressBar.getBoundingClientRect();
     const x = Math.max(0, e.clientX - bounds.left);
     const width = bounds.width;
     
     if (width > 0) {
       const percentage = Math.min(1, Math.max(0, x / width));
       const seekTime = percentage * audioElementRef.current.duration;
       
       audioElementRef.current.currentTime = seekTime;
       
       // Update current word
       for (let i = 0; i < timestamps.length; i++) {
         if (seekTime >= timestamps[i].start_time && 
             seekTime <= timestamps[i].end_time) {
           setCurrentWordIndex(i);
           break;
         }
       }
     }
   };
   ```
   
   - Speed control with synchronization:
   ```javascript
   const handleSpeedChange = (speed) => {
     if (audioElementRef.current) {
       audioElementRef.current.playbackRate = speed;
     }
   };
   ```

### Advanced Features

1. **Streaming Audio Management**
   - Sophisticated chunk processing:
   ```javascript
   const processAudioChunk = async (chunk, isFirstChunk) => {
     chunksRef.current.push(chunk);
     
     if (isFirstChunk) {
       await updateAudioFromChunks(true);
       playbackStartedRef.current = true;
     } else if (audioElementRef.current?.ended) {
       await updateAudioFromChunks(true);
     } else {
       await updateAudioFromChunks(false);
     }
   };
   ```
   
   - Autoplay handling with browser restrictions:
   ```javascript
   const handleAutoplay = async () => {
     try {
       await audioElementRef.current.play();
     } catch (err) {
       if (err.name === 'NotAllowedError') {
         setStatus('Click play to start (browser restriction)');
       }
     }
   };
   ```

2. **Resource Management**
   - Comprehensive cleanup implementation:
   ```javascript
   const cleanup = () => {
     if (audioElementRef.current) {
       audioElementRef.current.pause();
       audioElementRef.current.src = '';
     }
     
     if (audioBlobUrlRef.current) {
       URL.revokeObjectURL(audioBlobUrlRef.current);
       audioBlobUrlRef.current = null;
     }
     
     if (timestampIntervalRef.current) {
       clearInterval(timestampIntervalRef.current);
       timestampIntervalRef.current = null;
     }
     
     if (controllerRef.current) {
       controllerRef.current.abort();
       controllerRef.current = null;
     }
     
     chunksRef.current = [];
     totalChunksRef.current = 0;
     playbackStartedRef.current = false;
     
     setIsStreaming(false);
     setStreamProgress(0);
     setTimestamps([]);
     setCurrentWordIndex(-1);
   };
   ```

3. **Error Handling**
   - Comprehensive error management:
   ```javascript
   const handleError = (error) => {
     console.error('Error:', error);
     
     if (error.name === 'AbortError') {
       setError('Generation cancelled');
     } else if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
       setError('Connection failed - check if server is running');
     } else {
       setError(`Error: ${error.message || 'Unknown error'}`);
     }
     
     cleanup();
     setIsGenerating(false);
     setIsPlaying(false);
   };
   ```
   
   - Timestamp validation:
   ```javascript
   const validateTimestamps = (timestamps) => {
     if (!Array.isArray(timestamps)) {
       throw new Error('Invalid timestamps format');
     }
     
     const hasInvalidItem = timestamps.some(
       item => typeof item.word !== 'string' || 
               typeof item.start_time !== 'number' || 
               typeof item.end_time !== 'number'
     );
     
     if (hasInvalidItem) {
       throw new Error('Invalid timestamp data structure');
     }
   };
   ```

## Technical Requirements

- Node.js 18+ (required for stable streams API)
- Next.js 14 (for modern React features and optimizations)
- Modern browser with support for:
  - Fetch API with streaming
  - Audio element with MP3 support
  - URL.createObjectURL
  - Web Audio API
  - Modern JavaScript features (async/await, etc.)
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

## Performance Optimizations

1. **Memory Management**
   - Efficient ArrayBuffer usage for audio chunks
   - Proper cleanup of Blob URLs
   - Event listener cleanup
   - Interval management
   - Audio element lifecycle handling

2. **UI Performance**
   - React.memo for expensive components:
   ```javascript
   const TimestampedWord = React.memo(({ word, isCurrentWord, onClick }) => (
     <span
       className={`${isCurrentWord ? 'highlighted' : ''} word`}
       onClick={onClick}
     >
       {word}
     </span>
   ));
   ```
   
   - useCallback for event handlers:
   ```javascript
   const handleWordClick = useCallback((index) => {
     if (onWordClick && timestamps[index]) {
       onWordClick(timestamps[index].start_time);
     }
   }, [onWordClick, timestamps]);
   ```
   
   - Throttled scroll operations:
   ```javascript
   const throttledScroll = useCallback(
     throttle((element) => {
       element.scrollIntoView({
         behavior: 'smooth',
         block: 'center'
       });
     }, 100),
     []
   );
   ```

3. **Stream Processing**
   - Efficient chunk handling:
   ```javascript
   const processChunk = (chunk) => {
     // Convert base64 to ArrayBuffer efficiently
     const binaryString = atob(chunk);
     const bytes = new Uint8Array(binaryString.length);
     for (let i = 0; i < binaryString.length; i++) {
       bytes[i] = binaryString.charCodeAt(i);
     }
     return bytes.buffer;
   };
   ```
   
   - Optimized timestamp operations:
   ```javascript
   const findWordAtTime = (time) => {
     // Binary search for better performance
     let left = 0;
     let right = timestamps.length - 1;
     
     while (left <= right) {
       const mid = Math.floor((left + right) / 2);
       const { start_time, end_time } = timestamps[mid];
       
       if (time >= start_time && time <= end_time) {
         return mid;
       }
       
       if (time < start_time) {
         right = mid - 1;
       } else {
         left = mid + 1;
       }
     }
     
     return -1;
   };
   ```

## Browser Compatibility

Detailed browser requirements:

1. **Fetch API**
   - Support for ReadableStream
   - TextDecoder support
   - AbortController support

2. **Audio Element**
   - MP3 codec support
   - Dynamic source updating
   - Precise seeking
   - Playback rate control

3. **Modern JavaScript**
   - async/await
   - Promises
   - Array methods
   - Object spread
   - Optional chaining
   - Nullish coalescing

4. **DOM APIs**
   - IntersectionObserver
   - ResizeObserver
   - smooth scrolling
   - getBoundingClientRect

5. **Web APIs**
   - URL.createObjectURL/revokeObjectURL
   - Blob construction
   - ArrayBuffer manipulation
   - Base64 encoding/decoding
