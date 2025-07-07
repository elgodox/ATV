// test-quality-extraction.js
// Test script for quality extraction function

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Función para extraer calidad del título del torrent (copiada del servidor)
function extractQualityFromTitle(title) {
  if (!title) return 'Unknown';
  
  const titleUpper = title.toUpperCase();
  
  // Buscar resoluciones comunes en orden de preferencia
  const qualityPatterns = [
    { pattern: /4320|8K/i, quality: '8K'},
    { pattern: /2160P|4K|UHD/i, quality: '4K' },
    { pattern: /1080P/i, quality: '1080p' },
    { pattern: /720P/i, quality: '720p' },
    { pattern: /480P/i, quality: '480p' },
    { pattern: /360P/i, quality: '360p' },
    { pattern: /HDTV|HD/i, quality: 'HD' },
    { pattern: /DVDRIP|DVD/i, quality: 'DVD' },
    { pattern: /WEBRIP|WEB-DL|WEB/i, quality: 'WEB' },
    { pattern: /BLURAY|BLU-RAY|BD/i, quality: 'BluRay' },
    { pattern: /CAM|TS|TC/i, quality: 'CAM' }
  ];
  
  for (const { pattern, quality } of qualityPatterns) {
    if (pattern.test(titleUpper)) {
      return quality;
    }
  }
  
  // Si no se encuentra una calidad específica, intentar extraer números seguidos de 'P'
  const resolutionMatch = title.match(/(\d{3,4})P/i);
  if (resolutionMatch) {
    return resolutionMatch[1] + 'p';
  }
  
  return 'Unknown';
}

// Test cases
const testTitles = [
  'Game Of Thrones S01E01 HDTV XviD-FEVER',
  'Breaking Bad S01E01 1080p BluRay x264-DEMAND',
  'The Walking Dead S01E01 720p HDTV x264-CTU',
  'Friends S01E01 480p DVDRip XviD-SAiNTS',
  'Law.and.Order.SVU.S14E01E02.HDTV.XviD-AFG',
  'Stranger Things S01E01 2160p 4K UHD BluRay x265-TERMiNAL',
  'House MD S01E01 WEB-DL H264-FoV',
  'The Office S01E01 WEBRIP x264-FUM',
  'Lost S01E01 CAM XviD-PreVail',
  'Sherlock S01E01 BDRip 1080p',
  'The Mandalorian S01E01 1080p WEB h264-TBS',
  'Better Call Saul S01E01 720p HEVC x265-MeGusta'
];

console.log('🧪 Testing Quality Extraction Function\n');

testTitles.forEach((title, index) => {
  const quality = extractQualityFromTitle(title);
  console.log(`${index + 1}. Title: ${title}`);
  console.log(`   Quality: ${quality}\n`);
});

console.log('✅ Quality extraction test completed!');
