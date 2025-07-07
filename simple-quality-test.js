// simple-quality-test.js
// Simple test to verify quality extraction is working

import fetch from 'node-fetch';

async function testQuality() {
  console.log('🧪 Testing quality extraction in API...\n');
  
  try {
    const response = await fetch('http://localhost:3001/api/tv-torrents?tvTitle=Game%20of%20Thrones&season=1&episode=1');
    
    if (response.ok) {
      const results = await response.json();
      console.log(`✅ Found ${results.length} torrents\n`);
      
      // Mostrar los primeros 5 resultados con calidad
      results.slice(0, 5).forEach((torrent, index) => {
        console.log(`${index + 1}. Title: ${torrent.title}`);
        console.log(`   Quality: ${torrent.quality || 'Not specified'}`);
        console.log(`   Size: ${torrent.size}`);
        console.log(`   Seeds: ${torrent.seeds}`);
        console.log(`   Provider: ${torrent.provider}`);
        console.log('');
      });
      
    } else {
      console.error(`❌ API request failed: ${response.status}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testQuality();
