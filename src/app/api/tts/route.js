import { NextResponse } from 'next/server';

// This function handles the TTS streaming from the Kokoro API
export async function POST(request) {
  try {
    const data = await request.json();
    const { text, voice = 'bm_lewis' } = data;

    // We'll stream the response back to the client
    const customReadable = new ReadableStream({
      async start(controller) {
        try {
          // Make a request to the Kokoro API
          const response = await fetch('http://localhost:8880/v1/audio/speech', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'kokoro',
              input: text,
              voice: voice,
              response_format: 'mp3',
              stream: true
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Kokoro API error: ${response.status} ${errorText}`);
          }

          // The response should be a ReadableStream of the audio data
          if (!response.body) {
            throw new Error('No response body received from Kokoro API');
          }

          // Forward the audio data as it comes in
          const reader = response.body.getReader();
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // Forward each chunk to the client
            controller.enqueue(value);
          }
          
          controller.close();
        } catch (error) {
          console.error('Error in TTS streaming:', error);
          controller.error(error);
        }
      }
    });

    // Return the stream as the response
    return new NextResponse(customReadable, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked'
      }
    });
  } catch (error) {
    console.error('Error processing TTS request:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 