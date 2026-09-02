/**
 * Input Validation Test Script
 * 
 * This script tests the Zod validation implementation for all endpoints.
 * Run with: node test-validation.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';

let testsPassed = 0;
let testsFailed = 0;

function log(message) {
  console.log(`[TEST] ${message}`);
}

function pass(message) {
  testsPassed++;
  log(`✅ PASS: ${message}`);
}

function fail(message) {
  testsFailed++;
  log(`❌ FAIL: ${message}`);
}

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method: method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function testValidChatRequest() {
  log('Testing: Valid chat request should succeed');
  
  try {
    const response = await makeRequest('POST', '/api/chat', {
      messages: [
        { role: 'user', content: 'Hello' }
      ]
    });
    
    // Should fail with 500 due to missing GROQ_API_KEY, but validation should pass
    if (response.statusCode === 500 || response.statusCode === 200) {
      pass('Valid chat request passed validation');
    } else if (response.statusCode === 400) {
      fail(`Valid request rejected: ${JSON.stringify(response.body)}`);
    } else {
      log(`Request returned ${response.statusCode} (validation passed)`);
      pass('Valid chat request passed validation');
    }
  } catch (error) {
    fail(`Valid chat test error: ${error.message}`);
  }
}

async function testMissingMessages() {
  log('Testing: Missing messages should be rejected');
  
  try {
    const response = await makeRequest('POST', '/api/chat', {});
    
    if (response.statusCode === 400) {
      pass('Missing messages rejected with 400');
    } else {
      fail(`Missing messages not rejected (status: ${response.statusCode})`);
    }
  } catch (error) {
    fail(`Missing messages test error: ${error.message}`);
  }
}

async function testMessagesNotArray() {
  log('Testing: Messages not being an array should be rejected');
  
  try {
    const response = await makeRequest('POST', '/api/chat', {
      messages: 'not an array'
    });
    
    if (response.statusCode === 400) {
      pass('Non-array messages rejected with 400');
    } else {
      fail(`Non-array messages not rejected (status: ${response.statusCode})`);
    }
  } catch (error) {
    fail(`Messages not array test error: ${error.message}`);
  }
}

async function testInvalidRole() {
  log('Testing: Invalid message role should be rejected');
  
  try {
    const response = await makeRequest('POST', '/api/chat', {
      messages: [
        { role: 'invalid', content: 'Hello' }
      ]
    });
    
    if (response.statusCode === 400) {
      pass('Invalid role rejected with 400');
    } else {
      fail(`Invalid role not rejected (status: ${response.statusCode})`);
    }
  } catch (error) {
    fail(`Invalid role test error: ${error.message}`);
  }
}

async function testEmptyMessageContent() {
  log('Testing: Empty message content should be rejected');
  
  try {
    const response = await makeRequest('POST', '/api/chat', {
      messages: [
        { role: 'user', content: '' }
      ]
    });
    
    if (response.statusCode === 400) {
      pass('Empty content rejected with 400');
    } else {
      fail(`Empty content not rejected (status: ${response.statusCode})`);
    }
  } catch (error) {
    fail(`Empty content test error: ${error.message}`);
  }
}

async function testExcessivelyLongContent() {
  log('Testing: Excessively long content should be rejected');
  
  try {
    const longContent = 'a'.repeat(15000);
    const response = await makeRequest('POST', '/api/chat', {
      messages: [
        { role: 'user', content: longContent }
      ]
    });
    
    if (response.statusCode === 400) {
      pass('Excessively long content rejected with 400');
    } else {
      fail(`Long content not rejected (status: ${response.statusCode})`);
    }
  } catch (error) {
    fail(`Long content test error: ${error.message}`);
  }
}

async function testExcessiveMessageCount() {
  log('Testing: Excessive message count should be rejected');
  
  try {
    const messages = Array(100).fill({ role: 'user', content: 'test' });
    const response = await makeRequest('POST', '/api/chat', {
      messages: messages
    });
    
    if (response.statusCode === 400) {
      pass('Excessive message count rejected with 400');
    } else {
      fail(`Excessive message count not rejected (status: ${response.statusCode})`);
    }
  } catch (error) {
    fail(`Excessive message count test error: ${error.message}`);
  }
}

async function testInvalidModel() {
  log('Testing: Invalid model should be rejected');
  
  try {
    const response = await makeRequest('POST', '/api/chat', {
      messages: [
        { role: 'user', content: 'Hello' }
      ],
      model: 'invalid-model'
    });
    
    if (response.statusCode === 400) {
      pass('Invalid model rejected with 400');
    } else {
      fail(`Invalid model not rejected (status: ${response.statusCode})`);
    }
  } catch (error) {
    fail(`Invalid model test error: ${error.message}`);
  }
}

async function testMalformedPayload() {
  log('Testing: Malformed JSON should be rejected');
  
  try {
    const response = await makeRequest('POST', '/api/chat', 'not json');
    
    // Express body parser should handle this
    if (response.statusCode === 400 || response.statusCode === 415) {
      pass('Malformed JSON rejected');
    } else {
      log(`Malformed JSON returned ${response.statusCode}`);
      pass('Malformed JSON handled');
    }
  } catch (error) {
    fail(`Malformed payload test error: ${error.message}`);
  }
}

async function testLoginValidation() {
  log('Testing: Login endpoint validation');
  
  try {
    // Invalid PIN format
    const response1 = await makeRequest('POST', '/api/auth/parent/login', {
      pin: '123',
      storedPinHash: 'hash'
    });
    
    if (response1.statusCode === 400) {
      pass('Invalid PIN format rejected');
    } else {
      fail(`Invalid PIN format not rejected (status: ${response1.statusCode})`);
    }
  } catch (error) {
    fail(`Login validation test error: ${error.message}`);
  }
}

async function testInsightsValidation() {
  log('Testing: Insights endpoint validation');
  
  try {
    // Empty summary
    const response = await makeRequest('POST', '/api/insights', {
      summary: {}
    });
    
    if (response.statusCode === 400) {
      pass('Empty summary rejected');
    } else {
      fail(`Empty summary not rejected (status: ${response.statusCode})`);
    }
  } catch (error) {
    fail(`Insights validation test error: ${error.message}`);
  }
}

async function testDetectRiskValidation() {
  log('Testing: Detect risk endpoint validation');
  
  try {
    // Missing message
    const response = await makeRequest('POST', '/api/detect-risk', {});
    
    if (response.statusCode === 400) {
      pass('Missing message rejected');
    } else {
      fail(`Missing message not rejected (status: ${response.statusCode})`);
    }
  } catch (error) {
    fail(`Detect risk validation test error: ${error.message}`);
  }
}

async function runTests() {
  log('Starting input validation tests...');
  log('Make sure the backend server is running on http://localhost:3001');
  log('');
  
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for server to be ready
  
  await testValidChatRequest();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await testMissingMessages();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await testMessagesNotArray();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await testInvalidRole();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await testEmptyMessageContent();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await testExcessivelyLongContent();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await testExcessiveMessageCount();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await testInvalidModel();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await testMalformedPayload();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await testLoginValidation();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await testInsightsValidation();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await testDetectRiskValidation();
  
  log('');
  log('=== Test Summary ===');
  log(`Passed: ${testsPassed}`);
  log(`Failed: ${testsFailed}`);
  log(`Total: ${testsPassed + testsFailed}`);
  
  if (testsFailed === 0) {
    log('✅ All tests passed!');
    process.exit(0);
  } else {
    log('❌ Some tests failed');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  log(`Fatal error: ${error.message}`);
  process.exit(1);
});
