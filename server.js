/**
 * Twilio to ElevenLabs AI Agent Integration
 * Main Server File
 */

require('dotenv').config();
const express = require('express');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Constants from environment variables
const PORT = process.env.PORT || 3000;
const AGENT_ID = process.env.AGENT_ID || 'agent_8201k870ff6ze1psrzbddpx32zyd';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Call logs storage
const callLogs = [];

// ============================================
// ROUTES
// ============================================

/**
 * Home route - System status
 */
app.get('/', (req, res) => {
  res.json({
    status: '✅ Webhook Server Running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    endpoints: {
      '/': 'System status',
      '/voice': 'Main voice endpoint for ElevenLabs',
      '/voice-alt': 'Alternative voice endpoint',
      '/test': 'Test endpoint',
      '/logs': 'Call logs'
    },
    agent_id: AGENT_ID
  });
});

/**
 * Test endpoint - Simple TwiML response
 */
app.all('/test', (req, res) => {
  console.log('📞 Test endpoint called');
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="tr-TR">Test başarılı. Webhook çalışıyor.</Say>
    <Pause length="1"/>
    <Say language="en-US">Test successful. Webhook is working.</Say>
    <Hangup/>
</Response>`;
  
  res.set('Content-Type', 'text/xml');
  res.send(twiml);
});

/**
 * Main voice endpoint - Connect to ElevenLabs
 */
app.all('/voice', (req, res) => {
    console.log('\n📞 VOICE ENDPOINT CALLED');
    console.log('From:', req.body.From || 'Unknown');
    console.log('To:', req.body.To || 'Unknown');
    console.log('CallSid:', req.body.CallSid || 'Unknown');
    
    // SADECE PARAMETER TAG'LERİ KULLANALIM
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
  <Response>
      <Say language="tr-TR">Merhaba, sizi asistana bağlıyorum.</Say>
      <Connect>
          <Stream url="wss://api.elevenlabs.io/v1/convai/conversation">
              <Parameter name="agent_id" value="${AGENT_ID}" />
              <Parameter name="xi_api_key" value="${ELEVENLABS_API_KEY}" />
          </Stream>
      </Connect>
  </Response>`;
    
    res.set('Content-Type', 'text/xml; charset=utf-8');
    res.send(twiml);
  });
  
  // TwiML response with ElevenLabs WebSocket
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="tr-TR">Merhaba, sizi satış temsilcimize bağlıyorum.</Say>
    <Connect>
        <Stream url="wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${AGENT_ID}&amp;xi_api_key=${ELEVENLABS_API_KEY}" />
    </Connect>
</Response>`;
  
  res.set('Content-Type', 'text/xml; charset=utf-8');
  res.send(twiml);
});

/**
 * Alternative voice endpoint - Using Parameter tags
 */
app.all('/voice-alt', (req, res) => {
  console.log('\n📞 ALTERNATIVE VOICE ENDPOINT CALLED');
  
  // Log the call
  callLogs.push({
    timestamp: new Date().toISOString(),
    from: req.body.From,
    to: req.body.To,
    callSid: req.body.CallSid,
    endpoint: '/voice-alt'
  });
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="en-US">Connecting to AI assistant.</Say>
    <Connect>
        <Stream url="wss://api.elevenlabs.io/v1/convai/conversation">
            <Parameter name="agent_id" value="${AGENT_ID}" />
            <Parameter name="xi_api_key" value="${ELEVENLABS_API_KEY}" />
        </Stream>
    </Connect>
</Response>`;
  
  res.set('Content-Type', 'text/xml; charset=utf-8');
  res.send(twiml);
});

/**
 * Call logs endpoint
 */
app.get('/logs', (req, res) => {
  res.json({
    total_calls: callLogs.length,
    last_10_calls: callLogs.slice(-10)
  });
});

/**
 * ElevenLabs webhook endpoint (if needed)
 */
app.post('/webhook', (req, res) => {
  console.log('\n📥 ELEVENLABS WEBHOOK REQUEST');
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  // Return ElevenLabs expected format
  res.json({
    conversation_initiation_client_data: {
      agent_id: AGENT_ID,
      customer: {
        name: req.body.customer_name || 'Customer',
        phone: req.body.phone || '+1234567890',
        email: req.body.email || 'customer@example.com'
      },
      context: {
        source: 'twilio_integration',
        timestamp: new Date().toISOString()
      }
    }
  });
});

// ============================================
// SERVER START
// ============================================

app.listen(PORT, () => {
  console.log('============================================');
  console.log('🚀 ELEVENLABS WEBHOOK SERVER STARTED');
  console.log('============================================');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🤖 Agent ID: ${AGENT_ID}`);
  console.log(`🔑 API Key: ${ELEVENLABS_API_KEY ? 'Configured' : 'Missing!'}`);
  console.log('');
  console.log('📋 Available endpoints:');
  console.log(`   /test - Test endpoint`);
  console.log(`   /voice - Main voice endpoint`);
  console.log(`   /voice-alt - Alternative voice endpoint`);
  console.log(`   /logs - Call logs`);
  console.log('============================================');
});

module.exports = app;