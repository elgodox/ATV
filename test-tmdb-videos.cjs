// Test script to see what TMDb videos API returns
const fetch = require('node-fetch');
const dotenv = require('dotenv');

dotenv.config();

const API_KEY = process.env.API_KEY;

async function testTMDbVideos() {
  if (!API_KEY) {
    console.log('No API_KEY found in environment');
    return;
  }

  // Test with a popular movie (Spider-Man: No Way Home)
  const movieId = 634649;
  const url = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}&language=es-ES&append_to_response=videos`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Movie title:', data.title);
    console.log('Release date:', data.release_date);
    console.log('Videos found:', data.videos?.results?.length || 0);
    
    if (data.videos?.results?.length > 0) {
      console.log('\nTrailers and videos:');
      data.videos.results.forEach((video, index) => {
        console.log(`${index + 1}. ${video.name}`);
        console.log(`   Type: ${video.type}`);
        console.log(`   Site: ${video.site}`);
        console.log(`   Key: ${video.key}`);
        console.log(`   Official: ${video.official}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }

  // Test with a TV series (Breaking Bad)
  const tvId = 1396;
  const tvUrl = `https://api.themoviedb.org/3/tv/${tvId}?api_key=${API_KEY}&language=es-ES&append_to_response=videos`;
  
  try {
    const response = await fetch(tvUrl);
    const data = await response.json();
    
    console.log('\n--- TV Series ---');
    console.log('TV title:', data.name);
    console.log('First air date:', data.first_air_date);
    console.log('Videos found:', data.videos?.results?.length || 0);
    
    if (data.videos?.results?.length > 0) {
      console.log('\nTrailers and videos:');
      data.videos.results.forEach((video, index) => {
        console.log(`${index + 1}. ${video.name}`);
        console.log(`   Type: ${video.type}`);
        console.log(`   Site: ${video.site}`);
        console.log(`   Key: ${video.key}`);
        console.log(`   Official: ${video.official}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testTMDbVideos();