#!/usr/bin/env node

/**
 * VendAI POS - Deployment Test Script
 * Tests API endpoints after deployment
 */

const https = require('https');

const TEST_URLS = [
  'https://app.vendai.digital/api/releases/latest',
  'https://app.vendai.digital/api/releases/check-update?version=v1.0.0&platform=win32'
];

function testEndpoint(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const result = {
            url,
            status: response.statusCode,
            data: JSON.parse(data),
            headers: response.headers
          };
          resolve(result);
        } catch (error) {
          resolve({
            url,
            status: response.statusCode,
            error: 'Invalid JSON response',
            rawData: data
          });
        }
      });
    });
    
    request.on('error', (error) => {
      reject({ url, error: error.message });
    });
    
    request.setTimeout(10000, () => {
      request.destroy();
      reject({ url, error: 'Request timeout' });
    });
  });
}

async function runTests() {
  console.log('🧪 VendAI POS - API Endpoint Tests');
  console.log('================================');
  console.log('');
  
  let allPassed = true;
  
  for (const url of TEST_URLS) {
    console.log(`Testing: ${url}`);
    
    try {
      const result = await testEndpoint(url);
      
      if (result.status === 200) {
        console.log(`✅ Status: ${result.status} - OK`);
        console.log(`📊 Response: ${JSON.stringify(result.data, null, 2)}`);
      } else {
        console.log(`❌ Status: ${result.status} - Error`);
        console.log(`📊 Response: ${result.rawData || JSON.stringify(result.data, null, 2)}`);
        allPassed = false;
      }
    } catch (error) {
      console.log(`❌ Request failed: ${error.error}`);
      allPassed = false;
    }
    
    console.log('');
  }
  
  console.log('================================');
  if (allPassed) {
    console.log('✅ All tests passed! Your deployment is working correctly.');
  } else {
    console.log('❌ Some tests failed. Please check your deployment.');
  }
}

if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testEndpoint, runTests };