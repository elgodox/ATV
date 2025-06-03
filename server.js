// server.js
import express from 'express';
import fetch from 'node-fetch';
import WebTorrent from 'webtorrent';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY; // Cargar la API key desde el .env
const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN;

// Crear cliente de WebTorrent
const client = new WebTorrent();

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
  const url = `https://api.themoviedb.org/3/genre/movie/list?api_key=${API_KEY}&language=es`;
  const response = await fetch(url);
  const data = await response.json();
  res.json(data);
});

// Ruta para obtener géneros según el tipo de contenido (movie o tv)
app.get('/api/genres/:type', async (req, res) => {
  const { type } = req.params;
  const url = `https://api.themoviedb.org/3/genre/${type}/list?api_key=${API_KEY}&language=es`;

  try {
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
  const { type, searchQuery, genre, platform, sortBy, page } = req.query;
  
  let url;
  if (searchQuery) {
    url = `https://api.themoviedb.org/3/search/${type}?api_key=${API_KEY}&query=${searchQuery}&page=${page}&language=en&with_watch_providers=${platform}&watch_region=US`;
  } else {
    url = `https://api.themoviedb.org/3/discover/${type}?api_key=${API_KEY}&with_watch_providers=${platform}&watch_region=US&page=${page}&with_genres=${genre}&language=en&sort_by=${sortBy}`;
  }

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`TMDb API error: ${response.statusText}`);
    }
    
    const data = await response.json();
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
    
    const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${API_KEY}&language=${language}&append_to_response=videos`;
  
    try {
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
      res.json(data);    } catch (error) {
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
    const url = `https://api.themoviedb.org/3/watch/providers/${type}?api_key=${API_KEY}&language=es-ES&watch_region=US`;
    try {
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
    const url = `https://api.themoviedb.org/3/${type}/${id}/watch/providers?api_key=${API_KEY}`;
  
    try {
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
  
    // URL de YTS para buscar torrents
    const torrentsUrl = `https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(movieTitle)}`;
  
    try {
      const response = await fetch(torrentsUrl);
      const data = await response.json();
  
      // Si la respuesta de YTS contiene películas, enviarlas al frontend
      if (data?.data?.movies?.length > 0) {
        res.json(data.data.movies);
      } else {
        res.status(404).json({ message: 'No torrents found for this movie.' });
      }
    } catch (error) {
      console.error('Error fetching torrents:', error);
      res.status(500).json({ message: 'Error fetching torrents' });
    }
  });
// API para explorar archivos dentro de un torrent
app.post('/api/torrent/explore', (req, res) => {
  const { magnetURI } = req.body;
  
  if (!magnetURI) {
    return res.status(400).json({ message: 'Magnet URI is required' });
  }

  try {
    // Verificar si el torrent ya existe
    const existingTorrent = client.get(magnetURI);
    if (existingTorrent) {
      // Si ya existe, devolver la información inmediatamente
      return sendTorrentInfo(existingTorrent, res);
    }

    client.add(magnetURI, { destroyStoreOnDestroy: true }, (torrent) => {
      sendTorrentInfo(torrent, res);
    });

    // Timeout para evitar que se cuelgue
    setTimeout(() => {
      const torrent = client.get(magnetURI);
      if (torrent && !res.headersSent) {
        res.status(408).json({ message: 'Timeout while loading torrent' });
        torrent.destroy();
      }
    }, 30000);

  } catch (error) {
    console.error('Error exploring torrent:', error);
    res.status(500).json({ message: 'Error exploring torrent: ' + error.message });
  }
});

// Función auxiliar para enviar información del torrent
function sendTorrentInfo(torrent, res) {
  // Filtrar solo archivos de video
  const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'];
  const videoFiles = torrent.files.filter(file => {
    const ext = path.extname(file.name).toLowerCase();
    return videoExtensions.includes(ext);
  });

  // Filtrar archivos de subtítulos
  const subtitleExtensions = ['.srt', '.vtt', '.ass', '.ssa', '.sub'];
  const subtitleFiles = torrent.files.filter(file => {
    const ext = path.extname(file.name).toLowerCase();
    return subtitleExtensions.includes(ext);
  });

  const torrentInfo = {
    name: torrent.name,
    infoHash: torrent.infoHash,
    magnetURI: torrent.magnetURI,
    length: torrent.length,
    pieceLength: torrent.pieceLength,
    lastPieceLength: torrent.lastPieceLength,
    numPeers: torrent.numPeers,
    progress: torrent.progress,
    ratio: torrent.ratio,
    downloadSpeed: torrent.downloadSpeed,
    uploadSpeed: torrent.uploadSpeed,
    videoFiles: videoFiles.map((file, index) => ({
      index: torrent.files.indexOf(file),
      name: file.name,
      length: file.length,
      path: file.path
    })),
    subtitleFiles: subtitleFiles.map((file, index) => ({
      index: torrent.files.indexOf(file),
      name: file.name,
      length: file.length,
      path: file.path
    }))
  };

  res.json(torrentInfo);
}

// API para hacer streaming de un archivo de video del torrent
app.get('/api/torrent/stream/:infoHash/:fileIndex', (req, res) => {
  const { infoHash, fileIndex } = req.params;
  const range = req.headers.range;

  const torrent = client.get(infoHash);
  
  if (!torrent) {
    return res.status(404).json({ message: 'Torrent not found' });
  }

  const file = torrent.files[parseInt(fileIndex)];
  
  if (!file) {
    return res.status(404).json({ message: 'File not found' });
  }

  const fileSize = file.length;
  
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
      'Access-Control-Allow-Origin': '*'
    });
    
    const stream = file.createReadStream({ start, end });
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
      'Access-Control-Allow-Origin': '*'
    });
    
    file.createReadStream().pipe(res);
  }
});

// API para obtener archivos de subtítulos del torrent
app.get('/api/torrent/subtitle/:infoHash/:fileIndex', (req, res) => {
  const { infoHash, fileIndex } = req.params;

  const torrent = client.get(infoHash);
  
  if (!torrent) {
    return res.status(404).json({ message: 'Torrent not found' });
  }

  const file = torrent.files[parseInt(fileIndex)];
  
  if (!file) {
    return res.status(404).json({ message: 'Subtitle file not found' });
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  file.createReadStream().pipe(res);
});

// API para obtener el progreso de un torrent
app.get('/api/torrent/progress/:infoHash', (req, res) => {
  const { infoHash } = req.params;
  
  const torrent = client.get(infoHash);
  
  if (!torrent) {
    return res.status(404).json({ message: 'Torrent not found' });
  }
  
  const progressInfo = {
    infoHash: torrent.infoHash,
    name: torrent.name,
    progress: torrent.progress,
    downloadSpeed: torrent.downloadSpeed,
    uploadSpeed: torrent.uploadSpeed,
    numPeers: torrent.numPeers,
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
    // Intentar buscar en OpenSubtitles usando una API básica
    // Esta es una implementación simulada - en producción usarías la API real de OpenSubtitles
    let subtitles = [];
    
    // Simulamos diferentes respuestas según el idioma
    if (language === 'es') {
      subtitles.push({
        id: '1',
        language: 'es',
        languageName: 'Español',
        filename: `${movieTitle}.es.srt`,
        downloadUrl: `https://dl.opensubtitles.org/en/download/file/${imdbId}.es.srt`,
        encoding: 'utf-8',
        downloads: 1250,
        rating: 4.5
      });
    }
    
    if (language === 'en' || language === '') {
      subtitles.push({
        id: '2',
        language: 'en',
        languageName: 'English',
        filename: `${movieTitle}.en.srt`,
        downloadUrl: `https://dl.opensubtitles.org/en/download/file/${imdbId}.en.srt`,
        encoding: 'utf-8',
        downloads: 2340,
        rating: 4.8
      });
    }
    
    // Agregar más idiomas si se solicitan
    const additionalLanguages = ['fr', 'de', 'it', 'pt'];
    if (additionalLanguages.includes(language)) {
      subtitles.push({
        id: '3',
        language: language,
        languageName: getLanguageName(language),
        filename: `${movieTitle}.${language}.srt`,
        downloadUrl: `https://dl.opensubtitles.org/en/download/file/${imdbId}.${language}.srt`,
        encoding: 'utf-8',
        downloads: 450,
        rating: 4.2
      });
    }
    
    res.json(subtitles);
  } catch (error) {
    console.error('Error searching subtitles:', error);
    res.status(500).json({ message: 'Error searching subtitles' });
  }
});

// Función auxiliar para obtener nombres de idiomas
function getLanguageName(lang) {
  const languages = {
    'fr': 'Français',
    'de': 'Deutsch',
    'it': 'Italiano',
    'pt': 'Português',
    'ru': 'Русский',
    'zh': '中文'
  };
  return languages[lang] || lang.toUpperCase();
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

// Ruta para hacer streaming de video a través de WebTorrent
app.post('/api/stream', upload.single('subtitles'), (req, res) => {
  const { magnetURI } = req.body;
  const subtitles = req.file ? req.file.path : null;

  if (!magnetURI) {
    return res.status(400).json({ message: 'Magnet URI is required' });
  }

  // Iniciar el streaming del torrent
  client.add(magnetURI, { path: '/path/to/download' }, (torrent) => {
    // Enviar información del torrent al cliente
    res.json({ 
      message: 'Torrent is being streamed', 
      torrentId: torrent.infoHash,
      subtitles: subtitles ? path.basename(subtitles) : null // Enviar el nombre del archivo de subtítulos si existe
    });

    // Manejar los archivos del torrent
    torrent.on('file', (file) => {
      // Aquí puedes manejar cada archivo del torrent, por ejemplo, reproducir video, etc.
      console.log('File received from torrent:', file.name);
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
