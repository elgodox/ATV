// server.js
const express = require('express');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY; // Cargar la API key desde el .env
const VIMEO_ACCESS_TOKEN = process.env.VIMEO_ACCESS_TOKEN;


// Servir archivos estáticos
app.use(express.static('public'));

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

  const response = await fetch(url);
  const data = await response.json();
  res.json(data);
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
      const response = await fetch(url);
      
      // Verifica si la respuesta es correcta
      if (!response.ok) {
        throw new Error(`Failed to fetch data from TMDb: ${response.statusText}`);
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Error fetching movie/TV details:', error.message);
      res.status(500).json({ message: 'Error fetching details', error: error.message });
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

  // Ruta para obtener los detalles completos de una serie de TV
app.get('/api/tv/details/:id', async (req, res) => {
  const { id } = req.params;
  const url = `https://api.themoviedb.org/3/tv/${id}?api_key=${API_KEY}&language=es`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);  // Enviar los detalles completos de la serie al frontend
  } catch (error) {
    console.error('Error fetching TV details:', error);
    res.status(500).json({ message: 'Error fetching TV details' });
  }
});
  


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
