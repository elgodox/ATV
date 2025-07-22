// server.js
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
const API_KEY = process.env.API_KEY; // Cargar la API key desde el .env
const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN;
const OPENSUBTITLES_API_KEY = process.env.OPENSUBTITLES_API_KEY;

// Helper function to filter adult content based on adult filter setting
function filterAdultContent(results, adultFilter) {
  if (!results) return results;
  
  if (adultFilter === 'only') {
    // Show only adult content
    return results.filter(item => item.adult === true);
  } else if (adultFilter === 'false') {
    // Exclude adult content (already handled by API parameter, but just in case)
    return results.filter(item => item.adult !== true);
  }
  
  // For adultFilter === '' (include all), return all results
  return results;
}

// Debug: Verificar si la API_KEY se está cargando correctamente
console.log('🔑 API_KEY cargada:', API_KEY ? 'SÍ (longitud: ' + API_KEY.length + ')' : 'NO');
console.log('🔑 VIMEO_ACCESS_TOKEN cargado:', VIMEO_ACCESS_TOKEN ? 'SÍ' : 'NO');
console.log('🔑 OPENSUBTITLES_API_KEY cargado:', OPENSUBTITLES_API_KEY ? 'SÍ' : 'NO');

// Crear cliente de WebTorrent
const client = new WebTorrent();

// Crear cache de subtítulos
const subtitleCache = new Map();

// Configurar TorrentSearchApi
const torrentSearch = require('torrent-search-api');

// Función para configurar proveedores de torrent de forma segura
function setupTorrentProviders() {
  console.log('🔧 Configurando proveedores de torrents...');
  
  try {
    // Usar enablePublicProviders() como en la búsqueda manual exitosa
    torrentSearch.enablePublicProviders();
    console.log('✅ Habilitados todos los proveedores públicos');
    
    const activeProviders = torrentSearch.getActiveProviders();
    console.log(`🎯 Total proveedores activos: ${activeProviders.length}`);
    activeProviders.forEach(p => console.log(`   - ${p.name}`));
    
    return activeProviders.length > 0;
  } catch (error) {
    console.log(`❌ Error configurando proveedores públicos: ${error.message}`);
    
    // Fallback al método anterior si falla
    const availableProviders = torrentSearch.getProviders().map(p => p.name);
    console.log('📋 Proveedores disponibles:', availableProviders);
    
    // Lista de proveedores a habilitar (en orden de preferencia)
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
          console.log(`✅ Proveedor habilitado: ${provider}`);
          enabledCount++;
        } else {
          console.log(`⚠️  Proveedor no disponible: ${provider}`);
        }
      } catch (error) {
        console.log(`❌ Error habilitando ${provider}:`, error.message);
      }
    }
    
    const activeProviders = torrentSearch.getActiveProviders();
    console.log(`🎯 Total proveedores activos: ${activeProviders.length}`);
    activeProviders.forEach(p => console.log(`   - ${p.name}`));
    
    return enabledCount > 0;
  }
}

// API para verificar el estado de los proveedores de torrent
app.get('/api/torrent-status', async (req, res) => {
  try {
    const activeProviders = torrentSearch.getActiveProviders();
    const allProviders = torrentSearch.getProviders();
    
    // Test basic search functionality
    let searchWorking = false;
    let testError = null;
    
    try {
      console.log('🧪 Testing torrent search functionality...');
      const testResults = await Promise.race([
        torrentSearch.search('test', 'TV', 1),
        new Promise((resolve) => setTimeout(() => resolve([]), 5000))
      ]);
      searchWorking = true;
      console.log(`✅ Search test completed, found ${testResults ? testResults.length : 0} results`);
    } catch (error) {
      testError = error.message;
      console.log(`❌ Search test failed: ${error.message}`);
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
        knownSeriesCount: 30 // Known series in the mapping
      }
    };
    
    res.json(status);
    
  } catch (error) {
    console.error('❌ Error checking torrent status:', error);
    res.status(500).json({
      error: 'Error checking torrent status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Configurar proveedores
const hasActiveProviders = setupTorrentProviders();

// Mock torrent data para fallback cuando la búsqueda real falla
const mockTorrentData = {
  // Movies
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
  
  // TV Shows
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

// Función para generar datos mock personalizados basados en el título
function generateMockTorrents(title, type = 'movie', season = null, episode = null) {
  console.log(`🎭 Generando datos mock para: ${title} (${type})`);
  
  const baseTorrents = type === 'tv' ? mockTorrentData.tv : mockTorrentData.movies;
  const mockTorrents = [];
  
  // Generar variaciones de calidad
  const qualities = [
    { name: '1080p', size: type === 'tv' ? '550 MB' : '1.8 GB', seeds: 95, peers: 28 },
    { name: '720p', size: type === 'tv' ? '350 MB' : '1.2 GB', seeds: 67, peers: 19 },
    { name: '480p', size: type === 'tv' ? '250 MB' : '800 MB', seeds: 45, peers: 15 }
  ];
  
  qualities.forEach((quality, index) => {
    // Generar hash único para cada torrent
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
  
  console.log(`✅ Generados ${mockTorrents.length} torrents mock`);
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

// Configurar multer para subir subtítulos
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

// Middleware para parsear JSON
app.use(express.json());

// Servir archivos estáticos
app.use(express.static('public'));

// Servir archivos de subtítulos
app.use('/subtitles', express.static(path.join(__dirname, 'uploads', 'subtitles')));

// Ruta para obtener géneros
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
    console.error('Error fetching genres:', error);
    res.status(500).json({ message: 'Error fetching genres' });
  }
});

// Ruta para obtener géneros según el tipo de contenido (movie o tv)
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
    res.json(data.genres);  // Solo devolver la lista de géneros
  } catch (error) {
    console.error('Error fetching genres:', error);
    res.status(500).json({ message: 'Error fetching genres' });
  }
});


// Ruta para obtener películas o series según filtros
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
    
    // Filter out results without poster images
    if (data.results) {
      data.results = data.results.filter(item => item.poster_path);
      
      // Apply adult content filtering
      data.results = filterAdultContent(data.results, adultFilter);
      
      data.total_results = data.results.length;
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching titles:', error);
    // Return empty results instead of failing
    res.status(200).json({
      results: [],
      total_pages: 0,
      total_results: 0,
      error: 'Network connectivity issue - unable to fetch movie data'
    });
  }
});

// Nueva ruta para búsqueda optimizada que busca en movies y TV simultáneamente
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

    // Construir URLs de búsqueda basadas en filtros seleccionados
    let movieUrl = null;
    let tvUrl = null;
    
    // Determinar qué tipo de contenido buscar basado en filtros
    const searchMovies = !type || type === '' || type === 'movie';
    const searchTV = !type || type === '' || type === 'tv';
    
    // Construir parámetros de búsqueda
    const baseParams = `api_key=${API_KEY}&query=${encodeURIComponent(searchQuery)}&page=${page}&language=en`;
    const platformParam = platform && platform !== '' ? `&with_watch_providers=${platform}&watch_region=US` : '';
    const genreParam = genre && genre !== '' ? `&with_genres=${genre}` : '';
    const adultParam = adultFilter === 'false' ? '&include_adult=false' : '&include_adult=true';
    
    // Solo realizar búsquedas necesarias según filtros
    if (searchMovies) {
      movieUrl = `https://api.themoviedb.org/3/search/movie?${baseParams}${platformParam}${genreParam}${adultParam}`;
    }
    
    if (searchTV) {
      tvUrl = `https://api.themoviedb.org/3/search/tv?${baseParams}${platformParam}${genreParam}${adultParam}`;
    }
    
    // Realizar búsquedas en paralelo solo para tipos necesarios
    const requests = [];
    if (movieUrl) requests.push(fetch(movieUrl));
    if (tvUrl) requests.push(fetch(tvUrl));
    
    if (requests.length === 0) {
      throw new Error('No search type specified');
    }
    
    const responses = await Promise.all(requests);
    
    // Verificar respuestas
    for (const response of responses) {
      if (!response.ok) {
        throw new Error(`TMDb API error: ${response.statusText}`);
      }
    }
    
    const dataPromises = responses.map(response => response.json());
    const dataResults = await Promise.all(dataPromises);
    
    let movieData = { results: [], total_results: 0, total_pages: 0 };
    let tvData = { results: [], total_results: 0, total_pages: 0 };
    
    // Asignar datos según el orden de las consultas
    let dataIndex = 0;
    if (searchMovies) {
      movieData = dataResults[dataIndex++];
    }
    if (searchTV) {
      tvData = dataResults[dataIndex++];
    }
    
    // Filtrar resultados sin imágenes y aplicar filtro de contenido adulto
    const moviesWithType = (movieData.results || [])
      .filter(item => item.poster_path) // Solo mostrar resultados con imagen
      .map(item => ({
        ...item,
        content_type: 'movie'
      }));
    
    const tvWithType = (tvData.results || [])
      .filter(item => item.poster_path) // Solo mostrar resultados con imagen
      .map(item => ({
        ...item,
        content_type: 'tv'
      }));
    
    // Combinar resultados antes de aplicar el filtro de adultos
    let allResults = [...moviesWithType, ...tvWithType];
    
    // Aplicar filtro de contenido adulto
    allResults = filterAdultContent(allResults, adultFilter);
    
    // Ordenar por popularidad por defecto
    allResults.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    
    // Información adicional sobre filtros activos
    const activeFilters = {
      platform: platform && platform !== '' ? platform : null,
      genre: genre && genre !== '' ? genre : null,
      type: type && type !== '' ? type : null,
      adultFilter: adultFilter && adultFilter !== '' ? adultFilter : null
    };
    
    // Separar los resultados filtrados por tipo para contar correctamente
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


// Ruta para buscar tráiler en YouTube
app.get('/api/youtube-trailer', async (req, res) => {
  const title = req.query.title;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(title + ' trailer')}`;

  try {
    const response = await fetch(searchUrl);
    const data = await response.text();

    // Extraer el primer ID de video de los resultados
    const videoIdMatch = data.match(/"videoId":"(.*?)"/);
    if (videoIdMatch && videoIdMatch[1]) {
      return res.json({ videoId: videoIdMatch[1] }); // Devuelve el ID del video
    }

    // Si no se encuentra el tráiler
    return res.status(404).json({ error: 'Trailer not found' });
  } catch (error) {
    console.error('Error fetching YouTube trailer:', error);
    return res.status(500).json({ error: 'Error fetching YouTube trailer' });
  }
});

// Ruta para buscar tráiler en Vimeo
app.get('/api/vimeo-trailer', async (req, res) => {
  const title = req.query.title;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const searchUrl = `https://api.vimeo.com/videos?query=${encodeURIComponent(title + ' trailer')}&per_page=1`;

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${VIMEO_ACCESS_TOKEN}`
      }
    });
    const data = await response.json();

    if (data.data && data.data.length > 0) {
      const vimeoTrailerId = data.data[0].uri.split('/').pop();  // Extraer el ID del video
      return res.json({ videoId: vimeoTrailerId });
    }

    return res.status(404).json({ error: 'Trailer not found on Vimeo' });
  } catch (error) {
    console.error('Error fetching Vimeo trailer:', error);
    return res.status(500).json({ error: 'Error fetching Vimeo trailer' });
  }
});

// Define tus rutas de API después de configurar los archivos estáticos
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
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'ATV-App/1.0'
        }
      });
      
      // Verifica si la respuesta es correcta
      if (!response.ok) {
        throw new Error(`Failed to fetch data from TMDb: ${response.statusText}`);
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Error fetching movie details:', error);
      // Return a fallback response instead of failing completely
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
  
// Ruta para obtener proveedores
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

  // Ruta para obtener proveedor
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

// Ruta para obtener torrents desde YTS
app.get('/api/torrents', async (req, res) => {
    const { movieTitle } = req.query;
  
    // Verifica que movieTitle esté presente
    if (!movieTitle) {
      return res.status(400).json({ message: 'Movie title is required' });
    }

    // Normalizar el título para mejorar las búsquedas
    const normalizedTitle = movieTitle
      .replace(/'/g, '') // Remover apóstrofes
      .replace(/\s+/g, ' ') // Normalizar espacios múltiples
      .trim();
  
    console.log(`🎬 Movie torrent search request: ${movieTitle}`);
    if (movieTitle !== normalizedTitle) {
      console.log(`🔧 Normalized search title: ${normalizedTitle}`);
    }
  
    try {
      // Buscar en YTS primero
      const torrentsUrl = `https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(normalizedTitle)}`;
      
      let ytsMovies = [];
      let torrentSearchMovies = [];
      
      // Buscar en YTS
      try {
        console.log(`🔍 Searching YTS for: ${normalizedTitle}`);
        const response = await fetch(torrentsUrl);
        const data = await response.json();
        
        // Si la respuesta de YTS contiene películas, procesarlas
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
      
      // Siempre buscar también en TorrentSearchApi para obtener más resultados
      if (hasActiveProviders) {
        console.log(`🔄 Trying TorrentSearchApi for movie: ${normalizedTitle}`);
        
        try {
          // Usar 'All' en lugar de 'Movies' para obtener más resultados
          const searchResults = await torrentSearch.search(normalizedTitle, 'All', 20);
          console.log(`📊 Found ${searchResults.length} raw results from TorrentSearchApi`);
          
          if (searchResults.length > 0) {
            console.log(`📝 TorrentSearchApi raw results:`, searchResults.slice(0, 3).map(r => ({ 
              title: r.title, 
              provider: r.provider, 
              seeds: r.seeds,
              size: r.size 
            })));
            
            // Procesar resultados de TorrentSearchApi
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
      
      // Combinar resultados de ambas fuentes
      let movieTorrents = [...ytsMovies, ...torrentSearchMovies];
      
      // Si no se encontraron torrents reales, usar datos mock
      if (movieTorrents.length === 0) {
        console.log(`🎭 No real movie torrents found, using mock data for: ${movieTitle}`);
        console.log(`🚧 Real torrent search failed - likely due to network/firewall restrictions`);
        movieTorrents = generateMockTorrents(movieTitle, 'movie');
        
        // Mock data already includes isDemo and demoMessage from generateMockTorrents
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
      
      // En caso de error completo, devolver datos mock
      console.log(`🎭 Error fallback: generating mock data for ${movieTitle}`);
      console.log(`🚧 Search error: ${error.message} - Using demo data`);
      const mockTorrents = generateMockTorrents(movieTitle, 'movie');
      // Mock data already includes isDemo and demoMessage from generateMockTorrents
      
      res.json(mockTorrents);
    }
  });

// Función auxiliar para procesar resultados de torrents de películas
async function processMovieTorrentResults(searchResults, movieTitle) {
  const movieTorrents = [];
  
  try {
    console.log(`🔧 Processing ${searchResults.length} search results for: ${normalizedTitle}`);
    
    for (let i = 0; i < Math.min(searchResults.length, 10); i++) {
      const torrent = searchResults[i];
      
      if (!torrent) {
        console.log(`⚠️  Skipping null torrent at index ${i}`);
        continue;
      }
      
      console.log(`🔍 Processing torrent ${i + 1}: ${torrent.title} (Provider: ${torrent.provider})`);
      
      try {
        // Obtener el magnet link
        console.log(`🧲 Getting magnet for: ${torrent.title}`);
        const magnetLink = await torrentSearch.getMagnet(torrent);
        
        if (!magnetLink) {
          console.log(`❌ No magnet link obtained for: ${torrent.title}`);
          continue;
        }
        
        console.log(`✅ Got magnet link for: ${torrent.title}`);
        
        // Convertir al formato esperado por el frontend
        const normalizedTorrent = {
          id: i + 1,
          title: torrent.title || torrent.name || 'Unknown',
          year: new Date().getFullYear(), // Año por defecto
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

// Ruta para obtener detalles de una serie de TV
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
      timeout: 10000, // 10 second timeout
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



// Ruta para obtener torrents de series de TV
app.get('/api/tv-torrents', async (req, res) => {
  const { tvTitle, season, episode } = req.query;
  
  // Verifica que tvTitle esté presente
  if (!tvTitle) {
    return res.status(400).json({ message: 'TV title is required' });
  }
  
  try {
    console.log(`TV torrent search request: ${tvTitle} S${season}E${episode}`);
    
    // Usar la nueva función de búsqueda de torrents reales
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

// Nueva ruta para buscar torrents de TV usando TMDb ID (compatible con tv-search)
app.post('/api/tv-torrents/search', async (req, res) => {
  const { showId, seasonNumber, episodeNumber } = req.body;
  
  // Verificar que se proporcionen los parámetros requeridos
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
    
    // Usar la función de búsqueda por ID de TMDb
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

// Ruta alternativa usando el mismo formato que tv-search (/search)
app.post('/api/search', async (req, res) => {
  const { showId, seasonNumber, episodeNumber } = req.body;
  
  // Verificar que se proporcionen los parámetros requeridos
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
    
    // Usar la función de búsqueda por ID de TMDb
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

// Función para buscar torrents reales de series de TV usando TorrentSearchApi
async function searchRealTVTorrents(tvTitle, season, episode) {
  try {
    console.log(`🔍 Searching real TV torrents for: ${tvTitle} S${season}E${episode}`);
    
    // Verificar si hay proveedores activos
    const activeProviders = torrentSearch.getActiveProviders();
    if (activeProviders.length === 0) {
      console.log('⚠️  No active torrent providers, using mock data');
      return generateMockTorrents(tvTitle, 'tv', season, episode);
    }
    
    // Construir el query de búsqueda
    let query = tvTitle;
    if (season && episode) {
      query += ` S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}`;
    } else if (season) {
      query += ` S${season.toString().padStart(2, '0')}`;
    }
    
    console.log(`🎯 Torrent search query: ${query}`);
    
    let searchResults = [];
    
    try {
      // Buscar torrents usando la API con timeout
      console.log(`🎯 Attempting real torrent search: ${query}`);
      
      const searchPromise = torrentSearch.search(query, 'TV', 50);
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve([]), 10000); // 10 second timeout for real search
      });
      
      searchResults = await Promise.race([searchPromise, timeoutPromise]);
      
      if (searchResults && searchResults.length > 0) {
        console.log(`📊 Found ${searchResults.length} real torrents from providers`);
        
        // Verificar que los resultados no sean falsos positivos
        const validResults = searchResults.filter(r => 
          r && (r.title || r.name) && 
          (r.title || r.name).toLowerCase().includes(tvTitle.toLowerCase().substring(0, 5))
        );
        
        if (validResults.length > 0) {
          console.log(`✅ ${validResults.length} results seem relevant`);
          return await processTorrentResults(validResults, tvTitle, season, episode);
        } else {
          console.log(`⚠️  Results don't seem relevant to "${tvTitle}"`);
          searchResults = [];
        }
      } else {
        console.log(`📊 No real torrents found`);
      }
    } catch (searchError) {
      console.log(`❌ Error in torrent search: ${searchError.message}`);
      searchResults = [];
    }
    
    if (!searchResults || searchResults.length === 0) {
      console.log('🔄 No real torrents found, trying alternative search...');
      
      // Intentar con un query simplificado
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

// Función auxiliar para procesar resultados de torrents
async function processTorrentResults(searchResults, tvTitle, season, episode) {
  try {
    // Procesar resultados y obtener magnets
    const torrents = [];
    const maxResults = Math.min(searchResults.length, 20);
    
    console.log(`🔄 Processing ${maxResults} torrent results...`);
    
    for (let i = 0; i < maxResults; i++) {
      const torrent = searchResults[i];
      
      if (!torrent) continue;
      
      try {
        let magnetLink = null;
        
        // Intentar obtener el magnet link
        try {
          magnetLink = await torrentSearch.getMagnet(torrent);
          console.log(`✅ Got magnet for torrent ${i + 1}/${maxResults}`);
        } catch (magnetError) {
          console.log(`⚠️  Could not get magnet for torrent ${i + 1}: ${magnetError.message}`);
          // Continuar sin magnet link
        }
        
        // Normalizar el formato del resultado
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
          // Extraer hash del magnet si está disponible
          hash: magnetLink ? magnetLink.match(/xt=urn:btih:([^&]+)/i)?.[1] : (torrent.hash || undefined),
          // Preserve demo flags if they exist, otherwise mark as real torrent
          isDemo: torrent.isDemo || false,
          demoMessage: torrent.demoMessage || undefined
        };
        
        torrents.push(normalizedTorrent);
        
      } catch (itemError) {
        console.error(`❌ Error processing torrent item ${i}:`, itemError.message);
        
        // Agregar un torrent básico sin magnet en caso de error
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
          // Preserve demo flags if they exist, otherwise mark as real torrent
          isDemo: torrent.isDemo || false,
          demoMessage: torrent.demoMessage || undefined
        });
      }
    }
    
    // Ordenar por seeds (descendente)
    torrents.sort((a, b) => (b.seeds || 0) - (a.seeds || 0));
    
    console.log(`✅ Successfully processed ${torrents.length} TV torrents`);
    return torrents;
    
  } catch (error) {
    console.error('❌ Error processing torrent results:', error);
    console.log('🎭 Fallback to mock data due to processing error');
    return generateMockTorrents(tvTitle, 'tv', season, episode);
  }
}

// Función para buscar torrent de manera case-insensitive
function findTorrentByHash(hashOrMagnet) {
  try {
    // Si es un magnet URI, extraer el hash
    let targetHash = hashOrMagnet;
    if (hashOrMagnet.includes('magnet:')) {
      const match = hashOrMagnet.match(/xt=urn:btih:([^&]+)/i);
      if (match) {
        targetHash = match[1];
      }
    }
    
    targetHash = targetHash.toLowerCase();
    
    // Buscar en la lista de torrents del cliente
    for (const torrent of client.torrents) {
      if (torrent.infoHash && torrent.infoHash.toLowerCase() === targetHash) {
        return torrent;
      }
    }
    
    // Si no se encuentra en la lista real, intentar con client.get() como fallback
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

// Función auxiliar para verificar si un torrent está realmente listo
function isTorrentReady(torrent) {
  if (!torrent) {
    console.log(`🔍 isTorrentReady: No torrent provided`);
    return false;
  }
  
  if (torrent.destroyed) {
    console.log(`🔍 isTorrentReady: Torrent is destroyed`);
    return false;
  }
  
  // Verificar metadata básica
  if (!torrent.infoHash || !torrent.name || torrent.name === 'Unknown') {
    console.log(`🔍 isTorrentReady: Missing basic metadata`, {
      hasInfoHash: !!torrent.infoHash,
      name: torrent.name
    });
    return false;
  }
  
  // Verificar archivos
  if (!torrent.files || !Array.isArray(torrent.files) || torrent.files.length === 0) {
    console.log(`🔍 isTorrentReady: No valid files`, {
      hasFiles: !!torrent.files,
      isArray: Array.isArray(torrent.files),
      filesLength: torrent.files ? torrent.files.length : 'N/A'
    });
    return false;
  }
  
  // Verificar que al menos un archivo tenga nombre válido
  const validFiles = torrent.files.filter(file => file && file.name && file.name.trim() !== '');
  if (validFiles.length === 0) {
    console.log(`🔍 isTorrentReady: No files with valid names`);
    return false;
  }
  
  console.log(`✅ Torrent ready check PASSED: ${torrent.name}, files: ${torrent.files.length}, valid files: ${validFiles.length}`);
  return true;
}

// Función auxiliar para verificar si un torrent está corrupto
function isTorrentCorrupted(torrent) {
  if (!torrent) {
    console.log('🔍 Torrent is null/undefined');
    return true;
  }
  
  // Verificar si está destruido
  if (torrent.destroyed) {
    console.log(`🔍 Torrent is destroyed: ${torrent.name || 'Unknown'}`);
    return true;
  }
  
  // Verificar metadata básica
  if (!torrent.infoHash || !torrent.name || torrent.name === 'Unknown') {
    console.log(`🔍 Torrent missing basic metadata:`, {
      name: torrent.name || 'Missing',
      hasInfoHash: !!torrent.infoHash,
      hasFiles: !!(torrent.files && torrent.files.length > 0)
    });
    return true;
  }
  
  // Verificar si tiene archivos válidos
  if (!torrent.files || torrent.files.length === 0) {
    console.log(`🔍 Torrent has no files: ${torrent.name}`);
    return true;
  }
  
  // Verificar si el progreso es válido (puede ser 0 pero no NaN)
  if (isNaN(torrent.progress)) {
    console.log(`🔍 Torrent has invalid progress: ${torrent.name}, progress=${torrent.progress}`);
    return true;
  }
  
  // Verificar numPeers (puede ser 0 pero no undefined)
  if (torrent.numPeers === undefined) {
    console.log(`🔍 Torrent has undefined numPeers: ${torrent.name}`);
    return true;
  }
  
  return false;
}

// Limpieza inicial al arrancar el servidor
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

// Función de limpieza periódica más agresiva
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

// Ejecutar limpieza inicial después de 5 segundos
setTimeout(initialCleanup, 5000);

// Ejecutar limpieza periódica cada 2 minutos
setInterval(periodicCleanup, 2 * 60 * 1000);

// Función para forzar limpieza inmediata (útil para debugging)
app.get('/api/cleanup', (req, res) => {
  console.log('🔧 Manual cleanup requested via API');
  periodicCleanup();
  initialCleanup();
  res.json({ message: 'Cleanup completed' });
});

// Función auxiliar para verificar si un objeto es un torrent real (no solo un stub)
function isRealTorrent(torrent) {
  return torrent && 
         typeof torrent === 'object' && 
         typeof torrent.destroy === 'function' &&
         torrent.hasOwnProperty('files') &&
         torrent.hasOwnProperty('infoHash');
}

// Función para verificar si un torrent realmente existe en la lista del cliente
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

// Función segura para limpiar torrents corruptos
function safeRemoveTorrent(magnetURI, reason = 'cleanup') {
  const torrentHash = magnetURI.match(/xt=urn:btih:([^&]+)/i)?.[1] || 'unknown';
  
  try {
    // Solo intentar eliminar si realmente existe en la lista del cliente
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

// API para detener y limpiar un torrent específico (llamado al cerrar video)
app.delete('/api/torrent/stop/:infoHash', (req, res) => {
  const { infoHash } = req.params;
  
  if (!infoHash) {
    return res.status(400).json({ message: 'InfoHash is required' });
  }
  
  const torrentHash = infoHash.length > 20 ? infoHash : infoHash;
  console.log(`[${torrentHash}] Stop request received`);
  
  try {
    // Buscar el torrent
    const torrent = findTorrentByHash(infoHash);
    
    if (!torrent) {
      console.log(`[${torrentHash}] Torrent not found, already cleaned up`);
      return res.json({ 
        message: 'Torrent not found (possibly already cleaned up)',
        success: true 
      });
    }
    
    console.log(`[${torrentHash}] Stopping torrent: ${torrent.name || 'Unknown'}`);
    
    // Pausar todas las descargas y uploads
    if (torrent.pause && typeof torrent.pause === 'function') {
      torrent.pause();
    }
    
    // Desconectar todos los peers
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
    
    // Limpiar archivos temporales y streams
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
    
    // Destruir el torrent completamente
    const destroyPromise = new Promise((resolve, reject) => {
      const destroyTimeout = setTimeout(() => {
        console.log(`[${torrentHash}] Destroy timeout, forcing removal`);
        resolve();
      }, 5000); // 5 segundos timeout
      
      torrent.destroy((err) => {
        clearTimeout(destroyTimeout);
        if (err) {
          console.log(`[${torrentHash}] Error during destroy:`, err.message);
          resolve(); // Continuar a pesar del error
        } else {
          console.log(`[${torrentHash}] Successfully destroyed`);
          resolve();
        }
      });
    });
    
    destroyPromise.then(() => {
      // Verificar que el torrent se eliminó de la lista del cliente
      const stillExists = findTorrentByHash(infoHash);
      if (stillExists) {
        console.log(`[${torrentHash}] Torrent still exists after destroy, forcing removal`);
        try {
          client.remove(infoHash);
        } catch (removeError) {
          console.log(`[${torrentHash}] Error forcing removal:`, removeError.message);
        }
      }
      
      // Limpiar cache de subtítulos relacionado
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

// API alternativa usando POST para sendBeacon (navegadores envían POST para sendBeacon)
app.post('/api/torrent/stop/:infoHash', (req, res) => {
  // Redirigir al método DELETE
  console.log(`[${req.params.infoHash}] Stop request via POST (sendBeacon)`);
  
  // Llamar al handler del DELETE
  const deleteReq = { 
    params: req.params,
    body: req.body
  };
  
  // Simular la respuesta para el método DELETE
  const mockRes = {
    status: (code) => ({ json: (data) => console.log(`POST response ${code}:`, data) }),
    json: (data) => console.log('POST response:', data)
  };
  
  // Ejecutar la lógica de limpieza de manera asíncrona
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
  
  // Responder inmediatamente al sendBeacon
  res.status(200).json({ message: 'Cleanup initiated', success: true });
});

// Endpoint para obtener estadísticas de un torrent específico
app.get('/api/torrent/stats/:infoHash', (req, res) => {
  const { infoHash } = req.params;
  
  try {
    // Buscar el torrent en el cliente WebTorrent
    const torrent = client.torrents.find(t => t.infoHash === infoHash);
    
    if (!torrent) {
      return res.status(404).json({ error: 'Torrent not found' });
    }
    
    // Verificar si el torrent está listo
    if (!torrent.ready) {
      return res.status(503).json({ error: 'Torrent not ready' });
    }
    
    // Devolver estadísticas del torrent
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

// Función auxiliar para buscar torrents usando TMDb ID (implementación similar a tv-search)
async function searchTVTorrentsById(showId, seasonNumber, episodeNumber) {
  try {
    console.log(`🔍 Searching TV torrents by ID: ${showId} S${seasonNumber}E${episodeNumber}`);
    
    let seriesName = null;
    
    // Intentar obtener detalles de la serie desde TMDb si hay API key
    if (API_KEY && API_KEY !== 'demo_key_for_testing') {
      try {
        const seriesDetails = await getTVSeriesDetails(showId);
        seriesName = seriesDetails ? (seriesDetails.name || seriesDetails.original_name) : null;
        
        if (seriesName) {
          console.log(`✅ Found series name: ${seriesName}`);
        }
      } catch (tmdbError) {
        console.log(`⚠️  TMDb API error: ${tmdbError.message}`);
      }
    } else {
      console.log('⚠️  No TMDb API key available');
    }
    
    // Si no se pudo obtener el nombre de la serie, usar nombres conocidos por ID
    if (!seriesName) {
      seriesName = getKnownSeriesName(showId) || `TV Show ${showId}`;
      console.log(`🎯 Using fallback name: ${seriesName}`);
    }
    
    // Buscar torrents usando el nombre de la serie
    return await searchRealTVTorrents(seriesName, seasonNumber, episodeNumber);
    
  } catch (error) {
    console.error('❌ Error searching TV torrents by ID:', error);
    const fallbackName = getKnownSeriesName(showId) || `TV Show ${showId}`;
    return generateMockTorrents(fallbackName, 'tv', seasonNumber, episodeNumber);
  }
}

// Función auxiliar para nombres de series conocidas (para cuando no hay API key)
function getKnownSeriesName(showId) {
  const knownSeries = {
    1399: 'Game of Thrones',
    60625: 'Rick and Morty',
    1668: 'Friends',
    2316: 'The Office',
    46648: 'Stranger Things',
    85271: 'WandaVision',
    71712: 'The Good Place',
    82856: 'The Mandalorian',
    94605: 'Arcane',
    63174: 'The Boys',
    95557: 'Squid Game',
    90462: 'Chernobyl',
    66732: 'The Witcher',
    88329: 'The Umbrella Academy',
    87739: 'The Queen\'s Gambit',
    85221: 'Ozark',
    1429: 'Attack on Titan',
    1901: 'Breaking Bad',
    60059: 'Better Call Saul',
    37854: 'One Piece',
    1396: 'Breaking Bad',
    456: 'The Simpsons',
    1418: 'The Big Bang Theory',
    4614: 'NCIS',
    72879: 'Wednesday',
    84958: 'Loki',
    88040: 'The Falcon and the Winter Soldier',
    71446: 'Money Heist',
    82814: 'The Crown',
    1402: 'The Walking Dead',
    456: 'The Simpsons',
    1622: 'Supernatural',
    73640: 'Brooklyn Nine-Nine',
    2707: 'Sherlock',
    1412: 'Arrow',
    60735: 'The Flash',
    38472: 'The Blacklist',
    1403: 'Marvel\'s Agents of S.H.I.E.L.D.',
    18165: 'Grey\'s Anatomy',
    4026: 'Law & Order: Special Victims Unit'
  };
  
  return knownSeries[showId] || null;
}

// Función auxiliar para obtener detalles del episodio desde TMDb
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

// Función auxiliar para obtener detalles de la serie desde TMDb
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
// API para explorar archivos dentro de un torrent
app.post('/api/torrent/explore', (req, res) => {
  const { magnetURI } = req.body;
  
  if (!magnetURI) {
    return res.status(400).json({ message: 'Magnet URI is required' });
  }

  const torrentHash = magnetURI.match(/xt=urn:btih:([^&]+)/i)?.[1] || 'unknown';
  console.log(`[${torrentHash}] Exploring torrent request received`);

  try {
    // Verificar si el torrent ya existe
    const existingTorrent = findTorrentByHash(magnetURI);
    if (existingTorrent) {
      console.log(`[${torrentHash}] Found existing torrent: ${existingTorrent.name || 'Unknown'}`);
      console.log(`[${torrentHash}] Peers: ${existingTorrent.numPeers}, Progress: ${(existingTorrent.progress * 100).toFixed(1)}%`);
      
      // Verificar si el torrent está corrupto
      if (isTorrentCorrupted(existingTorrent)) {
        console.log(`[${torrentHash}] Existing torrent is corrupted, removing and retrying`);
        safeRemoveTorrent(magnetURI, 'corrupted existing torrent');
        // Continuar con agregar el torrent nuevamente
      } else if (isTorrentReady(existingTorrent)) {
        // Si está listo, devolver información inmediatamente
        console.log(`[${torrentHash}] Existing torrent has files: ${existingTorrent.files.length}`);
        return sendTorrentInfo(existingTorrent, res);
      } else if (existingTorrent.numPeers === 0) {
        // Si no tiene peers, destruir y reintentar
        console.log(`[${torrentHash}] Existing torrent has no peers, removing and retrying`);
        safeRemoveTorrent(magnetURI, 'no peers');
        // Continuar con agregar el torrent nuevamente
      } else {
        // Si existe pero no tiene archivos aún, esperar con timeout más largo
        console.log(`[${torrentHash}] Existing torrent loading, waiting for files...`);
        let waitTime = 0;
        const maxWaitTime = 25000; // Reducir a 25 segundos para torrents existentes
        const checkInterval = 3000; // Verificar cada 3 segundos
        
        const waitForFiles = () => {
          if (res.headersSent) return; // La respuesta ya fue enviada
          
          if (waitTime >= maxWaitTime) {
            console.log(`[${torrentHash}] Timeout waiting for existing torrent files`);
            // Destruir el torrent problemático antes de responder
            safeRemoveTorrent(magnetURI, 'timeout');
            return res.status(503).json({ 
              message: 'This torrent is taking too long to load. It might be a slow or dead torrent. Please try a different quality or torrent.' 
            });
          }
          
          // Verificar si se corrompió durante la espera
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
          
          // Si el torrent pierde todos los peers, destruirlo
          if (existingTorrent.numPeers === 0 && waitTime > 10000) {
            console.log(`[${torrentHash}] Torrent lost all peers, giving up`);
            safeRemoveTorrent(magnetURI, 'lost all peers');
            return res.status(503).json({ 
              message: 'Torrent lost connection to peers. Please try a different torrent.' 
            });
          }
          
          waitTime += checkInterval;
          if (waitTime % 6000 === 0) { // Log cada 6 segundos
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
      destroyStoreOnDestroy: false, // No destruir automáticamente
      maxConns: 55, // Más conexiones
      announce: additionalTrackers
    }, (torrent) => {
      if (torrentAdded) return; // Evitar callbacks múltiples
      torrentAdded = true;
      
      console.log(`[${torrentHash}] Torrent added successfully: ${torrent.name || 'Unknown'}`);
      console.log(`[${torrentHash}] Initial peers: ${torrent.numPeers}`);
      
      // Configurar eventos del torrent
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
      
      // Esperar a que se carguen los archivos con timeout más inteligente
      let waitTime = 0;
      const maxWaitTime = 40000; // 40 segundos para torrents nuevos
      const checkInterval = 2000; // Verificar cada 2 segundos
      
      const checkTorrentReady = () => {
        if (res.headersSent) return; // La respuesta ya fue enviada
        
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
        
        // Si no hay peers después de 15 segundos, es probablemente un torrent muerto
        if (torrent.numPeers === 0 && waitTime > 15000) {
          console.log(`[${torrentHash}] No peers found, torrent might be dead`);
          torrent.destroy();
          return res.status(503).json({ 
            message: 'No peers found for this torrent. It might be dead or very rare. Please try a different quality.' 
          });
        }
        
        waitTime += checkInterval;
        if (waitTime % 8000 === 0) { // Log cada 8 segundos
          console.log(`[${torrentHash}] Waiting for torrent files... ${waitTime}ms/${maxWaitTime}ms, peers: ${torrent.numPeers}`);
        }
        setTimeout(checkTorrentReady, checkInterval);
      };

      // Verificar inmediatamente si ya está listo
      if (isTorrentReady(torrent)) {
        console.log(`[${torrentHash}] Torrent immediately ready`);
        sendTorrentInfo(torrent, res);
      } else {
        // Si no está listo, empezar a verificar
        setTimeout(checkTorrentReady, 3000); // Esperar 3 segundos antes de empezar
      }
    });

    // Timeout de seguridad global
    setTimeout(() => {
      if (!res.headersSent) {
        console.log(`[${torrentHash}] Global timeout reached for torrent`);
        res.status(408).json({ 
          message: 'Request timeout. The torrent is taking too long to respond. Please try again with a different torrent or quality.' 
        });
      }
    }, 45000); // 45 segundos timeout global

  } catch (error) {
    console.error(`[${torrentHash}] Error exploring torrent:`, error);
    res.status(500).json({ message: 'Error exploring torrent: ' + error.message });
  }
});

// Función auxiliar para enviar información del torrent
function sendTorrentInfo(torrent, res) {
  try {
    console.log('sendTorrentInfo called, torrent:', {
      name: torrent.name,
      hasFiles: !!torrent.files,
      filesLength: torrent.files ? torrent.files.length : 'undefined',
      infoHash: torrent.infoHash || 'missing',
      numPeers: torrent.numPeers
    });

    // Verificar primero si el torrent está corrupto
    if (isTorrentCorrupted(torrent)) {
      console.log('Torrent is corrupted, cannot send info');
      torrent.destroy(); // Limpiar inmediatamente
      return res.status(503).json({ 
        message: 'Torrent is corrupted. Please try again with a different torrent.' 
      });
    }

    // Verificar que el torrent tenga archivos cargados
    if (!torrent || !torrent.files || !Array.isArray(torrent.files) || torrent.files.length === 0) {
      console.log('Torrent files not ready, returning 503');
      return res.status(503).json({ 
        message: 'Torrent files not yet loaded, please try again in a moment' 
      });
    }

    // Crear copias de las arrays para evitar problemas de concurrencia
    const files = [...torrent.files];

    // Filtrar solo archivos de video
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'];
    const videoFiles = files.filter(file => {
      if (!file || !file.name) return false;
      const ext = path.extname(file.name).toLowerCase();
      return videoExtensions.includes(ext);
    });

    // Filtrar archivos de subtítulos
    const subtitleExtensions = ['.srt', '.vtt', '.ass', '.ssa', '.sub'];
    const subtitleFiles = files.filter(file => {
      if (!file || !file.name) return false;
      const ext = path.extname(file.name).toLowerCase();
      return subtitleExtensions.includes(ext);
    });

    // Contar seeds y leechers de forma segura
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
          // Ignorar errores de wires individuales
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
    // Si hay error, intentar limpiar el torrent
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

// API para hacer streaming de un archivo de video del torrent
app.get('/api/torrent/stream/:infoHash/:fileIndex', (req, res) => {
  const { infoHash, fileIndex } = req.params;
  const range = req.headers.range;

  const torrent = findTorrentByHash(infoHash);
  
  if (!torrent) {
    return res.status(404).json({ message: 'Torrent not found' });
  }

  // Verificar si el torrent está corrupto o no tiene archivos
  if (isTorrentCorrupted(torrent) || !isTorrentReady(torrent)) {
    console.log(`Stream request for corrupted/unready torrent: ${infoHash}`);
    return res.status(503).json({ message: 'Torrent is not ready for streaming. Please wait or try again.' });
  }

  // Verificar que files existe y es un array válido
  if (!torrent.files || !Array.isArray(torrent.files) || torrent.files.length === 0) {
    console.log(`Stream request but torrent has no files: ${infoHash}`);
    return res.status(503).json({ message: 'Torrent files not available yet. Please wait and try again.' });
  }

  const file = torrent.files[parseInt(fileIndex)];
  
  if (!file) {
    return res.status(404).json({ message: 'File not found' });
  }

  const fileSize = file.length;
  
  // Detectar cuando el cliente se desconecta
  const onClientDisconnect = () => {
    console.log(`[${infoHash}] Client disconnected from stream`);
    // No destruir inmediatamente el torrent ya que el usuario podría reconectarse
    // Solo logear para propósitos de debugging
  };

  // Escuchar cuando el cliente cierra la conexión
  res.on('close', onClientDisconnect);
  res.on('finish', () => {
    console.log(`[${infoHash}] Stream finished normally`);
  });

  // Limpiar listeners cuando la respuesta termine
  const originalEnd = res.end;
  res.end = function(...args) {
    res.removeListener('close', onClientDisconnect);
    return originalEnd.apply(this, args);
  };
  
  if (range) {
    // Manejo de range requests para streaming
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
      'Cache-Control': 'no-cache' // Evitar cache para streams en vivo
    });
    
    const stream = file.createReadStream({ start, end });
    
    // Manejar errores del stream
    stream.on('error', (error) => {
      console.log(`[${infoHash}] Stream error (range): ${error.message}`);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });
    
    // Manejar desconexión del cliente
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
      'Cache-Control': 'no-cache' // Evitar cache para streams en vivo
    });
    
    const stream = file.createReadStream();
    
    // Manejar errores del stream
    stream.on('error', (error) => {
      console.log(`[${infoHash}] Stream error (full): ${error.message}`);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });
    
    // Manejar desconexión del cliente
    res.on('close', () => {
      if (stream && !stream.destroyed) {
        stream.destroy();
        console.log(`[${infoHash}] Full stream destroyed due to client disconnect`);
      }
    });
    
    stream.pipe(res);
  }
});

// API para obtener archivos de subtítulos del torrent
app.get('/api/torrent/subtitle/:infoHash/:fileIndex', (req, res) => {
  const { infoHash, fileIndex } = req.params;

  const torrent = findTorrentByHash(infoHash);
  
  if (!torrent) {
    return res.status(404).json({ message: 'Torrent not found' });
  }

  // Verificar si el torrent está corrupto o no tiene archivos
  if (isTorrentCorrupted(torrent) || !isTorrentReady(torrent)) {
    console.log(`Subtitle request for corrupted/unready torrent: ${infoHash}`);
    return res.status(503).json({ message: 'Torrent is not ready for subtitle access. Please wait or try again.' });
  }

  // Verificar que files existe y es un array válido
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
  
  // Manejar errores del stream de subtítulos
  stream.on('error', (error) => {
    console.log(`Subtitle stream error: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).end();
    }
  });
  
  // Manejar desconexión del cliente
  res.on('close', () => {
    if (stream && !stream.destroyed) {
      stream.destroy();
    }
  });
  
  stream.pipe(res);
});

// API para obtener el progreso de un torrent
app.get('/api/torrent/progress/:infoHash', (req, res) => {
  const { infoHash } = req.params;
  
  const torrent = findTorrentByHash(infoHash);
  
  if (!torrent) {
    return res.status(404).json({ message: 'Torrent not found' });
  }

  // Verificar si el torrent está corrupto
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

// API para buscar subtítulos en línea (OpenSubtitles compatible)
app.get('/api/subtitles/search', async (req, res) => {
  const { imdbId, movieTitle, language = 'es' } = req.query;
  
  try {
    // Verificar que tenemos al menos el título de la película
    if (!movieTitle) {
      return res.status(400).json({ message: 'movieTitle is required' });
    }
    
    console.log(`Searching subtitles for: ${movieTitle} (imdbId: ${imdbId || 'N/A'}) in ${language}`);
    
    let subtitles = [];
    
    // Si tenemos la API key de OpenSubtitles, usar la API real
    if (OPENSUBTITLES_API_KEY) {
      try {
        subtitles = await searchOpenSubtitles(movieTitle, imdbId, language);
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

// Función para buscar subtítulos en OpenSubtitles
async function searchOpenSubtitles(movieTitle, imdbId, language) {
  const subtitles = [];
  
  try {
    console.log('Searching OpenSubtitles with API key...');
    
    // Construir parámetros de búsqueda
    let searchParams = `languages=${language}`;
    
    if (imdbId) {
      // Si tenemos el ID de IMDb, usarlo (más preciso)
      const cleanImdbId = imdbId.replace('tt', '');
      searchParams += `&imdb_id=${cleanImdbId}`;
      console.log(`Searching by IMDb ID: ${cleanImdbId}`);
    } else {
      // Si no, buscar por título
      searchParams += `&query=${encodeURIComponent(movieTitle)}`;
      console.log(`Searching by title: ${movieTitle}`);
    }
    
    // Buscar subtítulos directamente (sin login para API key)
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
    
    // Procesar resultados
    if (searchData.data && Array.isArray(searchData.data)) {
      searchData.data.forEach((subtitle, index) => {
        try {
          if (subtitle.attributes && subtitle.attributes.files && subtitle.attributes.files.length > 0) {
            const file = subtitle.attributes.files[0];
            const attributes = subtitle.attributes;
            
            // Debug: Log para ver la estructura de datos
            console.log(`Subtitle ${index}:`, {
              id: subtitle.id,
              fileId: file.file_id,
              fileName: file.file_name,
              url: attributes.url
            });
            
            // Incluir el file_id en la URL para usarlo directamente
            // Usar una URL directa sin pasar por el proxy
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
    }
    
    console.log(`Successfully processed ${subtitles.length} subtitles`);
    
  } catch (error) {
    console.error('OpenSubtitles API error:', error);
    throw error;
  }
  
  return subtitles;
}

// Función auxiliar para obtener nombres de idiomas
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

// Function to convert SRT format to WebVTT format for browser compatibility
function convertSrtToWebVtt(srtContent) {
  // Start with WEBVTT header
  let webvtt = 'WEBVTT\n\n';
  
  // Split content into subtitle blocks
  const blocks = srtContent.trim().split(/\n\s*\n/);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length >= 3) {
      // Skip the subtitle number (first line)
      const timeLine = lines[1];
      const textLines = lines.slice(2);
      
      // Convert time format from SRT (00:00:00,000) to WebVTT (00:00:00.000)
      const webvttTime = timeLine.replace(/,/g, '.');
      
      // Add the subtitle entry
      webvtt += webvttTime + '\n';
      webvtt += textLines.join('\n') + '\n\n';
    }
  }
  
  return webvtt;
}

// API para hacer proxy de subtítulos y evitar problemas de CORS
app.get('/api/subtitles/proxy', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ message: 'URL is required' });
  }

  console.log(`Proxying subtitle from: ${url}`);

  try {
    // Verificar si es una URL interna (opensubtitles)
    if (url.startsWith('/api/subtitles/opensubtitles-download/')) {
      // En lugar de redirigir, procesar directamente
      console.log(`Processing OpenSubtitles download directly: ${url}`);
      
      // Extraer subtitleId y fileId de la URL
      const urlParts = url.split('/');
      const subtitleId = urlParts[4]; // /api/subtitles/opensubtitles-download/SUBTITLE_ID/FILE_ID
      const fileId = urlParts[5];
      
      if (!subtitleId || !fileId) {
        return res.status(400).json({ message: 'Invalid OpenSubtitles URL format' });
      }
      
      // Redirigir internamente al endpoint
      return res.redirect(`/api/subtitles/opensubtitles-download/${subtitleId}/${fileId}`);
    }

    // Para URLs externas, verificar que sean válidas
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return res.status(400).json({ 
        message: 'Invalid URL format. URL must start with http:// or https://',
        url: url
      });
    }

    // Configurar headers basados en la fuente
    const headers = {
      'User-Agent': 'ATV v1.0',
      'Accept': 'text/plain, text/vtt, application/x-subrip, */*',
      'Accept-Encoding': 'identity'
    };

    // Si es una URL de OpenSubtitles, agregar autenticación
    if (url.includes('opensubtitles.com') && OPENSUBTITLES_API_KEY) {
      headers['Api-Key'] = OPENSUBTITLES_API_KEY;
      console.log('Added OpenSubtitles API key to headers');
    }

    // Para URLs externas, intentar fetch con headers apropiados
    const response = await fetch(url, {
      headers: headers,
      timeout: 15000 // 15 segundos de timeout
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
    
    // Obtener el contenido del subtítulo
    const content = await response.text();
    console.log(`Subtitle content length: ${content.length} characters`);
    
    // Detectar si es SRT o VTT y establecer el content type apropiado
    const isVTT = content.includes('WEBVTT') || url.includes('.vtt');
    const contentType = isVTT ? 'text/vtt; charset=utf-8' : 'text/plain; charset=utf-8';
    
    // Establecer las cabeceras para indicar que es un archivo de subtítulos
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Si el contenido está vacío o es muy corto, considerarlo como error
    if (!content || content.length < 10) {
      console.error('Subtitle content is empty or too short');
      return res.status(404).json({ 
        message: 'Subtitle content not found or invalid',
        contentLength: content.length
      });
    }

    // Verificar si el contenido parece ser HTML (error page)
    if (content.toLowerCase().includes('<html>') || content.toLowerCase().includes('<!doctype')) {
      console.error('Received HTML instead of subtitle content');
      return res.status(404).json({ 
        message: 'Received HTML page instead of subtitle file. The URL may be incorrect.',
        contentPreview: content.substring(0, 200)
      });
    }

    // Enviar el contenido del subtítulo al cliente
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



// Función auxiliar para formatear tiempo en formato SRT
function formatSRTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const milliseconds = 0;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

// API para subir subtítulos manualmente
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

// API para actuar como proxy y descargar subtítulos, evitando problemas de CORS
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
    
    // Establecer las cabeceras adecuadas para que el cliente lo interprete como un archivo de texto
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Enviar el contenido del subtítulo al cliente
    response.body.pipe(res);

  } catch (error) {
    console.error('Error proxying subtitle:', error);
    res.status(500).json({ message: 'Error proxying subtitle' });
  }
});



// Función para extraer calidad del título del torrent
function extractQualityFromTitle(title) {
  if (!title) return 'Unknown';
  
  const titleUpper = title.toUpperCase();
  
  // Buscar resoluciones comunes en orden de preferencia (más específicas primero)
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
  
  // Si no se encuentra una calidad específica, intentar extraer números seguidos de 'P'
  const resolutionMatch = title.match(/(\d{3,4})P/i);
  if (resolutionMatch) {
    return resolutionMatch[1] + 'p';
  }
  
  return 'SD';
}
