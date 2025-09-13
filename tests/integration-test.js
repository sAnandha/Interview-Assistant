const https = require('https');
const assert = require('assert');

const API_BASE_URL = process.env.API_BASE_URL || 'https://your-api-gateway-url.execute-api.region.amazonaws.com';

class IntegrationTest {
  async makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(API_BASE_URL + path);
      
      const requestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://example.com', // Test CORS
          ...options.headers,
        },
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = {
              statusCode: res.statusCode,
              headers: res.headers,
              body: data ? JSON.parse(data) : null,
            };
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      
      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      
      req.end();
    });
  }

  async testCorsHeaders(response) {
    console.log('Testing CORS headers...');
    
    assert(response.headers['access-control-allow-origin'], 'Missing CORS origin header');
    assert(response.headers['access-control-allow-methods'], 'Missing CORS methods header');
    assert(response.headers['access-control-allow-headers'], 'Missing CORS headers header');
    
    console.log('✓ CORS headers present');
  }

  async testCreateSession() {
    console.log('Testing session creation...');
    
    const response = await this.makeRequest('/sessions', {
      method: 'POST',
      body: {
        userId: 'test-user',
        interviewType: 'behavioral',
        difficulty: 'medium',
      },
    });

    assert.strictEqual(response.statusCode, 201, 'Expected 201 status code');
    assert(response.body.sessionId, 'Missing sessionId in response');
    assert.strictEqual(response.body.status, 'created', 'Expected created status');
    
    await this.testCorsHeaders(response);
    
    console.log('✓ Session creation successful');
    return response.body.sessionId;
  }

  async testGetQuestion(sessionId) {
    console.log('Testing question retrieval...');
    
    const response = await this.makeRequest(`/sessions/${sessionId}/question`);
    
    assert.strictEqual(response.statusCode, 200, 'Expected 200 status code');
    assert(response.body.question, 'Missing question in response');
    assert(typeof response.body.questionIndex === 'number', 'Missing questionIndex');
    assert(typeof response.body.totalQuestions === 'number', 'Missing totalQuestions');
    
    await this.testCorsHeaders(response);
    
    console.log('✓ Question retrieval successful');
    return response.body.questionIndex;
  }

  async testRecordTranscript(sessionId, questionIndex) {
    console.log('Testing transcript recording...');
    
    const response = await this.makeRequest(`/sessions/${sessionId}/transcript`, {
      method: 'POST',
      body: {
        transcript: 'This is a test response for the interview question.',
        questionIndex,
        audioUrl: null,
      },
    });

    assert.strictEqual(response.statusCode, 200, 'Expected 200 status code');
    assert(response.body.success, 'Expected success flag');
    assert(response.body.transcriptKey, 'Missing transcriptKey');
    
    await this.testCorsHeaders(response);
    
    console.log('✓ Transcript recording successful');
  }

  async testScoreSession(sessionId) {
    console.log('Testing session scoring...');
    
    const response = await this.makeRequest(`/sessions/${sessionId}/score`, {
      method: 'POST',
    });

    assert.strictEqual(response.statusCode, 200, 'Expected 200 status code');
    assert(typeof response.body.overallScore === 'number', 'Missing overallScore');
    assert(Array.isArray(response.body.scoredResponses), 'Missing scoredResponses array');
    assert(response.body.summary, 'Missing summary object');
    
    await this.testCorsHeaders(response);
    
    console.log('✓ Session scoring successful');
  }

  async testOptionsRequest() {
    console.log('Testing CORS preflight (OPTIONS)...');
    
    const response = await this.makeRequest('/sessions', {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });

    // OPTIONS should return 200 or 204
    assert([200, 204].includes(response.statusCode), 'Expected 200 or 204 for OPTIONS');
    
    await this.testCorsHeaders(response);
    
    console.log('✓ CORS preflight successful');
  }

  async runAllTests() {
    console.log('Starting integration tests...\n');
    
    try {
      // Test CORS preflight
      await this.testOptionsRequest();
      
      // Test full interview flow
      const sessionId = await this.testCreateSession();
      const questionIndex = await this.testGetQuestion(sessionId);
      await this.testRecordTranscript(sessionId, questionIndex);
      await this.testScoreSession(sessionId);
      
      console.log('\n✅ All integration tests passed!');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Integration test failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const test = new IntegrationTest();
  test.runAllTests();
}

module.exports = IntegrationTest;