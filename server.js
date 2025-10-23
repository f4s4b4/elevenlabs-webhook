/**
 * Twilio to ElevenLabs Bridge - WebSocket Enabled
 * Fixes HTTP->WS upgrade issue
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Constants
const PORT = process.env.PORT || 3000;
const AGENT_ID = process.env.AGENT_ID || 'agent_8201k870ff6ze1psrzbddpx32zyd';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// ============================================
// HTTP ENDPOINTS
// ============================================

app.get('/', (req, res) => {
  res.json({
    status: '✅ WebSocket Bridge Running',
    timestamp: new Date().toISOString(),
    agent_id: AGENT_ID,
    endpoints: {
      '/': 'Status',
      '/voice': 'Twilio webhook (returns TwiML)',
      '/twilio-ws': 'WebSocket endpoint for Media Streams'
    }
  });
});

/**
 * Twilio Voice Webhook - Returns TwiML immediately
 * Critical: Must return quickly or Twilio drops the call
 */
app.post('/voice', (req, res) => {
  console.log('📞 Incoming call from:', req.body.From);
  
  // Get the host dynamically
  const host = process.env.RENDER_EXTERNAL_HOSTNAME || req.headers.host;
  
  // Return TwiML with WebSocket stream URL
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="tr-TR">Bağlanıyor.</Say>
    <Connect>
        <Stream url="wss://${host}/twilio-ws" />
    </Connect>
</Response>`;
  
  res.set('Content-Type', 'text/xml');
  res.send(twiml);
});

// Simple test endpoint
app.all('/test', (req, res) => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Test successful.</Say>
    <Hangup/>
</Response>`;
  res.set('Content-Type', 'text/xml');
  res.send(twiml);
});

// ============================================
// HTTP SERVER WITH WEBSOCKET SUPPORT
// ============================================

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

// Handle HTTP->WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  console.log('⬆️ WebSocket upgrade request for:', request.url);
  
  if (request.url === '/twilio-ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// ============================================
// WEBSOCKET BRIDGE LOGIC
// ============================================

wss.on('connection', async (twilioWS) => {
  console.log('🔌 Twilio WebSocket connected');
  
  let elevenWS = null;
  let streamSid = null;
  
  try {
    // Connect to ElevenLabs WebSocket
    const elevenURL = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${AGENT_ID}`;
    
    elevenWS = new WebSocket(elevenURL, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    });
    
    elevenWS.on('open', () => {
      console.log('✅ Connected to ElevenLabs');
    });
    
    elevenWS.on('error', (err) => {
      console.error('❌ ElevenLabs error:', err.message);
    });
    
    elevenWS.on('close', () => {
      console.log('🔌 ElevenLabs disconnected');
      twilioWS.close();
    });
    
    // Handle messages from Twilio
    twilioWS.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        
        switch(msg.event) {
          case 'start':
            console.log('▶️ Stream started:', msg.start);
            streamSid = msg.start.streamSid;
            // Send initial config to ElevenLabs if needed
            break;
            
          case 'media':
            // Forward audio to ElevenLabs
            if (elevenWS.readyState === WebSocket.OPEN && msg.media) {
              elevenWS.send(JSON.stringify({
                type: 'audio',
                audio: msg.media.payload
              }));
            }
            break;
            
          case 'stop':
            console.log('⏹️ Stream stopped');
            if (elevenWS) elevenWS.close();
            break;
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    });
    
    // Handle messages from ElevenLabs
    elevenWS.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        
        // Forward audio back to Twilio
        if (msg.type === 'audio' && msg.audio) {
          twilioWS.send(JSON.stringify({
            event: 'media',
            streamSid: streamSid,
            media: {
              payload: msg.audio
            }
          }));
        }
      } catch (e) {
        console.error('ElevenLabs parse error:', e);
      }
    });
    
  } catch (error) {
    console.error('❌ Bridge error:', error);
  }
  
  // Heartbeat to prevent timeout
  const heartbeat = setInterval(() => {
    if (twilioWS.readyState === WebSocket.OPEN) {
      twilioWS.ping();
    }
    if (elevenWS && elevenWS.readyState === WebSocket.OPEN) {
      elevenWS.ping();
    }
  }, 20000);
  
  // Cleanup
  twilioWS.on('close', () => {
    console.log('🔌 Twilio disconnected');
    clearInterval(heartbeat);
    if (elevenWS) elevenWS.close();
  });
});

// ============================================
// START SERVER
// ============================================

server.listen(PORT, () => {
  console.log('============================================');
  console.log('🚀 WEBSOCKET BRIDGE SERVER STARTED');
  console.log('============================================');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🤖 Agent ID: ${AGENT_ID}`);
  console.log(`🔑 API Key: ${ELEVENLABS_API_KEY ? 'Set' : 'Missing!'}`);
  console.log('============================================');
});
