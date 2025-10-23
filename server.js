/**
 * Fixed Twilio to ElevenLabs Bridge
 * With signed URL and proper message format
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fetch = require('node-fetch');
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
  
  let streamS
