// test-tv-torrents.js
// Simple test script to verify TV torrent search functionality

import { createRequire } from 'module';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

const require = createRequire(import.meta.url);
const TorrentSearchApi = require('torrent-search-api');

dotenv.config();

// Test configuration
const API_KEY = process.env.API_KEY;
const TEST_SHOW_ID = 1399; // Game of Thrones
const TEST_SEASON = 1;
const TEST_EPISODE = 1;

// Initialize TorrentSearchApi
const torrentSearch = require('torrent-search-api');
torrentSearch.enableProvider('Torrent9');
torrentSearch.enableProvider('1337x');
torrentSearch.enableProvider('ThePirateBay');

// Test functions
async function testTMDbAPI() {
  console.log('\n=== Testing TMDb API ===');
  
  if (!API_KEY || API_KEY === 'demo_key_for_testing') {
    console.log('⚠️  No valid API key found, using demo mode');
    return null;
  }

  try {
    // Test series details
    const seriesUrl = `https://api.themoviedb.org/3/tv/${TEST_SHOW_ID}?api_key=${API_KEY}&language=en`;
    const seriesResponse = await fetch(seriesUrl);
    
    if (!seriesResponse.ok) {
      throw new Error(`TMDb API error: ${seriesResponse.status} ${seriesResponse.statusText}`);
    }
    
    const seriesData = await seriesResponse.json();
    console.log(`✅ Successfully fetched series: ${seriesData.name}`);
    
    // Test episode details
    const episodeUrl = `https://api.themoviedb.org/3/tv/${TEST_SHOW_ID}/season/${TEST_SEASON}/episode/${TEST_EPISODE}?api_key=${API_KEY}&language=en`;
    const episodeResponse = await fetch(episodeUrl);
    
    if (!episodeResponse.ok) {
      throw new Error(`TMDb API error: ${episodeResponse.status} ${episodeResponse.statusText}`);
    }
    
    const episodeData = await episodeResponse.json();
    console.log(`✅ Successfully fetched episode: ${episodeData.name}`);
    
    return { series: seriesData, episode: episodeData };
    
  } catch (error) {
    console.error('❌ TMDb API test failed:', error.message);
    return null;
  }
}

async function testTorrentSearch() {
  console.log('\n=== Testing Torrent Search ===');
  
  try {
    const query = 'Game of Thrones S01E01';
    console.log(`🔍 Searching for: ${query}`);
    
    const searchResults = await torrentSearch.search(query, 'TV', 10);
    console.log(`✅ Found ${searchResults.length} torrent results`);
    
    if (searchResults.length > 0) {
      console.log('📋 First result:');
      console.log(`   Title: ${searchResults[0].title}`);
      console.log(`   Size: ${searchResults[0].size}`);
      console.log(`   Seeds: ${searchResults[0].seeds}`);
      console.log(`   Quality: ${searchResults[0].quality || 'Not specified'}`);
      console.log(`   Provider: ${searchResults[0].provider}`);
      
      // Test magnet link retrieval
      try {
        const magnetLink = await torrentSearch.getMagnet(searchResults[0]);
        console.log(`✅ Successfully retrieved magnet link: ${magnetLink.substring(0, 50)}...`);
      } catch (magnetError) {
        console.log(`⚠️  Could not retrieve magnet link: ${magnetError.message}`);
      }
    }
    
    return searchResults;
    
  } catch (error) {
    console.error('❌ Torrent search test failed:', error.message);
    return [];
  }
}

async function testServerEndpoints() {
  console.log('\n=== Testing Server Endpoints ===');
  
  const port = process.env.PORT || 3001;
  const baseUrl = `http://localhost:${port}`;
  
  try {
    // Test the new tv-search compatible endpoint
    const searchData = {
      showId: TEST_SHOW_ID,
      seasonNumber: TEST_SEASON,
      episodeNumber: TEST_EPISODE
    };
    
    console.log('🔍 Testing POST /api/search endpoint...');
    
    const searchResponse = await fetch(`${baseUrl}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchData)
    });
    
    if (searchResponse.ok) {
      const searchResults = await searchResponse.json();
      console.log(`✅ /api/search endpoint working: ${searchResults.length} results`);
      
      if (searchResults.length > 0) {
        console.log('📋 First result:');
        console.log(`   Title: ${searchResults[0].title}`);
        console.log(`   Quality: ${searchResults[0].quality || 'Not specified'}`);
        console.log(`   Provider: ${searchResults[0].provider}`);
        console.log(`   Seeds: ${searchResults[0].seeds}`);
      }
    } else {
      console.log(`⚠️  /api/search endpoint returned: ${searchResponse.status}`);
    }
    
    // Test the existing tv-torrents endpoint
    console.log('🔍 Testing GET /api/tv-torrents endpoint...');
    
    const tvTorrentsResponse = await fetch(`${baseUrl}/api/tv-torrents?tvTitle=Game%20of%20Thrones&season=1&episode=1`);
    
    if (tvTorrentsResponse.ok) {
      const tvTorrentsResults = await tvTorrentsResponse.json();
      console.log(`✅ /api/tv-torrents endpoint working: ${tvTorrentsResults.length} results`);
    } else {
      console.log(`⚠️  /api/tv-torrents endpoint returned: ${tvTorrentsResponse.status}`);
    }
    
  } catch (error) {
    console.error('❌ Server endpoint test failed:', error.message);
    console.log('💡 Make sure the server is running: npm start');
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting TV Torrent Search Tests...');
  
  await testTMDbAPI();
  await testTorrentSearch();
  await testServerEndpoints();
  
  console.log('\n✅ Test suite completed!');
  console.log('\n💡 Usage examples:');
  console.log('   POST /api/search');
  console.log('   Body: {"showId": 1399, "seasonNumber": 1, "episodeNumber": 1}');
  console.log('');
  console.log('   GET /api/tv-torrents?tvTitle=Game%20of%20Thrones&season=1&episode=1');
  console.log('');
  console.log('   POST /api/tv-torrents/search');
  console.log('   Body: {"showId": 1399, "seasonNumber": 1, "episodeNumber": 1}');
}

// Run the tests
runTests().catch(console.error);
