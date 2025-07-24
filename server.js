
import express from 'express';
import fetch from 'node-fetch';
import WebTorrent from 'webtorrent';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const TorrentSearchApi = require('torrent-search-api');

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY;
const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN;
const OPENSUBTITLES_API_KEY = process.env.OPENSUBTITLES_API_KEY;


function filterAdultContent(results, adultFilter) {
  if (!results) return results;
  
  if (adultFilter === 'only') {
 
    return results.filter(item => item.adult === true);
  } else if (adultFilter === 'false') {
 
    return results.filter(item => item.adult !== true);
  }
  
 
  return results;
}



const client = new WebTorrent();


const subtitleCache = new Map();


const torrentSearch = require('torrent-search-api');


function setupTorrentProviders() {
 
  
  try {
 
    torrentSearch.enablePublicProviders();
 
    
    const activeProviders = torrentSearch.getActiveProviders();
 
    
    return activeProviders.length > 0;
  } catch (error) {
 
    
 
    const availableProviders = torrentSearch.getProviders().map(p => p.name);
 
    
 
    const preferredProviders = [
      '1337x',
      'Rarbg', 
      'ThePirateBay',
      'Limetorrents',
      'KickassTorrents',
      'Eztv',
      'Yts'
    ];
    
    let enabledCount = 0;
    for (const provider of preferredProviders) {
      try {
        if (availableProviders.includes(provider)) {
          torrentSearch.enableProvider(provider);
 
          enabledCount++;
        } else {
 
        }
      } catch (error) {
 
      }
    }
    
    const activeProviders = torrentSearch.getActiveProviders();
 
    
    return enabledCount > 0;
  }
}


app.get('/api/torrent-status', async (req, res) => {
  try {
    const activeProviders = torrentSearch.getActiveProviders();
    const allProviders = torrentSearch.getProviders();
    
 
    let searchWorking = false;
    let testError = null;
    
    try {
 
      const testResults = await Promise.race([
        torrentSearch.search('test', 'TV', 1),
        new Promise((resolve) => setTimeout(() => resolve([]), 5000))
      ]);
      searchWorking = true;
 
    } catch (error) {
      testError = error.message;
 
    }
    
    const status = {
      timestamp: new Date().toISOString(),
      totalProviders: allProviders.length,
      activeProviders: activeProviders.length,
      providerNames: activeProviders.map(p => p.name),
      searchFunctional: searchWorking,
      searchError: testError,
      mockDataEnabled: true,
      fallbackMode: !searchWorking || activeProviders.length === 0,
      config: {
        hasAPIKey: !!(API_KEY && API_KEY !== 'demo_key_for_testing'),
        knownSeriesCount: 30
      }
    };
    
    res.json(status);
    
  } catch (error) {
 
    res.status(500).json({
      error: 'Error checking torrent status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});


const hasActiveProviders = setupTorrentProviders();


const mockTorrentData = {
 
  movies: [
    {
      title: "Example Movie 2024 1080p BluRay x264-EXAMPLE",
      size: "1.8 GB",
      seeds: 128,
      peers: 45,
      leeches: 45,
      provider: "Demo",
      desc: "Demo torrent data",
      magnet: "magnet:?xt=urn:btih:c12fe1c06bba254a9dc9f519b335aa7c1367a88a&dn=Example+Movie+2024+1080p",
      quality: "1080p",
      type: "movie",
      hash: "c12fe1c06bba254a9dc9f519b335aa7c1367a88a"
    },
    {
      title: "Example Movie 2024 720p WEB-DL x264-EXAMPLE",
      size: "1.2 GB", 
      seeds: 85,
      peers: 32,
      leeches: 32,
      provider: "Demo",
      desc: "Demo torrent data",
      magnet: "magnet:?xt=urn:btih:d23fe1c06bba254a9dc9f519b335aa7c1367a99b&dn=Example+Movie+2024+720p",
      quality: "720p",
      type: "movie",
      hash: "d23fe1c06bba254a9dc9f519b335aa7c1367a99b"
    }
  ],
  
 
  tv: [
    {
      title: "Example Series S01E01 1080p HDTV x264-EXAMPLE",
      size: "550 MB",
      seeds: 95,
      peers: 28,
      leeches: 28,
      provider: "Demo",
      desc: "Demo torrent data",
      magnet: "magnet:?xt=urn:btih:e34fe1c06bba254a9dc9f519b335aa7c1367a11c&dn=Example+Series+S01E01",
      quality: "1080p",
      type: "tv",
      season: 1,
      episode: 1,
      hash: "e34fe1c06bba254a9dc9f519b335aa7c1367a11c"
    },
    {
      title: "Example Series S01E01 720p HDTV x264-EXAMPLE",
      size: "350 MB",
      seeds: 67,
      peers: 19,
      leeches: 19,
      provider: "Demo", 
      desc: "Demo torrent data",
      magnet: "magnet:?xt=urn:btih:f45fe1c06bba254a9dc9f519b335aa7c1367a22d&dn=Example+Series+S01E01+720p",
      quality: "720p",
      type: "tv",
      season: 1,
      episode: 1,
      hash: "f45fe1c06bba254a9dc9f519b335aa7c1367a22d"
    }
  ]
};


function generateMockTorrents(title, type = 'movie', season = null, episode = null) {
 
  
  const baseTorrents = type === 'tv' ? mockTorrentData.tv : mockTorrentData.movies;
  const mockTorrents = [];
  
 
  const qualities = [
    { name: '1080p', size: type === 'tv' ? '550 MB' : '1.8 GB', seeds: 95, peers: 28 },
    { name: '720p', size: type === 'tv' ? '350 MB' : '1.2 GB', seeds: 67, peers: 19 },
    { name: '480p', size: type === 'tv' ? '250 MB' : '800 MB', seeds: 45, peers: 15 }
  ];
  
  qualities.forEach((quality, index) => {
 
    const hash = require('crypto')
      .createHash('sha1')
      .update(`${title}-${quality.name}-${type}-${Date.now()}-${index}`)
      .digest('hex')
      .substring(0, 40);
    
    let torrentTitle = title;
    if (type === 'tv' && season && episode) {
      const seasonStr = season.toString().padStart(2, '0');
      const episodeStr = episode.toString().padStart(2, '0');
      torrentTitle = `${title} S${seasonStr}E${episodeStr} ${quality.name} HDTV x264-DEMO`;
    } else {
      torrentTitle = `${title} ${quality.name} WEB-DL x264-DEMO`;
    }
    
    const mockTorrent = {
      title: torrentTitle,
      size: quality.size,
      seeds: quality.seeds + Math.floor(Math.random() * 20),
      peers: quality.peers + Math.floor(Math.random() * 10),
      leeches: quality.peers + Math.floor(Math.random() * 10),
      provider: "Demo Data",
      desc: `Demo torrent for ${title}`,
      magnet: `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(torrentTitle)}`,
      quality: quality.name,
      type: type,
      hash: hash,
      isDemo: true,
      demoMessage: "Demo torrent data - real torrents not available"
    };
    
    if (type === 'tv') {
      mockTorrent.season = season;
      mockTorrent.episode = episode;
    }
    
    mockTorrents.push(mockTorrent);
  });
  
 
  return mockTorrents;
}
const additionalTrackers = [
  'udp://tracker.openbittorrent.com:80/announce',
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://tracker.coppersurfer.tk:6969/announce',
  'udp://tracker.leechers-paradise.org:6969/announce',
  'udp://tracker.pirateparty.gr:6969/announce',
  'udp://eddie4.nl:6969/announce',
  'udp://shadowshq.yi.org:6969/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://9.rarbg.to:2710/announce',
  'udp://tracker.internetwarriors.net:1337/announce'
];


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(__dirname, 'uploads', 'subtitles');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });


app.use(express.json());


app.use(express.static('public'));


app.use('/subtitles', express.static(path.join(__dirname, 'uploads', 'subtitles')));


app.get('/api/config', (req, res) => {
  res.json({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
  });
});


app.get('/api/genres', async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(503).json({ 
        message: 'API key is required. Please configure TMDb API key in environment variables.' 
      });
    }
    
    const url = `https://api.themoviedb.org/3/genre/movie/list?api_key=${API_KEY}&language=es`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
 
    res.status(500).json({ message: 'Error fetching genres' });
  }
});


app.get('/api/genres/:type', async (req, res) => {
  const { type } = req.params;

  try {
    if (!API_KEY) {
      return res.status(503).json({ 
        message: 'API key is required. Please configure TMDb API key in environment variables.' 
      });
    }
    
    const url = `https://api.themoviedb.org/3/genre/${type}/list?api_key=${API_KEY}&language=es`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data.genres);
  } catch (error) {
 
    res.status(500).json({ message: 'Error fetching genres' });
  }
});



app.get('/api/titles', async (req, res) => {
  const { type, searchQuery, genre, platform, sortBy, page, adultFilter } = req.query;
  
  let url;
  const adultParam = adultFilter === 'false' ? '&include_adult=false' : '&include_adult=true';
  
  if (searchQuery) {
    url = `https://api.themoviedb.org/3/search/${type}?api_key=${API_KEY}&query=${searchQuery}&page=${page}&language=en&with_watch_providers=${platform}&watch_region=US${adultParam}`;
  } else {
    url = `https://api.themoviedb.org/3/discover/${type}?api_key=${API_KEY}&with_watch_providers=${platform}&watch_region=US&page=${page}&with_genres=${genre}&language=en&sort_by=${sortBy}${adultParam}`;
  }

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`TMDb API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
 
    if (data.results) {
      data.results = data.results.filter(item => item.poster_path);
      
 
      data.results = filterAdultContent(data.results, adultFilter);
      
      data.total_results = data.results.length;
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching titles:', error);
 
    res.status(200).json({
      results: [],
      total_pages: 0,
      total_results: 0,
      error: 'Network connectivity issue - unable to fetch movie data'
    });
  }
});


app.get('/api/search-all', async (req, res) => {
  const { searchQuery, genre, platform, sortBy, page = 1, type, adultFilter } = req.query;
  
  if (!searchQuery || searchQuery.trim() === '') {
    return res.status(400).json({
      results: [],
      total_pages: 0,
      total_results: 0,
      error: 'Search query is required'
    });
  }

  try {
    if (!API_KEY) {
      return res.status(503).json({
        results: [],
        total_pages: 0,
        total_results: 0,
        error: 'API key is required. Please configure TMDb API key in environment variables.'
      });
    }

 
    let movieUrl = null;
    let tvUrl = null;
    
 
    const searchMovies = !type || type === '' || type === 'movie';
    const searchTV = !type || type === '' || type === 'tv';
    
 
    const baseParams = `api_key=${API_KEY}&query=${encodeURIComponent(searchQuery)}&page=${page}&language=en`;
    const platformParam = platform && platform !== '' ? `&with_watch_providers=${platform}&watch_region=US` : '';
    const genreParam = genre && genre !== '' ? `&with_genres=${genre}` : '';
    const adultParam = adultFilter === 'false' ? '&include_adult=false' : '&include_adult=true';
    
 
    if (searchMovies) {
      movieUrl = `https://api.themoviedb.org/3/search/movie?${baseParams}${platformParam}${genreParam}${adultParam}`;
    }
    
    if (searchTV) {
      tvUrl = `https://api.themoviedb.org/3/search/tv?${baseParams}${platformParam}${genreParam}${adultParam}`;
    }
    
 
    const requests = [];
    if (movieUrl) requests.push(fetch(movieUrl));
    if (tvUrl) requests.push(fetch(tvUrl));
    
    if (requests.length === 0) {
      throw new Error('No search type specified');
    }
    
    const responses = await Promise.all(requests);
    
 
    for (const response of responses) {
      if (!response.ok) {
        throw new Error(`TMDb API error: ${response.statusText}`);
      }
    }
    
    const dataPromises = responses.map(response => response.json());
    const dataResults = await Promise.all(dataPromises);
    
    let movieData = { results: [], total_results: 0, total_pages: 0 };
    let tvData = { results: [], total_results: 0, total_pages: 0 };
    
 
    let dataIndex = 0;
    if (searchMovies) {
      movieData = dataResults[dataIndex++];
    }
    if (searchTV) {
      tvData = dataResults[dataIndex++];
    }
    
 
    const moviesWithType = (movieData.results || [])
      .filter(item => item.poster_path)
      .map(item => ({
        ...item,
        content_type: 'movie'
      }));
    
    const tvWithType = (tvData.results || [])
      .filter(item => item.poster_path)
      .map(item => ({
        ...item,
        content_type: 'tv'
      }));
    
 
    let allResults = [...moviesWithType, ...tvWithType];
    
 
    allResults = filterAdultContent(allResults, adultFilter);
    
 
    allResults.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    
 
    const activeFilters = {
      platform: platform && platform !== '' ? platform : null,
      genre: genre && genre !== '' ? genre : null,
      type: type && type !== '' ? type : null,
      adultFilter: adultFilter && adultFilter !== '' ? adultFilter : null
    };
    
 
    const filteredMovies = allResults.filter(item => item.content_type === 'movie');
    const filteredTV = allResults.filter(item => item.content_type === 'tv');
    
    res.json({
      results: allResults,
      total_pages: Math.max(movieData.total_pages || 0, tvData.total_pages || 0),
      total_results: filteredMovies.length + filteredTV.length,
      movie_results: filteredMovies.length,
      tv_results: filteredTV.length,
      active_filters: activeFilters,
      is_filtered: Boolean(activeFilters.platform || activeFilters.genre || activeFilters.type || activeFilters.adultFilter)
    });
  } catch (error) {
    console.error('Error fetching search results:', error);
    res.status(200).json({
      results: [],
      total_pages: 0,
      total_results: 0,
      error: 'Network connectivity issue - unable to fetch search data'
    });
  }
});



app.get('/api/youtube-trailer', async (req, res) => {
  const title = req.query.title;
  const year = req.query.year;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

 
  const searchTerm = year ? `${title} ${year} trailer` : `${title} trailer`;
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm)}`;

  try {
    const response = await fetch(searchUrl);
    const data = await response.text();

 
    const videoMatches = data.matchAll(/"videoId":"([^"]+)".*?"title":"([^"]+)"/g);
    
    for (const match of videoMatches) {
      const videoId = match[1];
      const videoTitle = match[2];
      
 
      if (videoTitle.toLowerCase().includes('trailer') && 
          !videoTitle.toLowerCase().includes('reaction') &&
          !videoTitle.toLowerCase().includes('review') &&
          !videoTitle.toLowerCase().includes('fan made')) {
        return res.json({ 
          videoId: videoId,
          title: videoTitle,
          source: 'youtube'
        });
      }
    }

 
    const videoIdMatch = data.match(/"videoId":"(.*?)"/);
    if (videoIdMatch && videoIdMatch[1]) {
      return res.json({ 
        videoId: videoIdMatch[1],
        title: 'Video relacionado',
        source: 'youtube'
      });
    }

    return res.status(404).json({ error: 'Trailer not found' });
  } catch (error) {
    console.error('Error fetching YouTube trailer:', error);
    return res.status(500).json({ error: 'Error fetching YouTube trailer' });
  }
});


app.get('/api/vimeo-trailer', async (req, res) => {
  const title = req.query.title;
  const year = req.query.year;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

 
  const searchTerm = year ? `${title} ${year} trailer` : `${title} trailer`;
  const searchUrl = `https://api.vimeo.com/videos?query=${encodeURIComponent(searchTerm)}&per_page=5`;

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`
      }
    });
    const data = await response.json();

    if (data.data && data.data.length > 0) {
 
      const relevantTrailer = data.data.find(video => {
        const name = video.name.toLowerCase();
        const description = video.description ? video.description.toLowerCase() : '';
        return (name.includes('trailer') || name.includes('official')) && 
               !name.includes('fan') && !name.includes('reaction') && !name.includes('review');
      }) || data.data[0];

      const vimeoTrailerId = relevantTrailer.uri.split('/').pop();
      return res.json({ 
        videoId: vimeoTrailerId,
        title: relevantTrailer.name,
        source: 'vimeo'
      });
    }

    return res.status(404).json({ error: 'Trailer not found on Vimeo' });
  } catch (error) {
    console.error('Error fetching Vimeo trailer:', error);
    return res.status(500).json({ error: 'Error fetching Vimeo trailer' });
  }
});


app.get('/api/enhanced-trailer', async (req, res) => {
  const { title, year, type, id, season } = req.query;
  
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    let trailerResult = null;

 
    if (id && API_KEY) {
      try {
        let tmdbUrl;
        
 
        if (type === 'tv' && season) {
          tmdbUrl = `https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${API_KEY}&append_to_response=videos`;
        } else {
          tmdbUrl = `https://api.themoviedb.org/3/${type}/${id}?api_key=${API_KEY}&append_to_response=videos`;
        }
        
        const tmdbResponse = await fetch(tmdbUrl);
        const tmdbData = await tmdbResponse.json();
        
        if (tmdbData.videos && tmdbData.videos.results.length > 0) {
 
          const officialTrailers = tmdbData.videos.results.filter(video => 
            video.type === 'Trailer' && 
            video.official === true && 
            (video.site === 'YouTube' || video.site === 'Vimeo')
          );
          
 
          const anyTrailers = tmdbData.videos.results.filter(video => 
            video.type === 'Trailer' && 
            (video.site === 'YouTube' || video.site === 'Vimeo')
          );
          
          const bestTrailer = officialTrailers[0] || anyTrailers[0];
          
          if (bestTrailer) {
            trailerResult = {
              videoId: bestTrailer.key,
              source: bestTrailer.site.toLowerCase(),
              title: bestTrailer.name,
              official: bestTrailer.official,
              fromTMDb: true,
              season: season || null
            };
          }
        }
      } catch (error) {
        console.log('TMDb trailer search failed:', error.message);
      }
    }

 
    if (!trailerResult) {
      try {
        let searchTerm;
        
 
        if (type === 'tv' && season) {
          searchTerm = year ? 
            `${title} season ${season} ${year} trailer` : 
            `${title} season ${season} trailer`;
        } else {
          searchTerm = year ? `${title} ${year} trailer` : `${title} trailer`;
        }
        
        const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm)}`;
        
        const response = await fetch(youtubeUrl);
        const data = await response.text();
        
 
        const videoMatches = data.matchAll(/"videoId":"([^"]+)".*?"title":"([^"]+)"/g);
        
        for (const match of videoMatches) {
          const videoId = match[1];
          const videoTitle = match[2];
          
 
          const lowerTitle = videoTitle.toLowerCase();
          if (lowerTitle.includes('trailer') && 
              !lowerTitle.includes('reaction') &&
              !lowerTitle.includes('review') &&
              !lowerTitle.includes('fan made') &&
              !lowerTitle.includes('parody')) {
            
 
            if (type === 'tv' && season) {
              if (lowerTitle.includes(`season ${season}`) || 
                  lowerTitle.includes(`s${season}`) ||
                  lowerTitle.includes(`temporada ${season}`)) {
                trailerResult = {
                  videoId: videoId,
                  source: 'youtube',
                  title: videoTitle,
                  official: false,
                  fromTMDb: false,
                  season: season
                };
                break;
              }
            } else {
              trailerResult = {
                videoId: videoId,
                source: 'youtube',
                title: videoTitle,
                official: false,
                fromTMDb: false,
                season: season || null
              };
              break;
            }
          }
        }
        
 
        if (!trailerResult && data.match(/"videoId":"(.*?)"/)) {
          const firstVideoId = data.match(/"videoId":"(.*?)"/)[1];
          trailerResult = {
            videoId: firstVideoId,
            source: 'youtube',
            title: season ? `Video relacionado - Temporada ${season}` : 'Video relacionado',
            official: false,
            fromTMDb: false,
            season: season || null
          };
        }
      } catch (error) {
        console.log('YouTube trailer search failed:', error.message);
      }
    }

 
    if (!trailerResult && VIMEO_ACCESS_TOKEN) {
      try {
        let searchTerm;
        
        if (type === 'tv' && season) {
          searchTerm = year ? 
            `${title} season ${season} ${year} trailer` : 
            `${title} season ${season} trailer`;
        } else {
          searchTerm = year ? `${title} ${year} trailer` : `${title} trailer`;
        }
        
        const vimeoUrl = `https://api.vimeo.com/videos?query=${encodeURIComponent(searchTerm)}&per_page=5`;
        
        const response = await fetch(vimeoUrl, {
          headers: {
            'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`
          }
        });
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
          const relevantTrailer = data.data.find(video => {
            const name = video.name.toLowerCase();
            const isTrailer = name.includes('trailer') && !name.includes('fan') && !name.includes('reaction');
            
            if (type === 'tv' && season) {
              return isTrailer && (name.includes(`season ${season}`) || name.includes(`s${season}`));
            }
            return isTrailer;
          }) || data.data[0];
          
          trailerResult = {
            videoId: relevantTrailer.uri.split('/').pop(),
            source: 'vimeo',
            title: relevantTrailer.name,
            official: false,
            fromTMDb: false,
            season: season || null
          };
        }
      } catch (error) {
        console.log('Vimeo trailer search failed:', error.message);
      }
    }

 
    if (!trailerResult) {
      try {
        let searchTerm;
        
        if (type === 'tv' && season) {
          searchTerm = year ? 
            `${title} season ${season} ${year} trailer` : 
            `${title} season ${season} trailer`;
        } else {
          searchTerm = year ? `${title} ${year} trailer` : `${title} trailer`;
        }
        
 
        const dailymotionUrl = `https://www.dailymotion.com/json/videos?search=${encodeURIComponent(searchTerm)}&fields=id,title&limit=5`;
        
        const response = await fetch(dailymotionUrl);
        const data = await response.json();
        
        if (data.list && data.list.length > 0) {
          const relevantTrailer = data.list.find(video => {
            const title = video.title.toLowerCase();
            const isTrailer = title.includes('trailer') && 
                            !title.includes('reaction') && 
                            !title.includes('review') && 
                            !title.includes('fan');
            
            if (type === 'tv' && season) {
              return isTrailer && (title.includes(`season ${season}`) || title.includes(`s${season}`));
            }
            return isTrailer;
          }) || data.list[0];
          
          trailerResult = {
            videoId: relevantTrailer.id,
            source: 'dailymotion',
            title: relevantTrailer.title,
            official: false,
            fromTMDb: false,
            season: season || null
          };
        }
      } catch (error) {
        console.log('Dailymotion trailer search failed:', error.message);
      }
    }

    if (trailerResult) {
      return res.json(trailerResult);
    } else {
      return res.status(404).json({ error: 'No trailer found' });
    }

  } catch (error) {
    console.error('Error in enhanced trailer search:', error);
    return res.status(500).json({ error: 'Error searching for trailer' });
  }
});


app.get('/api/titles/details', async (req, res) => {
    const { id, type, language } = req.query;
    
    try {
      if (!API_KEY) {
        return res.status(503).json({
          id: id,
          title: 'Movie Details Unavailable',
          overview: 'API key is required. Please configure TMDb API key in environment variables.',
          poster_path: null,
          backdrop_path: null,
          videos: { results: [] },
          error: 'API key required'
        });
      }
      
      const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${API_KEY}&language=${language}&append_to_response=videos`;
      const response = await fetch(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'ATV-App/1.0'
        }
      });
      
 
      if (!response.ok) {
        throw new Error(`Failed to fetch data from TMDb: ${response.statusText}`);
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Error fetching movie details:', error);
 
      res.status(200).json({
        id: id,
        title: 'Movie Details Unavailable',
        overview: 'Unable to fetch movie details due to network connectivity issues. Streaming functionality is still available.',
        poster_path: null,
        backdrop_path: null,
        videos: { results: [] },
        error: 'Network connectivity issue'
      });
    }
  });
  

app.get('/api/providers', async (req, res) => {
    const { type } = req.query;
    
    try {
      if (!API_KEY) {
        return res.status(503).json({ 
          message: 'API key is required. Please configure TMDb API key in environment variables.' 
        });
      }
      
      const url = `https://api.themoviedb.org/3/watch/providers/${type}?api_key=${API_KEY}&language=es-ES&watch_region=US`;
      const response = await fetch(url);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching providers:", error);
      res.status(500).json({ message: "Error fetching providers" });
    }
  });  

 
  app.get('/api/:type/:id/watch/providers', async (req, res) => {
    const { type, id } = req.params;
    
    try {
      if (!API_KEY) {
        return res.status(503).json({ 
          message: 'API key is required. Please configure TMDb API key in environment variables.' 
        });
      }
      
      const url = `https://api.themoviedb.org/3/${type}/${id}/watch/providers?api_key=${API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Error fetching providers:', error);
      res.status(500).json({ message: 'Error fetching providers' });
    }
  });


app.get('/api/torrents', async (req, res) => {
    const { movieTitle } = req.query;
  
 
    if (!movieTitle) {
      return res.status(400).json({ message: 'Movie title is required' });
    }

 
    const normalizedTitle = movieTitle
      .replace(/'/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  
    console.log(`🎬 Movie torrent search request: ${movieTitle}`);
    if (movieTitle !== normalizedTitle) {
      console.log(`🔧 Normalized search title: ${normalizedTitle}`);
    }
  
    try {
 
      const torrentsUrl = `https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(normalizedTitle)}`;
      
      let ytsMovies = [];
      let torrentSearchMovies = [];
      
 
      try {
        console.log(`🔍 Searching YTS for: ${normalizedTitle}`);
        const response = await fetch(torrentsUrl);
        const data = await response.json();
        
 
        if (data?.data?.movies?.length > 0) {
          console.log(`✅ Found ${data.data.movies.length} movies from YTS`);
          ytsMovies = data.data.movies;
          console.log(`📝 YTS results:`, ytsMovies.map(m => ({ title: m.title, torrents: m.torrents?.length || 0 })));
        } else {
          console.log(`❌ No results from YTS for: ${normalizedTitle}`);
        }
      } catch (ytsError) {
        console.log(`⚠️  YTS search failed: ${ytsError.message}`);
      }
      
 
      if (hasActiveProviders) {
        console.log(`🔄 Trying TorrentSearchApi for movie: ${normalizedTitle}`);
        
        try {
 
          const searchResults = await torrentSearch.search(normalizedTitle, 'All', 20);
          console.log(`📊 Found ${searchResults.length} raw results from TorrentSearchApi`);
          
          if (searchResults.length > 0) {
            console.log(`📝 TorrentSearchApi raw results:`, searchResults.slice(0, 3).map(r => ({ 
              title: r.title, 
              provider: r.provider, 
              seeds: r.seeds,
              size: r.size 
            })));
            
 
            torrentSearchMovies = await processMovieTorrentResults(searchResults, movieTitle);
            console.log(`✅ Processed ${torrentSearchMovies.length} movies from TorrentSearchApi`);
            console.log(`📝 Processed TorrentSearchApi results:`, torrentSearchMovies.map(m => ({ 
              id: m.id, 
              title: m.title, 
              torrents: m.torrents?.length || 0,
              torrentDetails: m.torrents?.map(t => ({ quality: t.quality, seeds: t.seeds, size: t.size }))
            })));
          }
        } catch (torrentSearchError) {
          console.log(`⚠️  TorrentSearchApi failed: ${torrentSearchError.message}`);
        }
      }
      
 
      let movieTorrents = [...ytsMovies, ...torrentSearchMovies];
      
 
      if (movieTorrents.length === 0) {
        console.log(`🎭 No real movie torrents found, using mock data for: ${movieTitle}`);
        console.log(`🚧 Real torrent search failed - likely due to network/firewall restrictions`);
        movieTorrents = generateMockTorrents(movieTitle, 'movie');
        
 
      }
      
      console.log(`📤 Final movie torrents count: ${movieTorrents.length}`);
      console.log(`📝 Final results summary:`, movieTorrents.map(m => ({ 
        id: m.id, 
        title: m.title, 
        torrents: m.torrents?.length || 0,
        source: m.torrents?.[0]?.url ? 'TorrentSearchApi' : 'YTS'
      })));
      res.json(movieTorrents);
      
    } catch (error) {
      console.error('❌ Error fetching movie torrents:', error);
      
 
      console.log(`🎭 Error fallback: generating mock data for ${movieTitle}`);
      console.log(`🚧 Search error: ${error.message} - Using demo data`);
      const mockTorrents = generateMockTorrents(movieTitle, 'movie');
 
      
      res.json(mockTorrents);
    }
  });


async function processMovieTorrentResults(searchResults, movieTitle) {
  const movieTorrents = [];
  
  try {
    console.log(`🔧 Processing ${searchResults.length} search results for: ${movieTitle}`);
    
    for (let i = 0; i < Math.min(searchResults.length, 10); i++) {
      const torrent = searchResults[i];
      
      if (!torrent) {
        console.log(`⚠️  Skipping null torrent at index ${i}`);
        continue;
      }
      
      console.log(`🔍 Processing torrent ${i + 1}: ${torrent.title} (Provider: ${torrent.provider})`);
      
      try {
 
        console.log(`🧲 Getting magnet for: ${torrent.title}`);
        const magnetLink = await torrentSearch.getMagnet(torrent);
        
        if (!magnetLink) {
          console.log(`❌ No magnet link obtained for: ${torrent.title}`);
          continue;
        }
        
        console.log(`✅ Got magnet link for: ${torrent.title}`);
        
 
        const normalizedTorrent = {
          id: i + 1,
          title: torrent.title || torrent.name || 'Unknown',
          year: new Date().getFullYear(),
          imdb_code: '',
          torrents: [{
            url: magnetLink,
            hash: magnetLink ? magnetLink.match(/xt=urn:btih:([^&]+)/i)?.[1] : '',
            quality: extractQualityFromTitle(torrent.title || torrent.name),
            type: 'web',
            seeds: torrent.seeds || torrent.seeders || 0,
            peers: torrent.peers || torrent.leechers || 0,
            size: torrent.size || 'Unknown',
            size_bytes: 0
          }]
        };
        
        console.log(`📦 Normalized torrent:`, {
          id: normalizedTorrent.id,
          title: normalizedTorrent.title,
          quality: normalizedTorrent.torrents[0].quality,
          seeds: normalizedTorrent.torrents[0].seeds,
          hasHash: !!normalizedTorrent.torrents[0].hash
        });
        
        movieTorrents.push(normalizedTorrent);
        
      } catch (magnetError) {
        console.log(`⚠️  Could not get magnet for torrent ${i}: ${magnetError.message}`);
      }
    }
    
    console.log(`✅ Successfully processed ${movieTorrents.length} out of ${Math.min(searchResults.length, 10)} movie torrents`);
    return movieTorrents;
    
  } catch (error) {
    console.error('❌ Error processing movie torrent results:', error);
    return [];
  }
}


app.get('/api/tv/details/:tvId', async (req, res) => {
  const { tvId } = req.params;
  
  if (!tvId) {
    return res.status(400).json({ message: 'TV ID is required' });
  }
  
  try {
    if (!API_KEY) {
      return res.status(503).json({
        id: tvId,
        name: 'TV Series Details Unavailable',
        overview: 'API key is required. Please configure TMDb API key in environment variables.',
        poster_path: null,
        backdrop_path: null,
        videos: { results: [] },
        seasons: [],
        number_of_seasons: 0,
        status: 'Unknown',
        error: 'API key required'
      });
    }
    
    const url = `https://api.themoviedb.org/3/tv/${tvId}?api_key=${API_KEY}&language=en&append_to_response=videos,seasons`;
    
    const response = await fetch(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'ATV-App/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch TV details from TMDb: ${response.statusText}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching TV details:', error);
    res.status(200).json({
      id: tvId,
      name: 'TV Series Details Unavailable',
      overview: 'Unable to fetch TV series details due to network connectivity issues.',
      poster_path: null,
      backdrop_path: null,
      videos: { results: [] },
      seasons: [],
      number_of_seasons: 0,
      status: 'Unknown',
      error: 'Network connectivity issue'
    });
  }
});




app.get('/api/tv-torrents', async (req, res) => {
  const { tvTitle, season, episode } = req.query;
  
 
  if (!tvTitle) {
    return res.status(400).json({ message: 'TV title is required' });
  }
  
  try {
    console.log(`TV torrent search request: ${tvTitle} S${season}E${episode}`);
    
 
    const torrents = await searchRealTVTorrents(tvTitle, season, episode);
    
    if (torrents.length > 0) {
      console.log(`Returning ${torrents.length} TV torrents`);
      res.json(torrents);
    } else {
      console.log('No torrents found for this TV episode');
      res.status(404).json({ message: 'No torrents found for this TV episode.' });
    }
    
  } catch (error) {
    console.error('Error fetching TV torrents:', error);
    res.status(500).json({ message: 'Error fetching TV torrents' });
  }
});


app.post('/api/tv-torrents/search', async (req, res) => {
  const { showId, seasonNumber, episodeNumber } = req.body;
  
 
  if (!showId || !seasonNumber || !episodeNumber) {
    return res.status(400).json({ 
      message: 'showId, seasonNumber, and episodeNumber are required',
      example: {
        showId: 1399,
        seasonNumber: 7,
        episodeNumber: 7
      }
    });
  }
  
  try {
    console.log(`TV torrent search by ID: ${showId} S${seasonNumber}E${episodeNumber}`);
    
 
    const torrents = await searchTVTorrentsById(showId, seasonNumber, episodeNumber);
    
    if (torrents.length > 0) {
      console.log(`Returning ${torrents.length} TV torrents for TMDb ID ${showId}`);
      res.json(torrents);
    } else {
      console.log(`No torrents found for TMDb ID ${showId} S${seasonNumber}E${episodeNumber}`);
      res.status(404).json({ message: 'No torrents found for this TV episode.' });
    }
    
  } catch (error) {
    console.error('Error searching TV torrents by ID:', error);
    res.status(500).json({ message: 'Error searching TV torrents' });
  }
});


app.post('/api/search', async (req, res) => {
  const { showId, seasonNumber, episodeNumber } = req.body;
  
 
  if (!showId || !seasonNumber || !episodeNumber) {
    return res.status(400).json({ 
      message: 'showId, seasonNumber, and episodeNumber are required',
      example: {
        showId: 1399,
        seasonNumber: 7,
        episodeNumber: 7
      }
    });
  }
  
  try {
    console.log(`TV torrent search (tv-search compatible): ${showId} S${seasonNumber}E${episodeNumber}`);
    
 
    const torrents = await searchTVTorrentsById(showId, seasonNumber, episodeNumber);
    
    if (torrents.length > 0) {
      console.log(`Returning ${torrents.length} TV torrents for TMDb ID ${showId}`);
      res.json(torrents);
    } else {
      console.log(`No torrents found for TMDb ID ${showId} S${seasonNumber}E${episodeNumber}`);
      res.status(404).json({ message: 'No torrents found for this TV episode.' });
    }
    
  } catch (error) {
    console.error('Error searching TV torrents by ID:', error);
    res.status(500).json({ message: 'Error searching TV torrents' });
  }
});


async function searchRealTVTorrents(tvTitle, season, episode) {
  try {
    console.log(`🔍 Searching real TV torrents for: ${tvTitle} S${season}E${episode}`);
    
 
    const activeProviders = torrentSearch.getActiveProviders();
    if (activeProviders.length === 0) {
      console.log('⚠️  No active torrent providers, using mock data');
      return generateMockTorrents(tvTitle, 'tv', season, episode);
    }
    
 
    let query = tvTitle;
    if (season && episode) {
      query += ` S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}`;
    } else if (season) {
      query += ` S${season.toString().padStart(2, '0')}`;
    }
    
    console.log(`🎯 Torrent search query: ${query}`);
    
    let searchResults = [];
    
    try {
 
      console.log(`🎯 Attempting real torrent search: ${query}`);
      
      const searchPromise = torrentSearch.search(query, 'TV', 50);
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve([]), 10000);
      });
      
      searchResults = await Promise.race([searchPromise, timeoutPromise]);
      
      if (searchResults && searchResults.length > 0) {
        console.log(`📊 Found ${searchResults.length} real torrents from providers`);
        return await processTorrentResults(searchResults, tvTitle, season, episode);
      } else {
        console.log(`📊 No real torrents found`);
      }
    } catch (searchError) {
      console.log(`❌ Error in torrent search: ${searchError.message}`);
      searchResults = [];
    }
    
    if (!searchResults || searchResults.length === 0) {
      console.log('🔄 No real torrents found, trying alternative search...');
      
 
      const simpleQuery = tvTitle.replace(/[:\-&]/g, '').trim();
      const altQuery = season && episode ? 
        `${simpleQuery} S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}` :
        `${simpleQuery} S${season.toString().padStart(2, '0')}`;
      
      console.log(`🔄 Trying alternative query: ${altQuery}`);
      
      try {
        const altResults = await torrentSearch.search(altQuery, 'TV', 50);
        console.log(`📊 Found ${altResults.length} results with alternative query`);
        searchResults = altResults;
      } catch (altError) {
        console.log(`❌ Alternative search also failed: ${altError.message}`);
        searchResults = [];
      }
    }
    
    if (!searchResults || searchResults.length === 0) {
      console.log('🎭 No real torrents found, falling back to mock data');
      return generateMockTorrents(tvTitle, 'tv', season, episode);
    }
    
    console.log(`✅ Processing ${searchResults.length} real torrent results`);
    return await processTorrentResults(searchResults, tvTitle, season, episode);
    
  } catch (error) {
    console.error('❌ Error searching real TV torrents:', error);
    console.log('🎭 Falling back to mock data due to error');
    return generateMockTorrents(tvTitle, 'tv', season, episode);
  }
}


function isTorrentRelevant(torrent, requestedTitle, season = null, episode = null) {
  if (!torrent || !(torrent.title || torrent.name)) {
    return false;
  }

  const torrentTitle = torrent.title || torrent.name;
  
 
  const normalizeString = (str) => {
    return str.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normalizedRequest = normalizeString(requestedTitle);
  const normalizedTorrentTitle = normalizeString(torrentTitle);

  const requestWords = normalizedRequest.split(' ').filter(word => word.length > 2);
  
 
  const calculateMatchScore = (text, requestWords) => {
    const textWords = text.split(' ').filter(word => word.length > 2);
    
 
    if (text.includes(normalizedRequest)) {
      const position = text.indexOf(normalizedRequest);
 
      if (position === 0 || position <= 5) {
        return 1.0;
      }
 
      const wordsBeforeMatch = text.substring(0, position).split(' ').filter(w => w.length > 2).length;
      if (wordsBeforeMatch > 2 || text.split(' ').length > requestWords.length * 2.5) {
        return 0.2;
      }
      return 0.8;
    }
    
 
    let matchedWords = 0;
    let exactMatches = 0;
    let sequentialMatches = 0;
    
 
    for (let i = 0; i <= textWords.length - requestWords.length; i++) {
      let consecutive = 0;
      for (let j = 0; j < requestWords.length; j++) {
        if (i + j < textWords.length && textWords[i + j] === requestWords[j]) {
          consecutive++;
        } else {
          break;
        }
      }
      sequentialMatches = Math.max(sequentialMatches, consecutive);
    }
    
 
    requestWords.forEach(requestWord => {
      if (textWords.includes(requestWord)) {
        exactMatches++;
        matchedWords++;
      } else if (textWords.some(textWord => 
        textWord.includes(requestWord) || requestWord.includes(textWord)
      )) {
        matchedWords += 0.5;
      }
    });
    
 
    const sequentialBonus = sequentialMatches === requestWords.length ? 0.4 : 
                           sequentialMatches > 0 ? sequentialMatches / requestWords.length * 0.2 : 0;
    
 
    const exactMatchBonus = exactMatches === requestWords.length ? 0.3 : 0;
    
    const baseScore = requestWords.length > 0 ? matchedWords / requestWords.length : 0;
    
    return Math.min(1.0, baseScore + sequentialBonus + exactMatchBonus);
  };

 
  const titleScore = calculateMatchScore(normalizedTorrentTitle, requestWords);
  
 
  if (season !== null) {
    const seasonPattern = new RegExp(`s0?${season}(?![0-9])|season\\s*0?${season}(?![0-9])`, 'i');
    const hasSeasonMatch = seasonPattern.test(torrentTitle);
    
    if (episode !== null) {
      const episodePattern = new RegExp(`e0?${episode}(?![0-9])|episode\\s*0?${episode}(?![0-9])`, 'i');
      const hasEpisodeMatch = episodePattern.test(torrentTitle);
      
 
 
      return hasSeasonMatch && hasEpisodeMatch && titleScore >= 0.5;
    } else {
 
      return hasSeasonMatch && titleScore >= 0.5;
    }
  }
  
 
 
  return titleScore >= 0.7;
}


async function processTorrentResults(searchResults, tvTitle, season, episode) {
  try {
 
    console.log(`🔍 Filtering ${searchResults.length} torrents for relevance to "${tvTitle}"`);
    const relevantTorrents = searchResults.filter(torrent => 
      isTorrentRelevant(torrent, tvTitle, season, episode)
    );
    
    if (relevantTorrents.length === 0) {
      console.log(`⚠️  No relevant torrents found for "${tvTitle}" after filtering`);
      return [];
    }
    
    console.log(`✅ Found ${relevantTorrents.length} relevant torrents out of ${searchResults.length} total`);
    
 
    const torrents = [];
    const maxResults = Math.min(relevantTorrents.length, 20);
    
    console.log(`🔄 Processing ${maxResults} torrent results...`);
    
    for (let i = 0; i < maxResults; i++) {
      const torrent = relevantTorrents[i];
      
      if (!torrent) continue;
      
      try {
        let magnetLink = null;
        
 
        try {
          magnetLink = await torrentSearch.getMagnet(torrent);
          console.log(`✅ Got magnet for torrent ${i + 1}/${maxResults}`);
        } catch (magnetError) {
          console.log(`⚠️  Could not get magnet for torrent ${i + 1}: ${magnetError.message}`);
 
        }
        
 
        const normalizedTorrent = {
          title: torrent.title || torrent.name || 'Unknown',
          size: torrent.size || 'Unknown',
          seeds: torrent.seeds || torrent.seeders || Math.floor(Math.random() * 50) + 10,
          peers: torrent.peers || torrent.leechers || Math.floor(Math.random() * 20) + 5,
          leeches: torrent.peers || torrent.leechers || Math.floor(Math.random() * 20) + 5,
          provider: torrent.provider || 'Unknown',
          desc: torrent.desc || torrent.link || '',
          magnet: magnetLink || torrent.magnet,
          quality: extractQualityFromTitle(torrent.title || torrent.name),
          type: 'tv',
          season: season,
          episode: episode,
 
          hash: magnetLink ? magnetLink.match(/xt=urn:btih:([^&]+)/i)?.[1] : (torrent.hash || undefined),
 
          isDemo: torrent.isDemo || false,
          demoMessage: torrent.demoMessage || undefined
        };
        
        torrents.push(normalizedTorrent);
        
      } catch (itemError) {
        console.error(`❌ Error processing torrent item ${i}:`, itemError.message);
        
 
        torrents.push({
          title: torrent.title || torrent.name || 'Unknown',
          size: torrent.size || 'Unknown',
          seeds: Math.floor(Math.random() * 50) + 10,
          peers: Math.floor(Math.random() * 20) + 5,
          leeches: Math.floor(Math.random() * 20) + 5,
          provider: torrent.provider || 'Unknown',
          desc: torrent.desc || torrent.link || '',
          magnet: torrent.magnet || null,
          quality: extractQualityFromTitle(torrent.title || torrent.name),
          type: 'tv',
          season: season,
          episode: episode,
          error: 'Could not retrieve magnet link',
 
          isDemo: torrent.isDemo || false,
          demoMessage: torrent.demoMessage || undefined
        });
      }
    }
    
 
    torrents.sort((a, b) => (b.seeds || 0) - (a.seeds || 0));
    
    console.log(`✅ Successfully processed ${torrents.length} TV torrents`);
    return torrents;
    
  } catch (error) {
    console.error('❌ Error processing torrent results:', error);
    console.log('🎭 Fallback to mock data due to processing error');
    return generateMockTorrents(tvTitle, 'tv', season, episode);
  }
}


function findTorrentByHash(hashOrMagnet) {
  try {
 
    let targetHash = hashOrMagnet;
    if (hashOrMagnet.includes('magnet:')) {
      const match = hashOrMagnet.match(/xt=urn:btih:([^&]+)/i);
      if (match) {
        targetHash = match[1];
      }
    }
    
    targetHash = targetHash.toLowerCase();
    
 
    for (const torrent of client.torrents) {
      if (torrent.infoHash && torrent.infoHash.toLowerCase() === targetHash) {
        return torrent;
      }
    }
    
 
    const fallbackTorrent = client.get(hashOrMagnet);
    if (fallbackTorrent && fallbackTorrent.infoHash && 
        fallbackTorrent.infoHash.toLowerCase() === targetHash) {
      return fallbackTorrent;
    }
    
    return null;
  } catch (error) {
    console.log('Error in findTorrentByHash:', error.message);
    return null;
  }
}


function isTorrentReady(torrent) {
  if (!torrent) {
    console.log(`🔍 isTorrentReady: No torrent provided`);
    return false;
  }
  
  if (torrent.destroyed) {
    console.log(`🔍 isTorrentReady: Torrent is destroyed`);
    return false;
  }
  
 
  if (!torrent.infoHash || !torrent.name || torrent.name === 'Unknown') {
    console.log(`🔍 isTorrentReady: Missing basic metadata`, {
      hasInfoHash: !!torrent.infoHash,
      name: torrent.name
    });
    return false;
  }
  
 
  if (!torrent.files || !Array.isArray(torrent.files) || torrent.files.length === 0) {
    console.log(`🔍 isTorrentReady: No valid files`, {
      hasFiles: !!torrent.files,
      isArray: Array.isArray(torrent.files),
      filesLength: torrent.files ? torrent.files.length : 'N/A'
    });
    return false;
  }
  
 
  const validFiles = torrent.files.filter(file => file && file.name && file.name.trim() !== '');
  if (validFiles.length === 0) {
    console.log(`🔍 isTorrentReady: No files with valid names`);
    return false;
  }
  
  console.log(`✅ Torrent ready check PASSED: ${torrent.name}, files: ${torrent.files.length}, valid files: ${validFiles.length}`);
  return true;
}


function isTorrentCorrupted(torrent) {
  if (!torrent) {
    console.log('🔍 Torrent is null/undefined');
    return true;
  }
  
 
  if (torrent.destroyed) {
    console.log(`🔍 Torrent is destroyed: ${torrent.name || 'Unknown'}`);
    return true;
  }
  
 
  if (!torrent.infoHash || !torrent.name || torrent.name === 'Unknown') {
    console.log(`🔍 Torrent missing basic metadata:`, {
      name: torrent.name || 'Missing',
      hasInfoHash: !!torrent.infoHash,
      hasFiles: !!(torrent.files && torrent.files.length > 0)
    });
    return true;
  }
  
 
  if (!torrent.files || torrent.files.length === 0) {
    console.log(`🔍 Torrent has no files: ${torrent.name}`);
    return true;
  }
  
 
  if (isNaN(torrent.progress)) {
    console.log(`🔍 Torrent has invalid progress: ${torrent.name}, progress=${torrent.progress}`);
    return true;
  }
  
 
  if (torrent.numPeers === undefined) {
    console.log(`🔍 Torrent has undefined numPeers: ${torrent.name}`);
    return true;
  }
  
  return false;
}


function initialCleanup() {
  console.log('🧹 Performing initial cleanup of corrupted torrents...');
  const torrents = client.torrents;
  console.log(`📊 Found ${torrents.length} existing torrents`);
  
  let removedCount = 0;
  torrents.forEach((torrent, index) => {
    console.log(`🔍 Checking torrent ${index + 1}/${torrents.length}:`, {
      name: torrent.name || 'Unknown',
      infoHash: torrent.infoHash || 'Missing',
      hasFiles: !!(torrent.files && torrent.files.length > 0),
      progress: torrent.progress,
      numPeers: torrent.numPeers,
      destroyed: torrent.destroyed
    });
    
    if (isRealTorrent(torrent) && isTorrentCorrupted(torrent)) {
      console.log(`🗑️ Removing corrupted torrent: ${torrent.name || 'Unknown'} (${torrent.infoHash || 'No hash'})`);
      try {
        torrent.destroy();
        removedCount++;
      } catch (error) {
        console.error(`❌ Error destroying torrent:`, error.message);
      }
    }
  });
  
  console.log(`✅ Initial cleanup complete. Removed ${removedCount} corrupted torrents.`);
}


function periodicCleanup() {
  console.log('🔄 Running periodic torrent cleanup...');
  const torrents = client.torrents;
  let removedCount = 0;
  
  torrents.forEach(torrent => {
    if (isRealTorrent(torrent) && isTorrentCorrupted(torrent)) {
      console.log(`🗑️ Periodic cleanup removing corrupted torrent: ${torrent.name || 'Unknown'}`);
      try {
        torrent.destroy();
        removedCount++;
      } catch (error) {
        console.error(`❌ Error destroying torrent during periodic cleanup:`, error.message);
      }
    }
  });
  
  if (removedCount > 0) {
    console.log(`🧹 Periodic cleanup removed ${removedCount} corrupted torrents`);
  }
}


setTimeout(initialCleanup, 5000);


setInterval(periodicCleanup, 2 * 60 * 1000);


app.get('/api/cleanup', (req, res) => {
  console.log('🔧 Manual cleanup requested via API');
  periodicCleanup();
  initialCleanup();
  res.json({ message: 'Cleanup completed' });
});


function isRealTorrent(torrent) {
  return torrent && 
         typeof torrent === 'object' && 
         typeof torrent.destroy === 'function' &&
         torrent.hasOwnProperty('files') &&
         torrent.hasOwnProperty('infoHash');
}


function torrentExistsInClient(magnetURI) {
  try {
    const infoHash = magnetURI.match(/xt=urn:btih:([^&]+)/i)?.[1];
    if (!infoHash) return false;
    
    return client.torrents.some(torrent => 
      torrent.infoHash && 
      torrent.infoHash.toLowerCase() === infoHash.toLowerCase()
    );
  } catch (error) {
    console.log('Error checking if torrent exists in client:', error.message);
    return false;
  }
}


function safeRemoveTorrent(magnetURI, reason = 'cleanup') {
  const torrentHash = magnetURI.match(/xt=urn:btih:([^&]+)/i)?.[1] || 'unknown';
  
  try {
 
    if (torrentExistsInClient(magnetURI)) {
      console.log(`[${torrentHash}] Safely removing torrent (${reason})`);
      client.remove(magnetURI);
      return true;
    } else {
      console.log(`[${torrentHash}] Torrent not in client list, skipping removal (${reason})`);
      return false;
    }
  } catch (error) {
    console.log(`[${torrentHash}] Error during safe removal (${reason}):`, error.message);
    return false;
  }
}


app.delete('/api/torrent/stop/:infoHash', (req, res) => {
  const { infoHash } = req.params;
  
  if (!infoHash) {
    return res.status(400).json({ message: 'InfoHash is required' });
  }
  
  const torrentHash = infoHash.length > 20 ? infoHash : infoHash;
  console.log(`[${torrentHash}] Stop request received`);
  
  try {
 
    const torrent = findTorrentByHash(infoHash);
    
    if (!torrent) {
      console.log(`[${torrentHash}] Torrent not found, already cleaned up`);
      return res.json({ 
        message: 'Torrent not found (possibly already cleaned up)',
        success: true 
      });
    }
    
    console.log(`[${torrentHash}] Stopping torrent: ${torrent.name || 'Unknown'}`);
    
 
    if (torrent.pause && typeof torrent.pause === 'function') {
      torrent.pause();
    }
    
 
    if (torrent.wires && Array.isArray(torrent.wires)) {
      torrent.wires.forEach(wire => {
        try {
          if (wire && wire.destroy && typeof wire.destroy === 'function') {
            wire.destroy();
          }
        } catch (wireError) {
          console.log(`[${torrentHash}] Error destroying wire:`, wireError.message);
        }
      });
    }
    
 
    if (torrent.files && Array.isArray(torrent.files)) {
      torrent.files.forEach(file => {
        try {
          if (file && file._streams) {
            file._streams.forEach(stream => {
              if (stream && stream.destroy && typeof stream.destroy === 'function') {
                stream.destroy();
              }
            });
          }
        } catch (fileError) {
          console.log(`[${torrentHash}] Error cleaning file streams:`, fileError.message);
        }
      });
    }
    
 
    const destroyPromise = new Promise((resolve, reject) => {
      const destroyTimeout = setTimeout(() => {
        console.log(`[${torrentHash}] Destroy timeout, forcing removal`);
        resolve();
      }, 5000);
      
      torrent.destroy((err) => {
        clearTimeout(destroyTimeout);
        if (err) {
          console.log(`[${torrentHash}] Error during destroy:`, err.message);
          resolve();
        } else {
          console.log(`[${torrentHash}] Successfully destroyed`);
          resolve();
        }
      });
    });
    
    destroyPromise.then(() => {
 
      const stillExists = findTorrentByHash(infoHash);
      if (stillExists) {
        console.log(`[${torrentHash}] Torrent still exists after destroy, forcing removal`);
        try {
          client.remove(infoHash);
        } catch (removeError) {
          console.log(`[${torrentHash}] Error forcing removal:`, removeError.message);
        }
      }
      
 
      const subtitleKeysToDelete = [];
      for (const [key, value] of subtitleCache.entries()) {
        if (key.includes(infoHash.toLowerCase()) || key.includes(infoHash.toUpperCase())) {
          subtitleKeysToDelete.push(key);
        }
      }
      
      subtitleKeysToDelete.forEach(key => {
        subtitleCache.delete(key);
        console.log(`[${torrentHash}] Cleared subtitle cache for key: ${key}`);
      });
      
      console.log(`[${torrentHash}] Complete cleanup finished`);
      
      res.json({ 
        message: 'Torrent stopped and cleaned up successfully',
        success: true,
        subtitlesCleaned: subtitleKeysToDelete.length
      });
    });
    
  } catch (error) {
    console.error(`[${torrentHash}] Error stopping torrent:`, error);
    res.status(500).json({ 
      message: 'Error stopping torrent: ' + error.message,
      success: false
    });
  }
});


app.post('/api/torrent/stop/:infoHash', (req, res) => {
 
  console.log(`[${req.params.infoHash}] Stop request via POST (sendBeacon)`);
  
 
  const deleteReq = { 
    params: req.params,
    body: req.body
  };
  
 
  const mockRes = {
    status: (code) => ({ json: (data) => console.log(`POST response ${code}:`, data) }),
    json: (data) => console.log('POST response:', data)
  };
  
 
  setTimeout(() => {
    try {
      const { infoHash } = req.params;
      const torrent = findTorrentByHash(infoHash);
      
      if (torrent) {
        console.log(`[${infoHash}] Cleaning up torrent from sendBeacon: ${torrent.name || 'Unknown'}`);
        torrent.destroy((err) => {
          if (err) {
            console.log(`[${infoHash}] Error destroying from sendBeacon:`, err.message);
          } else {
            console.log(`[${infoHash}] Successfully destroyed from sendBeacon`);
          }
        });
      }
    } catch (error) {
      console.error(`Error in sendBeacon cleanup:`, error);
    }
  }, 100);
  
 
  res.status(200).json({ message: 'Cleanup initiated', success: true });
});


app.get('/api/torrent/stats/:infoHash', (req, res) => {
  const { infoHash } = req.params;
  
  try {
 
    const torrent = client.torrents.find(t => t.infoHash === infoHash);
    
    if (!torrent) {
      return res.status(404).json({ error: 'Torrent not found' });
    }
    
 
    if (!torrent.ready) {
      return res.status(503).json({ error: 'Torrent not ready' });
    }
    
 
    const stats = {
      infoHash: torrent.infoHash,
      name: torrent.name,
      length: torrent.length,
      downloaded: torrent.downloaded,
      uploaded: torrent.uploaded,
      downloadSpeed: torrent.downloadSpeed,
      uploadSpeed: torrent.uploadSpeed,
      progress: torrent.progress,
      ratio: torrent.ratio,
      numPeers: torrent.numPeers,
      timeRemaining: torrent.timeRemaining,
      ready: torrent.ready,
      paused: torrent.paused,
      done: torrent.done
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error getting torrent stats:', error);
    res.status(500).json({ error: 'Error getting torrent stats' });
  }
});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


async function searchTVTorrentsById(showId, seasonNumber, episodeNumber) {
  try {
    console.log(`🔍 Searching TV torrents by ID: ${showId} S${seasonNumber}E${episodeNumber}`);
    
    let seriesName = null;
    
 
    if (API_KEY && API_KEY !== 'demo_key_for_testing') {
      try {
        const seriesDetails = await getTVSeriesDetails(showId);
        if (seriesDetails) {
          console.log(`📺 TMDb series details - name: "${seriesDetails.name}", original_name: "${seriesDetails.original_name}"`);
          
 
          const containsNonLatinChars = (str) => {
            if (!str) return false;
 
            return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf\uac00-\ud7a3]/.test(str);
          };
          
 
          if (seriesDetails.original_name && !containsNonLatinChars(seriesDetails.original_name)) {
 
            seriesName = seriesDetails.original_name;
            console.log(`🌍 Using original_name (Latin chars): ${seriesName}`);
          } else if (seriesDetails.name && !containsNonLatinChars(seriesDetails.name)) {
 
            seriesName = seriesDetails.name;
            console.log(`🌍 Using name (Latin chars): ${seriesName}`);
          } else {
 
            seriesName = seriesDetails.original_name || seriesDetails.name;
            console.log(`⚠️  Using non-Latin name as fallback: ${seriesName}`);
          }
        }
        
        if (seriesName) {
          console.log(`✅ Found series name: ${seriesName}`);
        }
      } catch (tmdbError) {
        console.log(`⚠️  TMDb API error: ${tmdbError.message}`);
      }
    } else {
      console.log('⚠️  No TMDb API key available');
    }
    
 
    if (!seriesName) {
      seriesName = `TV Show ${showId}`;
      console.log(`🎯 Using generic fallback name: ${seriesName}`);
    }
    
 
    return await searchRealTVTorrents(seriesName, seasonNumber, episodeNumber);
    
  } catch (error) {
    console.error('❌ Error searching TV torrents by ID:', error);
    const fallbackName = `TV Show ${showId}`;
    return generateMockTorrents(fallbackName, 'tv', seasonNumber, episodeNumber);
  }
}


async function getTVEpisodeDetails(showId, seasonNumber, episodeNumber) {
  try {
    if (!API_KEY) {
      return null;
    }
    
    const url = `https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${API_KEY}&language=en`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`TMDb API error for episode: ${response.status} ${response.statusText}`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting episode details:', error);
    return null;
  }
}


async function getTVSeriesDetails(showId) {
  try {
    if (!API_KEY) {
      return null;
    }
    
    const url = `https://api.themoviedb.org/3/tv/${showId}?api_key=${API_KEY}&language=en`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`TMDb API error for series: ${response.status} ${response.statusText}`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting series details:', error);
    return null;
  }
}

app.post('/api/torrent/explore', (req, res) => {
  const { magnetURI } = req.body;
  
  if (!magnetURI) {
    return res.status(400).json({ message: 'Magnet URI is required' });
  }

  const torrentHash = magnetURI.match(/xt=urn:btih:([^&]+)/i)?.[1] || 'unknown';
  console.log(`[${torrentHash}] Exploring torrent request received`);

  try {
 
    const existingTorrent = findTorrentByHash(magnetURI);
    if (existingTorrent) {
      console.log(`[${torrentHash}] Found existing torrent: ${existingTorrent.name || 'Unknown'}`);
      console.log(`[${torrentHash}] Peers: ${existingTorrent.numPeers}, Progress: ${(existingTorrent.progress * 100).toFixed(1)}%`);
      
 
      if (isTorrentCorrupted(existingTorrent)) {
        console.log(`[${torrentHash}] Existing torrent is corrupted, removing and retrying`);
        safeRemoveTorrent(magnetURI, 'corrupted existing torrent');
 
      } else if (isTorrentReady(existingTorrent)) {
 
        console.log(`[${torrentHash}] Existing torrent has files: ${existingTorrent.files.length}`);
        return sendTorrentInfo(existingTorrent, res);
      } else if (existingTorrent.numPeers === 0) {
 
        console.log(`[${torrentHash}] Existing torrent has no peers, removing and retrying`);
        safeRemoveTorrent(magnetURI, 'no peers');
 
      } else {
 
        console.log(`[${torrentHash}] Existing torrent loading, waiting for files...`);
        let waitTime = 0;
        const maxWaitTime = 25000;
        const checkInterval = 3000;
        
        const waitForFiles = () => {
          if (res.headersSent) return;
          
          if (waitTime >= maxWaitTime) {
            console.log(`[${torrentHash}] Timeout waiting for existing torrent files`);
 
            safeRemoveTorrent(magnetURI, 'timeout');
            return res.status(503).json({ 
              message: 'This torrent is taking too long to load. It might be a slow or dead torrent. Please try a different quality or torrent.' 
            });
          }
          
 
          if (isTorrentCorrupted(existingTorrent)) {
            console.log(`[${torrentHash}] Torrent became corrupted during wait, removing`);
            safeRemoveTorrent(magnetURI, 'corrupted during wait');
            return res.status(503).json({ 
              message: 'Torrent became corrupted. Please try again.' 
            });
          }
          
          if (isTorrentReady(existingTorrent)) {
            console.log(`[${torrentHash}] Existing torrent files now available: ${existingTorrent.files.length}`);
            return sendTorrentInfo(existingTorrent, res);
          }
          
 
          if (existingTorrent.numPeers === 0 && waitTime > 10000) {
            console.log(`[${torrentHash}] Torrent lost all peers, giving up`);
            safeRemoveTorrent(magnetURI, 'lost all peers');
            return res.status(503).json({ 
              message: 'Torrent lost connection to peers. Please try a different torrent.' 
            });
          }
          
          waitTime += checkInterval;
          if (waitTime % 6000 === 0) {
            console.log(`[${torrentHash}] Still waiting for files... ${waitTime}ms/${maxWaitTime}ms, peers: ${existingTorrent.numPeers}`);
          }
          setTimeout(waitForFiles, checkInterval);
        };
        
        setTimeout(waitForFiles, checkInterval);
        return;
      }
    }

    console.log(`[${torrentHash}] Adding new torrent...`);
    
    let torrentAdded = false;
    
    client.add(magnetURI, { 
      destroyStoreOnDestroy: false,
      maxConns: 55,
      announce: additionalTrackers
    }, (torrent) => {
      if (torrentAdded) return;
      torrentAdded = true;
      
      console.log(`[${torrentHash}] Torrent added successfully: ${torrent.name || 'Unknown'}`);
      console.log(`[${torrentHash}] Initial peers: ${torrent.numPeers}`);
      
 
      torrent.on('metadata', () => {
        console.log(`[${torrentHash}] Metadata received for: ${torrent.name}`);
      });
      
      torrent.on('ready', () => {
        console.log(`[${torrentHash}] Torrent ready: ${torrent.name}, Files: ${torrent.files.length}`);
        if (!res.headersSent) {
          sendTorrentInfo(torrent, res);
        }
      });
      
      torrent.on('error', (err) => {
        console.error(`[${torrentHash}] Torrent error:`, err.message);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Torrent error: ' + err.message });
        }
      });
      
      torrent.on('wire', (wire) => {
        console.log(`[${torrentHash}] New peer connected, total peers: ${torrent.numPeers}`);
      });
      
 
      let waitTime = 0;
      const maxWaitTime = 40000;
      const checkInterval = 2000;
      
      const checkTorrentReady = () => {
        if (res.headersSent) return;
        
        if (waitTime >= maxWaitTime) {
          console.log(`[${torrentHash}] Timeout waiting for new torrent files`);
          return res.status(503).json({ 
            message: 'Torrent is taking too long to load. This might be a slow or dead torrent. Please try again later or choose another quality.' 
          });
        }
        
        if (isTorrentReady(torrent)) {
          console.log(`[${torrentHash}] New torrent files now available: ${torrent.files.length}`);
          return sendTorrentInfo(torrent, res);
        }
        
 
        if (torrent.numPeers === 0 && waitTime > 15000) {
          console.log(`[${torrentHash}] No peers found, torrent might be dead`);
          torrent.destroy();
          return res.status(503).json({ 
            message: 'No peers found for this torrent. It might be dead or very rare. Please try a different quality.' 
          });
        }
        
        waitTime += checkInterval;
        if (waitTime % 8000 === 0) {
          console.log(`[${torrentHash}] Waiting for torrent files... ${waitTime}ms/${maxWaitTime}ms, peers: ${torrent.numPeers}`);
        }
        setTimeout(checkTorrentReady, checkInterval);
      };

 
      if (isTorrentReady(torrent)) {
        console.log(`[${torrentHash}] Torrent immediately ready`);
        sendTorrentInfo(torrent, res);
      } else {
 
        setTimeout(checkTorrentReady, 3000);
      }
    });

 
    setTimeout(() => {
      if (!res.headersSent) {
        console.log(`[${torrentHash}] Global timeout reached for torrent`);
        res.status(408).json({ 
          message: 'Request timeout. The torrent is taking too long to respond. Please try again with a different torrent or quality.' 
        });
      }
    }, 45000);

  } catch (error) {
    console.error(`[${torrentHash}] Error exploring torrent:`, error);
    res.status(500).json({ message: 'Error exploring torrent: ' + error.message });
  }
});


function sendTorrentInfo(torrent, res) {
  try {
    console.log('sendTorrentInfo called, torrent:', {
      name: torrent.name,
      hasFiles: !!torrent.files,
      filesLength: torrent.files ? torrent.files.length : 'undefined',
      infoHash: torrent.infoHash || 'missing',
      numPeers: torrent.numPeers
    });

 
    if (isTorrentCorrupted(torrent)) {
      console.log('Torrent is corrupted, cannot send info');
      torrent.destroy();
      return res.status(503).json({ 
        message: 'Torrent is corrupted. Please try again with a different torrent.' 
      });
    }

 
    if (!torrent || !torrent.files || !Array.isArray(torrent.files) || torrent.files.length === 0) {
      console.log('Torrent files not ready, returning 503');
      return res.status(503).json({ 
        message: 'Torrent files not yet loaded, please try again in a moment' 
      });
    }

 
    const files = [...torrent.files];

 
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'];
    const videoFiles = files.filter(file => {
      if (!file || !file.name) return false;
      const ext = path.extname(file.name).toLowerCase();
      return videoExtensions.includes(ext);
    });

 
    const subtitleExtensions = ['.srt', '.vtt', '.ass', '.ssa', '.sub'];
    const subtitleFiles = files.filter(file => {
      if (!file || !file.name) return false;
      const ext = path.extname(file.name).toLowerCase();
      return subtitleExtensions.includes(ext);
    });

 
    let seeds = 0;
    let leechers = 0;
    
    if (torrent.wires && Array.isArray(torrent.wires)) {
      torrent.wires.forEach(wire => {
        try {
          if (wire && wire.peerChoking === false && wire.peerInterested === true) {
            seeds++;
          } else {
            leechers++;
          }
        } catch (wireError) {
 
        }
      });
    }

    const torrentInfo = {
      name: torrent.name || 'Unknown',
      infoHash: torrent.infoHash,
      magnetURI: torrent.magnetURI,
      length: torrent.length || 0,
      pieceLength: torrent.pieceLength || 0,
      lastPieceLength: torrent.lastPieceLength || 0,
      numPeers: torrent.numPeers || 0,
      seeds: seeds,
      leechers: leechers,
      progress: torrent.progress || 0,
      ratio: torrent.ratio || 0,
      downloadSpeed: torrent.downloadSpeed || 0,
      uploadSpeed: torrent.uploadSpeed || 0,
      downloaded: torrent.downloaded || 0,
      uploaded: torrent.uploaded || 0,
      timeRemaining: torrent.timeRemaining || 0,
      done: torrent.done || false,
      videoFiles: videoFiles.map((file, index) => ({
        index: files.indexOf(file),
        name: file.name,
        length: file.length,
        path: file.path
      })),
      subtitleFiles: subtitleFiles.map((file, index) => ({
        index: files.indexOf(file),
        name: file.name,
        length: file.length,
        path: file.path
      }))
    };

    console.log('Sending torrent info:', {
      name: torrentInfo.name,
      videoFiles: torrentInfo.videoFiles.length,
      subtitleFiles: torrentInfo.subtitleFiles.length,
      peers: torrentInfo.numPeers,
      seeds: torrentInfo.seeds,
      leechers: torrentInfo.leechers
    });

    res.json(torrentInfo);
  } catch (error) {
    console.error('Error in sendTorrentInfo:', error);
 
    try {
      if (torrent && torrent.destroy) {
        torrent.destroy();
      }
    } catch (destroyError) {
      console.error('Error destroying torrent:', destroyError);
    }
    res.status(500).json({ 
      message: 'Error processing torrent information: ' + error.message 
    });
  }
}


app.get('/api/torrent/stream/:infoHash/:fileIndex', (req, res) => {
  const { infoHash, fileIndex } = req.params;
  const range = req.headers.range;

  const torrent = findTorrentByHash(infoHash);
  
  if (!torrent) {
    return res.status(404).json({ message: 'Torrent not found' });
  }

 
  if (isTorrentCorrupted(torrent) || !isTorrentReady(torrent)) {
    console.log(`Stream request for corrupted/unready torrent: ${infoHash}`);
    return res.status(503).json({ message: 'Torrent is not ready for streaming. Please wait or try again.' });
  }

 
  if (!torrent.files || !Array.isArray(torrent.files) || torrent.files.length === 0) {
    console.log(`Stream request but torrent has no files: ${infoHash}`);
    return res.status(503).json({ message: 'Torrent files not available yet. Please wait and try again.' });
  }

  const file = torrent.files[parseInt(fileIndex)];
  
  if (!file) {
    return res.status(404).json({ message: 'File not found' });
  }

  const fileSize = file.length;
  
 
  const onClientDisconnect = () => {
    console.log(`[${infoHash}] Client disconnected from stream`);
 
 
  };

 
  res.on('close', onClientDisconnect);
  res.on('finish', () => {
    console.log(`[${infoHash}] Stream finished normally`);
  });

 
  const originalEnd = res.end;
  res.end = function(...args) {
    res.removeListener('close', onClientDisconnect);
    return originalEnd.apply(this, args);
  };
  
  if (range) {
 
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache' 
    });
    
    const stream = file.createReadStream({ start, end });
    
 
    stream.on('error', (error) => {
      console.log(`[${infoHash}] Stream error (range): ${error.message}`);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });
    
 
    res.on('close', () => {
      if (stream && !stream.destroyed) {
        stream.destroy();
        console.log(`[${infoHash}] Range stream destroyed due to client disconnect`);
      }
    });
    
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache' 
    });
    
    const stream = file.createReadStream();
    
 
    stream.on('error', (error) => {
      console.log(`[${infoHash}] Stream error (full): ${error.message}`);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });
    
 
    res.on('close', () => {
      if (stream && !stream.destroyed) {
        stream.destroy();
        console.log(`[${infoHash}] Full stream destroyed due to client disconnect`);
      }
    });
    
    stream.pipe(res);
  }
});


app.get('/api/torrent/subtitle/:infoHash/:fileIndex', (req, res) => {
  const { infoHash, fileIndex } = req.params;

  const torrent = findTorrentByHash(infoHash);
  
  if (!torrent) {
    return res.status(404).json({ message: 'Torrent not found' });
  }

 
  if (isTorrentCorrupted(torrent) || !isTorrentReady(torrent)) {
    console.log(`Subtitle request for corrupted/unready torrent: ${infoHash}`);
    return res.status(503).json({ message: 'Torrent is not ready for subtitle access. Please wait or try again.' });
  }

 
  if (!torrent.files || !Array.isArray(torrent.files) || torrent.files.length === 0) {
    console.log(`Subtitle request but torrent has no files: ${infoHash}`);
    return res.status(503).json({ message: 'Torrent files not available yet. Please wait and try again.' });
  }

  const file = torrent.files[parseInt(fileIndex)];
  
  if (!file) {
    return res.status(404).json({ message: 'Subtitle file not found' });
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const stream = file.createReadStream();
  
 
  stream.on('error', (error) => {
    console.log(`Subtitle stream error: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).end();
    }
  });
  
 
  res.on('close', () => {
    if (stream && !stream.destroyed) {
      stream.destroy();
    }
  });
  
  stream.pipe(res);
});


app.get('/api/torrent/progress/:infoHash', (req, res) => {
  const { infoHash } = req.params;
  
  const torrent = findTorrentByHash(infoHash);
  
  if (!torrent) {
    return res.status(404).json({ message: 'Torrent not found' });
  }

 
  if (isTorrentCorrupted(torrent)) {
    console.log(`Progress request for corrupted torrent: ${infoHash}`);
    return res.status(503).json({ message: 'Torrent is corrupted or not ready' });
  }
  
  const progressInfo = {
    infoHash: torrent.infoHash || infoHash,
    name: torrent.name || 'Unknown',
    progress: torrent.progress || 0,
    downloadSpeed: torrent.downloadSpeed || 0,
    uploadSpeed: torrent.uploadSpeed || 0,
    numPeers: torrent.numPeers || 0,
    downloaded: torrent.downloaded,
    uploaded: torrent.uploaded,
    length: torrent.length,
    ratio: torrent.ratio,
    timeRemaining: torrent.timeRemaining,
    done: torrent.done
  };
  
  res.json(progressInfo);
});


app.get('/api/subtitles/search', async (req, res) => {
  const { imdbId, movieTitle, language = 'es', season, episode } = req.query;
  
  try {
 
    if (!movieTitle) {
      return res.status(400).json({ message: 'movieTitle is required' });
    }
    
    console.log(`Searching subtitles for: ${movieTitle} (imdbId: ${imdbId || 'N/A'}) in ${language}${season ? ` S${season}` : ''}${episode ? `E${episode}` : ''}`);
    
    let subtitles = [];
    
 
    if (OPENSUBTITLES_API_KEY) {
      try {
        subtitles = await searchOpenSubtitles(movieTitle, imdbId, language, season, episode);
        console.log(`Found ${subtitles.length} real subtitles from OpenSubtitles`);
      } catch (error) {
        console.error('Error with OpenSubtitles API:', error);
        subtitles = [];
      }
    } else {
      console.log('No OpenSubtitles API key found, no subtitles available');
      subtitles = [];
    }
    
    console.log(`Returning ${subtitles.length} subtitles`);
    res.json(subtitles);
    
  } catch (error) {
    console.error('Error searching subtitles:', error);
    res.status(500).json({ message: 'Error searching subtitles' });
  }
});


async function searchOpenSubtitles(movieTitle, imdbId, language, season = null, episode = null) {
  const subtitles = [];
  
  try {
    console.log('Searching OpenSubtitles with API key...');
    
 
    let searchParams = `languages=${language}`;
    
    if (imdbId) {
 
      const cleanImdbId = imdbId.replace('tt', '');
      searchParams += `&imdb_id=${cleanImdbId}`;
      console.log(`Searching by IMDb ID: ${cleanImdbId}`);
    } else {
 
      searchParams += `&query=${encodeURIComponent(movieTitle)}`;
      console.log(`Searching by title: ${movieTitle}`);
    }
    
 
    if (season !== null) {
      searchParams += `&season_number=${season}`;
      if (episode !== null) {
        searchParams += `&episode_number=${episode}`;
      }
    }
    
 
    const searchUrl = `https://api.opensubtitles.com/api/v1/subtitles?${searchParams}`;
    console.log(`Making request to: ${searchUrl}`);
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Api-Key': OPENSUBTITLES_API_KEY,
        'User-Agent': 'ATV v1.0',
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`OpenSubtitles response status: ${searchResponse.status}`);
    
    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error(`OpenSubtitles API error: ${searchResponse.status} - ${errorText}`);
      throw new Error(`Search failed: ${searchResponse.status} - ${errorText}`);
    }
    
    const searchData = await searchResponse.json();
    console.log(`OpenSubtitles returned ${searchData.data ? searchData.data.length : 0} results`);
    
 
    if (searchData.data && Array.isArray(searchData.data)) {
      let filteredCount = 0;
      searchData.data.forEach((subtitle, index) => {
        try {
          if (subtitle.attributes && subtitle.attributes.files && subtitle.attributes.files.length > 0) {
            const file = subtitle.attributes.files[0];
            const attributes = subtitle.attributes;
            
 
            console.log(`Subtitle ${index}:`, {
              id: subtitle.id,
              fileId: file.file_id,
              fileName: file.file_name,
              url: attributes.url
            });
            
 
            const seasonNum = season !== null ? parseInt(season) : null;
            const episodeNum = episode !== null ? parseInt(episode) : null;
            
            if (!isSubtitleRelevant(subtitle, movieTitle, seasonNum, episodeNum)) {
              console.log(`Filtering out irrelevant subtitle: ${file.file_name}`);
              filteredCount++;
              return;
            }
            
 
 
            const downloadUrl = `/api/subtitles/opensubtitles-download/${subtitle.id}/${file.file_id}`;
            
            subtitles.push({
              id: subtitle.id,
              language: attributes.language,
              languageName: getLanguageName(attributes.language),
              filename: file.file_name,
              downloadUrl: downloadUrl,
              encoding: attributes.encoding || 'utf-8',
              downloads: attributes.download_count || 0,
              rating: attributes.rating || 0,
              isDemo: false
            });
          }
        } catch (itemError) {
          console.error(`Error processing subtitle item ${index}:`, itemError);
        }
      });
      
      console.log(`Filtered out ${filteredCount} irrelevant subtitles`);
    }
    
    console.log(`Successfully processed ${subtitles.length} subtitles`);
    
  } catch (error) {
    console.error('OpenSubtitles API error:', error);
    throw error;
  }
  
  return subtitles;
}


function getLanguageName(langCode) {
  const languageNames = {
    'es': 'Español',
    'en': 'English',
    'fr': 'Français',
    'de': 'Deutsch',
    'it': 'Italiano',
    'pt': 'Português',
    'ru': 'Русский',
    'ja': '日本語',
    'ko': '한국어',
    'zh': '中文'
  };
  
  return languageNames[langCode] || langCode.toUpperCase();
}


function isSubtitleRelevant(subtitle, requestedTitle, season = null, episode = null) {
  if (!subtitle || !subtitle.attributes || !subtitle.attributes.files || subtitle.attributes.files.length === 0) {
    return false;
  }

  const file = subtitle.attributes.files[0];
  const fileName = file.file_name || '';
  const movieName = subtitle.attributes.feature_details?.movie_name || '';
  const seriesName = subtitle.attributes.feature_details?.title || '';
  
 
  const normalizeString = (str) => {
    return str.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normalizedRequest = normalizeString(requestedTitle);
  const normalizedFileName = normalizeString(fileName);
  const normalizedMovieName = normalizeString(movieName);
  const normalizedSeriesName = normalizeString(seriesName);

  const requestWords = normalizedRequest.split(' ').filter(word => word.length > 2);
  
 
  const calculateMatchScore = (text, requestWords, isMainTitle = false) => {
    const textWords = text.split(' ').filter(word => word.length > 2);
    
 
    if (text.includes(normalizedRequest)) {
      const position = text.indexOf(normalizedRequest);
 
      if (isMainTitle && position === 0) {
        return 1.0;
      }
 
      if (position > 10 || text.split(' ').length > requestWords.length * 2) {
        return 0.3;
      }
      return 0.8;
    }
    
 
    let matchedWords = 0;
    let exactMatches = 0;
    let sequentialMatches = 0;
    
 
    for (let i = 0; i <= textWords.length - requestWords.length; i++) {
      let consecutive = 0;
      for (let j = 0; j < requestWords.length; j++) {
        if (i + j < textWords.length && textWords[i + j] === requestWords[j]) {
          consecutive++;
        } else {
          break;
        }
      }
      sequentialMatches = Math.max(sequentialMatches, consecutive);
    }
    
 
    requestWords.forEach(requestWord => {
      if (textWords.includes(requestWord)) {
        exactMatches++;
        matchedWords++;
      } else if (textWords.some(textWord => 
        textWord.includes(requestWord) || requestWord.includes(textWord)
      )) {
        matchedWords += 0.5;
      }
    });
    
 
    const sequentialBonus = sequentialMatches === requestWords.length ? 0.4 : 
                           sequentialMatches > 0 ? sequentialMatches / requestWords.length * 0.2 : 0;
    
 
    const exactMatchBonus = exactMatches === requestWords.length ? 0.3 : 0;
    
    const baseScore = requestWords.length > 0 ? matchedWords / requestWords.length : 0;
    
    return Math.min(1.0, baseScore + sequentialBonus + exactMatchBonus);
  };

 
 
  const fileNameScore = calculateMatchScore(normalizedFileName, requestWords, true);
  const movieNameScore = calculateMatchScore(normalizedMovieName, requestWords, true);
  const seriesNameScore = calculateMatchScore(normalizedSeriesName, requestWords, true);
  
 
  const weightedScore = (fileNameScore * 0.7) + (Math.max(movieNameScore, seriesNameScore) * 0.3);
  
 
  if (season !== null) {
    const seasonPattern = new RegExp(`s0?${season}(?![0-9])|season\\s*0?${season}(?![0-9])`, 'i');
    const hasSeasonMatch = seasonPattern.test(fileName);
    
    if (episode !== null) {
      const episodePattern = new RegExp(`e0?${episode}(?![0-9])|episode\\s*0?${episode}(?![0-9])`, 'i');
      const hasEpisodeMatch = episodePattern.test(fileName);
      
 
 
      return hasSeasonMatch && hasEpisodeMatch && weightedScore >= 0.4;
    } else {
 
      return hasSeasonMatch && weightedScore >= 0.4;
    }
  }
  
 
  if (fileNameScore >= 0.7) {
    return true;
  }
  
 
 
  return weightedScore >= 0.7;
}


function convertSrtToWebVtt(srtContent) {
 
  let webvtt = 'WEBVTT\n\n';
  
 
  const blocks = srtContent.trim().split(/\n\s*\n/);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length >= 3) {
 
      const timeLine = lines[1];
      const textLines = lines.slice(2);
      
 
      const webvttTime = timeLine.replace(/,/g, '.');
      
 
      webvtt += webvttTime + '\n';
      webvtt += textLines.join('\n') + '\n\n';
    }
  }
  
  return webvtt;
}


app.get('/api/subtitles/proxy', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ message: 'URL is required' });
  }

  console.log(`Proxying subtitle from: ${url}`);

  try {
 
    if (url.startsWith('/api/subtitles/opensubtitles-download/')) {
 
      console.log(`Redirecting OpenSubtitles URL to specific endpoint: ${url}`);
      return res.redirect(url);
    }

 
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return res.status(400).json({ 
        message: 'Invalid URL format. URL must start with http:// or https://',
        url: url
      });
    }

 
    const headers = {
      'User-Agent': 'ATV v1.0',
      'Accept': 'text/plain, text/vtt, application/x-subrip, */*',
      'Accept-Encoding': 'identity'
    };

 
    if (url.includes('opensubtitles.com') && OPENSUBTITLES_API_KEY) {
      headers['Api-Key'] = OPENSUBTITLES_API_KEY;
      console.log('Added OpenSubtitles API key to headers');
    }

 
    const response = await fetch(url, {
      headers: headers,
      timeout: 15000
    });
    
    console.log(`Response status: ${response.status} ${response.statusText}`);
    console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      console.error(`Failed to fetch subtitle: ${response.status} ${response.statusText}`);
      
      let errorMessage = 'Failed to fetch subtitle';
      if (response.status === 404) {
        errorMessage = 'Subtitle not found (404). The URL may be invalid or the subtitle may have been removed.';
      } else if (response.status === 403) {
        errorMessage = 'Access denied (403). The subtitle server does not allow access.';
      } else if (response.status === 500) {
        errorMessage = 'Subtitle server error (500). Try again later.';
      } else {
        errorMessage = `Subtitle server responded with ${response.status}: ${response.statusText}`;
      }
      
      return res.status(response.status).json({ 
        message: errorMessage,
        originalStatus: response.status,
        originalUrl: url
      });
    }
    
 
    const content = await response.text();
    console.log(`Subtitle content length: ${content.length} characters`);
    
 
    const isVTT = content.includes('WEBVTT') || url.includes('.vtt');
    const contentType = isVTT ? 'text/vtt; charset=utf-8' : 'text/plain; charset=utf-8';
    
 
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

 
    if (!content || content.length < 10) {
      console.error('Subtitle content is empty or too short');
      return res.status(404).json({ 
        message: 'Subtitle content not found or invalid',
        contentLength: content.length
      });
    }

 
    if (content.toLowerCase().includes('<html>') || content.toLowerCase().includes('<!doctype')) {
      console.error('Received HTML instead of subtitle content');
      return res.status(404).json({ 
        message: 'Received HTML page instead of subtitle file. The URL may be incorrect.',
        contentPreview: content.substring(0, 200)
      });
    }

 
    res.send(content);

  } catch (error) {
    console.error('Error proxying subtitle:', error);
    
    let errorMessage = 'Error proxying subtitle';
    if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
      errorMessage = 'Request timeout. The subtitle server is taking too long to respond.';
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMessage = 'Cannot connect to subtitle server. Check the URL or try again later.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({ 
      message: errorMessage,
      error: error.message,
      url: url
    });
  }
});




function formatSRTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const milliseconds = 0;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}


app.post('/api/subtitles/upload', upload.single('subtitle'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No subtitle file uploaded' });
  }

  const subtitleInfo = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    path: `/subtitles/${req.file.filename}`,
    size: req.file.size,
    language: req.body.language || 'unknown'
  };

  res.json(subtitleInfo);
});


app.options('/api/subtitles/opensubtitles-download/:subtitleId/:fileId', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(200).end();
});


app.get('/api/subtitles/debug/:subtitleId/:fileId', async (req, res) => {
  const { subtitleId, fileId } = req.params;
  
  console.log(`[SUBTITLE DEBUG] Request for: subtitleId=${subtitleId}, fileId=${fileId}`);
  
  if (!OPENSUBTITLES_API_KEY) {
    return res.status(500).json({ error: 'OpenSubtitles API key not configured' });
  }

  try {
 
    const downloadResponse = await fetch(`https://api.opensubtitles.com/api/v1/download`, {
      method: 'POST',
      headers: {
        'Api-Key': OPENSUBTITLES_API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'ATV v1.0'
      },
      body: JSON.stringify({
        file_id: parseInt(fileId),
        sub_format: 'srt'
      })
    });

    const downloadData = await downloadResponse.json();
    
    if (!downloadData.link) {
      return res.status(500).json({ error: 'No download link received' });
    }

 
    const subtitleResponse = await fetch(downloadData.link);
    const content = await subtitleResponse.text();
    
 
    res.json({
      subtitleId,
      fileId,
      downloadUrl: downloadData.link,
      contentLength: content.length,
      contentPreview: content.substring(0, 500),
      contentEndsPreview: content.substring(Math.max(0, content.length - 200)),
      hasContent: content.trim().length > 0,
      looksLikeSRT: /^\d+\s*\r?\n\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/m.test(content),
      lineEndings: {
        crlf: (content.match(/\r\n/g) || []).length,
        lf: (content.match(/(?<!\r)\n/g) || []).length,
        cr: (content.match(/\r(?!\n)/g) || []).length
      }
    });
    
  } catch (error) {
    console.error('[SUBTITLE DEBUG] Error:', error);
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/subtitles/opensubtitles-download/:subtitleId/:fileId', async (req, res) => {
  const { subtitleId, fileId } = req.params;
  
  console.log(`[SUBTITLE DOWNLOAD] Request received: subtitleId=${subtitleId}, fileId=${fileId}`);
  
  if (!subtitleId || !fileId) {
    console.log('[SUBTITLE DOWNLOAD] Missing parameters');
    return res.status(400).json({ message: 'Subtitle ID and File ID are required' });
  }

  if (!OPENSUBTITLES_API_KEY) {
    console.log('[SUBTITLE DOWNLOAD] No OpenSubtitles API key configured');
    return res.status(500).json({ message: 'OpenSubtitles API key not configured' });
  }

  try {
    console.log(`[SUBTITLE DOWNLOAD] Downloading OpenSubtitles subtitle: ${subtitleId}/${fileId}`);
    
 
    const downloadResponse = await fetch(`https://api.opensubtitles.com/api/v1/download`, {
      method: 'POST',
      headers: {
        'Api-Key': OPENSUBTITLES_API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'ATV v1.0'
      },
      body: JSON.stringify({
        file_id: parseInt(fileId),
        sub_format: 'srt'
      })
    });

    console.log(`[SUBTITLE DOWNLOAD] OpenSubtitles API response status: ${downloadResponse.status}`);

    if (!downloadResponse.ok) {
      const errorData = await downloadResponse.json().catch(() => ({}));
      console.error('[SUBTITLE DOWNLOAD] OpenSubtitles download API error:', errorData);
      throw new Error(`OpenSubtitles API error: ${downloadResponse.status} - ${errorData.message || downloadResponse.statusText}`);
    }

    const downloadData = await downloadResponse.json();
    
    if (!downloadData.link) {
      console.error('[SUBTITLE DOWNLOAD] No download link received from OpenSubtitles');
      throw new Error('No download link received from OpenSubtitles');
    }

    console.log('[SUBTITLE DOWNLOAD] OpenSubtitles download link obtained:', downloadData.link);

 
    const subtitleResponse = await fetch(downloadData.link, {
      headers: {
        'User-Agent': 'ATV v1.0'
      }
    });

    console.log('[SUBTITLE DOWNLOAD] Subtitle file response status:', subtitleResponse.status);

    if (!subtitleResponse.ok) {
      throw new Error(`Failed to download subtitle file: ${subtitleResponse.statusText}`);
    }

 
    const subtitleContent = await subtitleResponse.text();
    console.log('[SUBTITLE DOWNLOAD] Subtitle content length:', subtitleContent.length);

 
    if (!subtitleContent || subtitleContent.trim().length === 0) {
      throw new Error('Subtitle file is empty');
    }

 
    let cleanContent = subtitleContent;
    
 
    cleanContent = cleanContent.replace(/^\uFEFF/, '');
    
 
    cleanContent = cleanContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
 
    const srtPattern = /^\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/m;
    if (!srtPattern.test(cleanContent)) {
      console.log('[SUBTITLE DOWNLOAD] Warning: Content does not appear to be valid SRT format');
 
      cleanContent = cleanContent.trim();
      if (!cleanContent.endsWith('\n')) {
        cleanContent += '\n';
      }
    }

 
    if (!cleanContent.endsWith('\n\n')) {
      cleanContent += '\n';
    }

    console.log('[SUBTITLE DOWNLOAD] Content preview:', cleanContent.substring(0, 200));
    console.log('[SUBTITLE DOWNLOAD] Content ends with:', cleanContent.substring(Math.max(0, cleanContent.length - 50)));

 
    const webvttContent = convertSrtToWebVtt(cleanContent);
    console.log('[SUBTITLE DOWNLOAD] Converted to WebVTT, length:', webvttContent.length);

 
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length');
 
    res.setHeader('Content-Length', Buffer.byteLength(webvttContent, 'utf8'));
    res.setHeader('Cache-Control', 'public, max-age=3600');

    console.log('[SUBTITLE DOWNLOAD] Sending subtitle content to client');
    
 
    res.send(webvttContent);

  } catch (error) {
    console.error('[SUBTITLE DOWNLOAD] Error downloading OpenSubtitles subtitle:', error);
    
 
    let errorMessage = 'Error al descargar subtítulo';
    let statusCode = 500;
    
    if (error.message.includes('401') || error.message.includes('403')) {
      errorMessage = 'Error de autenticación con OpenSubtitles. Verifica la configuración de la API.';
      statusCode = 401;
    } else if (error.message.includes('404')) {
      errorMessage = 'Subtítulo no encontrado. Es posible que haya expirado o ya no esté disponible.';
      statusCode = 404;
    } else if (error.message.includes('429')) {
      errorMessage = 'Demasiadas solicitudes. Intenta nuevamente en unos minutos.';
      statusCode = 429;
    } else if (error.message.includes('download link')) {
      errorMessage = 'No se pudo obtener el enlace de descarga del subtítulo.';
      statusCode = 502;
    }
    
    res.status(statusCode).json({ 
      message: errorMessage,
      details: error.message 
    });
  }
});


app.get('/api/subtitles/download', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ message: 'Subtitle URL is required' });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch subtitle from external source: ${response.statusText}`);
    }
    
 
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');

 
    response.body.pipe(res);

  } catch (error) {
    console.error('Error proxying subtitle:', error);
    res.status(500).json({ message: 'Error proxying subtitle' });
  }
});




function extractQualityFromTitle(title) {
  if (!title) return 'Unknown';
  
  const titleUpper = title.toUpperCase();
  
 
  const qualityPatterns = [
    { pattern: /2160P|4K|UHD/i, quality: '4K' },
    { pattern: /1080P/i, quality: '1080p' },
    { pattern: /720P/i, quality: '720p' },
    { pattern: /480P/i, quality: '480p' },
    { pattern: /360P/i, quality: '360p' },
    { pattern: /BLURAY|BLU-RAY|BDRIP|BD/i, quality: 'BluRay' },
    { pattern: /WEBRIP|WEB-DL|WEB-RIP/i, quality: 'WEB-DL' },
    { pattern: /WEB(?!CAM)/i, quality: 'WEB' },
    { pattern: /HDTV/i, quality: 'HDTV' },
    { pattern: /DVDRIP|DVD-RIP/i, quality: 'DVDRip' },
    { pattern: /DVD/i, quality: 'DVD' },
    { pattern: /HDCAM|HD-CAM/i, quality: 'HD-CAM' },
    { pattern: /CAM/i, quality: 'CAM' },
    { pattern: /TS|TELESYNC/i, quality: 'TS' },
    { pattern: /TC|TELECINE/i, quality: 'TC' },
    { pattern: /HD(?!CAM|TV)/i, quality: 'HD' }
  ];
  
  for (const { pattern, quality } of qualityPatterns) {
    if (pattern.test(titleUpper)) {
      return quality;
    }
  }
  
 
  const resolutionMatch = title.match(/(\d{3,4})P/i);
  if (resolutionMatch) {
    return resolutionMatch[1] + 'p';
  }
  
  return 'SD';
}
