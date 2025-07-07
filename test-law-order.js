// test-law-order.js
// Test script specifically for Law & Order search

import { createRequire } from 'module';
import fetch from 'node-fetch';

const require = createRequire(import.meta.url);

const port = 3001;
const baseUrl = `http://localhost:${port}`;

async function testLawOrderSearch() {
  console.log('🔍 Testing Law & Order: Special Victims Unit S14E1 search...');
  
  try {
    const response = await fetch(`${baseUrl}/api/tv-torrents?tvTitle=Law%20%26%20Order%3A%20Special%20Victims%20Unit&season=14&episode=1`);
    
    if (response.ok) {
      const results = await response.json();
      console.log(`✅ Search successful! Found ${results.length} torrents`);
      
      if (results.length > 0) {
        console.log('📋 First result:');
        console.log(`   Title: ${results[0].title}`);
        console.log(`   Quality: ${results[0].quality || 'Not specified'}`);
        console.log(`   Size: ${results[0].size}`);
        console.log(`   Seeds: ${results[0].seeds}`);
        console.log(`   Provider: ${results[0].provider || 'Mock'}`);
        console.log(`   Magnet: ${results[0].magnet ? 'Available' : 'Not available'}`);
      }
      
      return results;
    } else {
      console.error(`❌ Search failed with status: ${response.status}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return null;
  }
}

async function testAlternativeSearch() {
  console.log('\n🔍 Testing alternative search format...');
  
  try {
    const response = await fetch(`${baseUrl}/api/tv-torrents?tvTitle=Law%20Order%20SVU&season=14&episode=1`);
    
    if (response.ok) {
      const results = await response.json();
      console.log(`✅ Alternative search successful! Found ${results.length} torrents`);
      
      if (results.length > 0) {
        console.log('📋 First result:');
        console.log(`   Title: ${results[0].title}`);
        console.log(`   Quality: ${results[0].quality || 'Not specified'}`);
        console.log(`   Size: ${results[0].size}`);
        console.log(`   Seeds: ${results[0].seeds}`);
      }
      
      return results;
    } else {
      console.error(`❌ Alternative search failed with status: ${response.status}`);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Alternative search failed:', error.message);
    return null;
  }
}

async function runTests() {
  console.log('🚀 Starting Law & Order search tests...\n');
  
  await testLawOrderSearch();
  await testAlternativeSearch();
  
  console.log('\n✅ Tests completed!');
}

runTests().catch(console.error);
