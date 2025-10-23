/**
 * Test Script for Twilio Integration
 * Run this after deploying to test your endpoints
 */

require('dotenv').config();
const twilio = require('twilio');

// Twilio credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

// Your deployed URL (update after deploying to Render)
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000';

// Initialize Twilio client
const client = twilio(accountSid, authToken);

/**
 * Test the webhook endpoint
 */
async function testWebhook() {
  try {
    console.log('🧪 Testing webhook endpoint...');
    
    const response = await fetch(`${WEBHOOK_URL}/`);
    const data = await response.json();
    
    console.log('✅ Webhook is running:', data);
    return true;
  } catch (error) {
    console.error('❌ Webhook test failed:', error.message);
    return false;
  }
}

/**
 * Make a test call
 */
async function makeTestCall(toNumber, endpoint = '/voice') {
  try {
    console.log(`\n📞 Making test call to ${toNumber}...`);
    console.log(`   Using endpoint: ${WEBHOOK_URL}${endpoint}`);
    
    const call = await client.calls.create({
      to: toNumber,
      from: twilioNumber,
      url: `${WEBHOOK_URL}${endpoint}`
    });
    
    console.log('✅ Call initiated successfully!');
    console.log(`   Call SID: ${call.sid}`);
    console.log(`   Status: ${call.status}`);
    
    return call.sid;
  } catch (error) {
    console.error('❌ Call failed:', error.message);
    return null;
  }
}

/**
 * Check call status
 */
async function checkCallStatus(callSid) {
  try {
    const call = await client.calls(callSid).fetch();
    
    console.log('\n📊 Call Status:');
    console.log(`   SID: ${call.sid}`);
    console.log(`   Status: ${call.status}`);
    console.log(`   Duration: ${call.duration} seconds`);
    console.log(`   Direction: ${call.direction}`);
    
    return call;
  } catch (error) {
    console.error('❌ Status check failed:', error.message);
    return null;
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('============================================');
  console.log('🚀 TWILIO INTEGRATION TEST');
  console.log('============================================');
  console.log(`Webhook URL: ${WEBHOOK_URL}`);
  console.log(`Twilio Number: ${twilioNumber}`);
  console.log('');
  
  // Test webhook
  const webhookOk = await testWebhook();
  
  if (!webhookOk) {
    console.log('\n⚠️  Please make sure the server is running!');
    return;
  }
  
  // Get test number from command line or use default
  const testNumber = process.argv[2] || '+905321234567';
  
  console.log(`\nTest number: ${testNumber}`);
  console.log('');
  
  // Test different endpoints
  const endpoints = ['/test', '/voice', '/voice-alt'];
  
  for (const endpoint of endpoints) {
    console.log(`\nTesting ${endpoint} endpoint...`);
    console.log('----------------------------------------');
    
    const callSid = await makeTestCall(testNumber, endpoint);
    
    if (callSid) {
      // Wait 5 seconds then check status
      console.log('\n⏳ Waiting 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      await checkCallStatus(callSid);
    }
    
    console.log('----------------------------------------');
  }
  
  console.log('\n✅ Tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testWebhook, makeTestCall, checkCallStatus };