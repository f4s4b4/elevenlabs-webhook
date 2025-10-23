/**
 * Fixed Twilio to ElevenLabs Bridge
 * With signed URL and proper message format
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Constants
const PORT = process.env.PORT || 3000;
const AGENT_ID = process.env.AGENT_ID || 'agent_8201k870ff6ze1psrzbddpx32zyd';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Get signed URL from ElevenLabs
async function getSignedUrl() {
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${AGENT_ID}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get signed URL: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Got signed URL from ElevenLabs');
    return data.signed_url;
  } catch (error) {
    console.error('❌ Error getting signed URL:', error);
    throw error;
  }
}

// ============================================
// HTTP ENDPOINTS
// ============================================

app.get('/', (req, res) => {
  res.json({
    status: '✅ WebSocket Bridge Running',
    timestamp: new Date().toISOString(),
    agent_id: AGENT_ID,
    api_key: ELEVENLABS_API_KEY ? 'Configured' : 'Missing!'
  });
});

// Twilio webhook - returns TwiML
app.all('/voice', (req, res) => {
  console.log('📞 Incoming call from:', req.body.From);
  
  const host = req.headers.host;
  
  // Return TwiML pointing to our WebSocket endpoint
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="wss://${host}/media-stream" />
    </Connect>
</Response>`;
  
  res.set('Content-Type', 'text/xml');
  res.send(twiml);
});

// Test endpoint
app.all('/test', (req, res) => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="tr-TR">Test başarılı. Sistem çalışıyor.</Say>
    <Hangup/>
</Response>`;
  res.set('Content-Type', 'text/xml');
  res.send(twiml);
});

// ============================================
// HTTP SERVER WITH WEBSOCKET
// ============================================

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

// Handle HTTP->WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  console.log('⬆️ WebSocket upgrade request for:', request.url);
  
  if (request.url === '/media-stream') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// ============================================
// WEBSOCKET BRIDGE
// ============================================

wss.on('connection', (twilioWS) => {
  console.log('🔌 Twilio WebSocket connected');
  
  let streamSid = null;
  let elevenLabsWs = null;
  
  // Set up ElevenLabs connection
  const setupElevenLabs = async () => {
    try {
      // Get signed URL
      const signedUrl = await getSignedUrl();
      
      // Connect to ElevenLabs
      elevenLabsWs = new WebSocket(signedUrl);
      
      elevenLabsWs.on('open', () => {
        console.log('✅ Connected to ElevenLabs');
        
        // Send initial configuration
        const initialConfig = {
          type: "conversation_initiation_client_data",
          conversation_config_override: {
            agent: {
              prompt: { 
                prompt: "Sen bir satış temsilcisisin. Nazik ve yardımsever ol. Türkçe konuş." 
              },
              first_message: "Merhaba! Size nasıl yardımcı olabilirim?",
            },
          }
        };
        
        elevenLabsWs.send(JSON.stringify(initialConfig));
        console.log('📤 Sent initial config to ElevenLabs');
      });
      
      // Handle messages from ElevenLabs
      elevenLabsWs.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          
          switch (message.type) {
            case 'conversation_initiation_metadata':
              console.log('📥 ElevenLabs ready');
              break;
              
            case 'audio':
              // Send audio back to Twilio
              if (streamSid && message.audio?.chunk) {
                const audioData = {
                  event: 'media',
                  streamSid: streamSid,
                  media: {
                    payload: message.audio.chunk
                  }
                };
                twilioWS.send(JSON.stringify(audioData));
              }
              break;
              
            case 'interruption':
              // Clear Twilio's audio queue
              if (streamSid) {
                twilioWS.send(JSON.stringify({
                  event: 'clear',
                  streamSid: streamSid
                }));
              }
              break;
              
            case 'ping':
              // Respond with pong
              if (message.ping_event?.event_id) {
                elevenLabsWs.send(JSON.stringify({
                  type: 'pong',
                  event_id: message.ping_event.event_id
                }));
              }
              break;
          }
        } catch (error) {
          console.error('❌ ElevenLabs message error:', error);
        }
      });
      
      elevenLabsWs.on('error', (error) => {
        console.error('❌ ElevenLabs error:', error);
      });
      
      elevenLabsWs.on('close', () => {
        console.log('🔌 ElevenLabs disconnected');
      });
      
    } catch (error) {
      console.error('❌ Setup error:', error);
    }
  };
  
  // Start ElevenLabs connection
  setupElevenLabs();
  
  // Handle messages from Twilio
  twilioWS.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      
      switch (msg.event) {
        case 'start':
          streamSid = msg.start.streamSid;
          console.log('▶️ Stream started:', streamSid);
          break;
          
        case 'media':
          // Forward audio to ElevenLabs
          if (elevenLabsWs?.readyState === WebSocket.OPEN && msg.media?.payload) {
            const audioMessage = {
              user_audio_chunk: msg.media.payload
            };
            elevenLabsWs.send(JSON.stringify(audioMessage));
          }
          break;
          
        case 'stop':
          console.log('⏹️ Stream stopped');
          if (elevenLabsWs) {
            elevenLabsWs.close();
          }
          break;
      }
    } catch (error) {
      console.error('❌ Twilio message error:', error);
    }
  });
  
  // Cleanup on disconnect
  twilioWS.on('close', () => {
    console.log('🔌 Twilio disconnected');
    if (elevenLabsWs) {
      elevenLabsWs.close();
    }
  });
});

// ============================================
// START SERVER
// ============================================

server.listen(PORT, () => {
  console.log('============================================');
  console.log('🚀 FIXED WEBSOCKET BRIDGE STARTED');
  console.log('============================================');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🤖 Agent ID: ${AGENT_ID}`);
  console.log(`🔑 API Key: ${ELEVENLABS_API_KEY ? 'Set' : 'Missing!'}`);
  console.log('============================================');
});
