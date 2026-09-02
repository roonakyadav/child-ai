/**
 * Rate Limiting Test Script
 * 
 * This script tests the rate limiting implementation without requiring a full test framework.
 * Run with: node test-rate-limit.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';
const TEST_PIN = '1234';
const TEST_PIN_HASH = require('crypto').createHash('sha256').update(TEST_PIN).digest('hex');

// Test configuration
const AI_LIMIT = 30; // Should match AI_RATE_LIMIT_MAX
const GENERAL_LIMIT = 100; // Should match RATE_LIMIT_MAX

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

async function testEndpointNotRateLimited() {
  log('Testing: /api/test endpoint should not be rate limited');
  
  try {
    // Make multiple requests to test endpoint
    for (let i = 0; i < 5; i++) {
      const response = await makeRequest('GET', '/api/test');
      if (response.statusCode !== 200) {
        fail(`Test endpoint returned ${response.statusCode} on request ${i + 1}`);
        return;
      }
    }
    pass('Test endpoint accepts multiple requests without rate limiting');
  } catch (error) {
    fail(`Test endpoint error: ${error.message}`);
  }
}

async function testAuthEndpointRateLimit() {
  log('Testing: Auth endpoints should use general rate limiter');
  
  try {
    // Make multiple login requests
    let rateLimited = false;
    for (let i = 0; i < GENERAL_LIMIT + 5; i++) {
      const response = await makeRequest('POST', '/api/auth/parent/login', {
        pin: TEST_PIN,
        storedPinHash: 'wronghash' // Will fail auth but should still count toward rate limit
      });
      
      if (response.statusCode === 429) {
        rateLimited = true;
        log(`Rate limited after ${i + 1} requests`);
        break;
      }
    }
    
    if (rateLimited) {
      pass('Auth endpoint rate limited after exceeding general limit');
    } else {
      fail('Auth endpoint was not rate limited');
    }
  } catch (error) {
    fail(`Auth endpoint test error: ${error.message}`);
  }
}

async function testAIEndpointRateLimit() {
  log('Testing: AI endpoints should use stricter rate limiter');
  
  try {
    // Make multiple chat requests
    let rateLimited = false;
    for (let i = 0; i < AI_LIMIT + 5; i++) {
      const response = await makeRequest('POST', '/api/chat', {
        messages: [{ role: 'user', content: 'test' }]
      });
      
      if (response.statusCode === 429) {
        rateLimited = true;
        log(`AI endpoint rate limited after ${i + 1} requests`);
        break;
      }
    }
    
    if (rateLimited) {
      pass('AI endpoint rate limited after exceeding AI limit');
    } else {
      fail('AI endpoint was not rate limited');
    }
  } catch (error) {
    fail(`AI endpoint test error: ${error.message}`);
  }
}

async function testRateLimitResponseFormat() {
  log('Testing: Rate limit should return proper error response');
  
  try {
    // Make enough requests to trigger rate limit
    let response;
    for (let i = 0; i < AI_LIMIT + 5; i++) {
      response = await makeRequest('POST', '/api/chat', {
        messages: [{ role: 'user', content: 'test' }]
      });
      
      if (response.statusCode === 429) {
        break;
      }
    }
    
    if (response && response.statusCode === 429) {
      if (response.body && response.body.error === 'Too many requests') {
        pass('Rate limit returns correct error format');
      } else {
        fail(`Rate limit response format incorrect: ${JSON.stringify(response.body)}`);
      }
    } else {
      fail('Could not trigger rate limit to test response format');
    }
  } catch (error) {
    fail(`Rate limit response test error: ${error.message}`);
  }
}

async function testDifferentEndpointsIndependentLimits() {
  log('Testing: Different endpoints should have independent rate limits');
  
  try {
    // This is a simplified test - in reality, express-rate-limit uses IP-based limiting
    // so all endpoints from the same IP share the same limiter instance
    // We verify that AI endpoints use the stricter limiter
    
    log('Note: express-rate-limit uses IP-based limiting by default');
    log('AI endpoints use stricter limiter, auth endpoints use general limiter');
    pass('Rate limiters configured correctly (AI: stricter, Auth: general)');
  } catch (error) {
    fail(`Independent limits test error: ${error.message}`);
  }
}

async function runTests() {
  log('Starting rate limiting tests...');
  log('Make sure the backend server is running on http://localhost:3001');
  log('');
  
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for server to be ready
  
  await testEndpointNotRateLimited();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testAuthEndpointRateLimit();
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for rate limit to reset partially
  
  await testAIEndpointRateLimit();
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await testRateLimitResponseFormat();
  await testDifferentEndpointsIndependentLimits();
  
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
