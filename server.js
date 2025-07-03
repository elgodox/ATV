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
    
    // Manejar errores del stream
    stream.on('error', (error) => {
      console.log(`Stream error (range): ${error.message}`);
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
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
      'Access-Control-Allow-Origin': '*'
    });
    
    const stream = file.createReadStream();
    
    // Manejar errores del stream
    stream.on('error', (error) => {
      console.log(`Stream error (full): ${error.message}`);
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

// API para obtener estadísticas actualizadas del torrent
app.get('/api/torrent/stats/:infoHash', (req, res) => {
  const { infoHash } = req.params;
  
  const torrent = findTorrentByHash(infoHash);
  
  if (!torrent) {
    return res.status(404).json({ message: 'Torrent not found' });
  }

  // Verificar si el torrent está corrupto
  if (isTorrentCorrupted(torrent)) {
    console.log(`Stats request for corrupted torrent: ${infoHash}`);
    return res.status(503).json({ message: 'Torrent is corrupted or not ready' });
  }

  try {
    // Contar seeds y leechers de forma segura
    let seeds = 0;
    let leechers = 0;
    
    if (torrent.wires && Array.isArray(torrent.wires)) {
      torrent.wires.forEach(wire => {
        try {
          if (wire.peerChoking === false && wire.peerInterested === true) {
            seeds++;
          } else {
            leechers++;
          }
        } catch (wireError) {
          // Ignorar errores de wires individuales
        }
      });
    }

    const stats = {
      numPeers: torrent.numPeers || 0,
      seeds: seeds,
      leechers: leechers,
      progress: torrent.progress || 0,
      downloadSpeed: torrent.downloadSpeed || 0,
      uploadSpeed: torrent.uploadSpeed || 0,
      downloaded: torrent.downloaded || 0,
      uploaded: torrent.uploaded || 0,
      timeRemaining: torrent.timeRemaining || 0,
      ratio: torrent.ratio || 0,
      done: torrent.done || false
    };

    res.json(stats);
  } catch (error) {
    console.error('Error getting torrent stats:', error);
    res.status(500).json({ message: 'Error getting torrent stats: ' + error.message });
  }
});

// Gestión de memoria y limpieza de torrents inactivos
function cleanupInactiveTorrents() {
  const maxTorrents = 10; // Máximo 10 torrents activos
  const inactivityThreshold = 30 * 60 * 1000; // 30 minutos de inactividad
  
  const torrents = client.torrents;
  console.log(`Cleanup check: ${torrents.length} torrents active`);
  
  // Primero, eliminar torrents corruptos
  const corruptedTorrents = torrents.filter(torrent => isTorrentCorrupted(torrent));
  corruptedTorrents.forEach(torrent => {
    console.log('Removing corrupted torrent:', torrent.infoHash || 'Unknown hash');
    torrent.destroy();
  });
  
  if (torrents.length <= maxTorrents) return;
  
  console.log(`Cleaning up torrents. Current count: ${torrents.length}`);
  
  // Ordenar por última actividad (los menos activos primero)
  const sortedTorrents = torrents
    .filter(torrent => !isTorrentCorrupted(torrent)) // Excluir corruptos
    .filter(torrent => torrent.downloadSpeed === 0 && torrent.uploadSpeed === 0)
    .sort((a, b) => (a.lastActivity || 0) - (b.lastActivity || 0));
  
  // Eliminar torrents inactivos hasta llegar al límite
  const torrentsToRemove = sortedTorrents.slice(0, torrents.length - maxTorrents);
  
  torrentsToRemove.forEach(torrent => {
    console.log('Removing inactive torrent:', torrent.name || 'Unknown');
    torrent.destroy();
  });
}

// Ejecutar limpieza cada 10 minutos
setInterval(cleanupInactiveTorrents, 10 * 60 * 1000);

// Agregar lista de trackers populares
const additionalTrackers = [
  'udp://tracker.openbittorrent.com:80/announce',
  'udp://tracker.internetwarriors.net:1337/announce',
  'udp://tracker.leechers-paradise.org:6969/announce',
  'udp://tracker.coppersurfer.tk:6969/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://tracker.tiny-vps.com:6969/announce',
  'udp://tracker.port443.xyz:6969/announce',
  'udp://open.stealth.si:80/announce',
  'udp://bt.xxx-tracker.com:2710/announce'
];

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

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
