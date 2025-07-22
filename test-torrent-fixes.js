#!/usr/bin/env node
// Test script to verify torrent search fixes
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

// Test configurations
const tests = [
  {
    name: 'TV Search by Title (GET)',
    method: 'GET',
    url: '/api/tv-torrents?tvTitle=Game%20of%20Thrones&season=1&episode=1',
    expectedFields: ['title', 'magnet', 'quality', 'seeds', 'peers']
  },
  {
    name: 'TV Search by TMDb ID (POST)',
    method: 'POST',
    url: '/api/search',
    body: { showId: 1399, seasonNumber: 1, episodeNumber: 1 },
    expectedFields: ['title', 'magnet', 'quality', 'seeds', 'peers']
  },
  {
    name: 'Movie Search (GET)',
    method: 'GET', 
    url: '/api/torrents?movieTitle=Avatar',
    expectedFields: ['title', 'isDemo', 'demoMessage']
  },
  {
    name: 'Known Series - Friends',
    method: 'POST',
    url: '/api/search',
    body: { showId: 1668, seasonNumber: 1, episodeNumber: 1 },
    expectedFields: ['title', 'magnet', 'quality']
  },
  {
    name: 'Known Series - Stranger Things',
    method: 'POST',
    url: '/api/search', 
    body: { showId: 46648, seasonNumber: 2, episodeNumber: 5 },
    expectedFields: ['title', 'magnet', 'quality']
  }
];

async function runTest(test) {
  console.log(`\n🧪 Running test: ${test.name}`);
  
  try {
    const options = {
      method: test.method,
      headers: test.method === 'POST' ? { 'Content-Type': 'application/json' } : {}
    };
    
    if (test.body) {
      options.body = JSON.stringify(test.body);
    }
    
    const response = await fetch(`${BASE_URL}${test.url}`, options);
    
    if (!response.ok) {
      console.log(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      return false;
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      console.log(`❌ No results returned`);
      return false;
    }
    
    const firstResult = data[0];
    console.log(`✅ Got ${data.length} results`);
    console.log(`📄 First result title: ${firstResult.title}`);
    
    // Check expected fields
    const missingFields = test.expectedFields.filter(field => !(field in firstResult));
    if (missingFields.length > 0) {
      console.log(`⚠️  Missing fields: ${missingFields.join(', ')}`);
    } else {
      console.log(`✅ All expected fields present`);
    }
    
    // Show key information
    if (firstResult.quality) console.log(`🎬 Quality: ${firstResult.quality}`);
    if (firstResult.seeds) console.log(`🌱 Seeds: ${firstResult.seeds}`);
    if (firstResult.peers) console.log(`👥 Peers: ${firstResult.peers}`);
    if (firstResult.size) console.log(`📦 Size: ${firstResult.size}`);
    if (firstResult.isDemo) console.log(`🎭 Demo data: ${firstResult.demoMessage || 'Yes'}`);
    
    return true;
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Torrent Search Fix Tests...');
  
  let passed = 0;
  let total = tests.length;
  
  for (const test of tests) {
    const success = await runTest(test);
    if (success) passed++;
  }
  
  console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('✅ All tests passed! Torrent search fixes are working correctly.');
  } else {
    console.log('❌ Some tests failed. Check the output above for details.');
  }
  
  // Additional connectivity test
  console.log('\n🔗 Testing server connectivity...');
  try {
    const response = await fetch(`${BASE_URL}/`);
    if (response.ok) {
      console.log('✅ Server is running and responding');
    } else {
      console.log(`⚠️  Server responded with status: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Cannot connect to server: ${error.message}`);
    console.log('💡 Make sure the server is running: npm start');
  }
}

// Run tests
runAllTests().catch(console.error);