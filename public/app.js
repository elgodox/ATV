let currentPage = 1;
let totalResults = 0;
let isLoading = false;
let originalDescription = '';
let spanishDescription = '';
let originalTitle = '';
let spanishTitle = '';
let selectedAccount;
let showingFavorites = false; 
let stallTimeoutId = null;
window.localSubtitleBlobUrls = []; // Initialize for storing local subtitle blob URLs
let currentTorrentInfo = null;
let currentVideoPlayer = null;
let statsInterval = null; // Variable global para el interval de estadísticas

// Variables para controlar solicitudes concurrentes
let pendingTorrentRequests = new Map();

// Función auxiliar para formatear bytes a tamaños legibles
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Notification System
function showNotification(message, type = 'info', duration = 4000) {
  const notification = document.getElementById('notification');
  const messageElement = document.getElementById('notification-message');
  const container = document.getElementById('notification-container');
  
  // Set message and type
  messageElement.textContent = message;
  notification.className = `notification ${type}`;
  
  // Show notification
  notification.classList.remove('hidden');
  setTimeout(() => notification.classList.add('show'), 10);
  
  // Auto hide after duration
  const hideTimeout = setTimeout(() => {
    hideNotification();
  }, duration);
  
  // Setup close button
  document.getElementById('notification-close').onclick = () => {
    clearTimeout(hideTimeout);
    hideNotification();
  };
}

function hideNotification() {
  const notification = document.getElementById('notification');
  notification.classList.remove('show');
  setTimeout(() => {
    notification.classList.add('hidden');
  }, 300);
}

// Test function for debugging and verification
function testVideoStreamingFeatures() {
  console.log('Testing Video Streaming Features...');
  
  // Test notification system
  showNotification('Testing notification system', 'info', 2000);
  
  setTimeout(() => {
    showNotification('Success notification test', 'success', 2000);
  }, 2500);
  
  setTimeout(() => {
    showNotification('Warning notification test', 'warning', 2000);
  }, 5000);
  
  setTimeout(() => {
    showNotification('Error notification test', 'error', 2000);
  }, 7500);
  
  // Test subtitle controls
  const subtitleElements = [
    'language-select',
    'search-subtitles-btn', 
    'online-subtitle-select',
    'subtitle-file',
    'uploaded-subtitle-select',
    'enable-subtitles-btn',
    'disable-subtitles-btn'
  ];
  
  const missingElements = subtitleElements.filter(id => !document.getElementById(id));
  
  if (missingElements.length > 0) {
    console.warn('Missing subtitle elements:', missingElements);
    showNotification(`Missing subtitle elements: ${missingElements.join(', ')}`, 'warning');
  } else {
    console.log('All subtitle elements found');
    showNotification('All subtitle controls are available', 'success');
  }
}

// Elementos del DOM
const elements = {
  movieGrid: document.getElementById("movie-grid"),
  currentPage: document.getElementById("current-page"),
  genreSelect: document.getElementById("genre"),
  typeSelect: document.getElementById("type"),
  modal: document.getElementById("modal"),
  modalTitle: document.getElementById("modal-title"),
  modalDescription: document.getElementById("modal-description"),
  modalTrailer: document.getElementById("modal-trailer"),
  platformSelect: document.getElementById("platform"),
  sortSelect: document.getElementById("sort")

};

document.getElementById("type").addEventListener("change", applyFilters);
document.getElementById("genre").addEventListener("change", applyFilters);
document.getElementById("platform").addEventListener("change", applyFilters);
document.getElementById("sort").addEventListener("change", applyFilters);
document.getElementById('type').addEventListener('change', updateGenreSelect);
document.getElementById('connect-metamask').addEventListener('click', connectMetaMask);


// Función para obtener todos los proveedores
async function fetchProviders(type) {
  try {
    const response = await fetch(`/api/providers?type=${type}`);
    const data = await response.json();

    // Limpiar el selector de plataformas antes de llenarlo
    elements.platformSelect.innerHTML = '<option value="">Todas</option>'; // Limpiar antes de cargar nuevos datos

    if (data.results.length > 0) {
      data.results.forEach((provider) => {
        const option = document.createElement("option");
        option.value = provider.provider_id; // Usamos el ID del proveedor para filtrar
        option.textContent = provider.provider_name; // Nombre del proveedor
        elements.platformSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Error fetching providers:", error);
  }
}


// Función genérica para hacer solicitudes a la API
async function fetchData(endpoint, params = '') {
  try {
    const response = await fetch(`/api/${endpoint}?${params}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

// Obtener géneros y actualizar el menú de géneros
async function fetchGenres() {
  const data = await fetchData('genres');
  if (data.genres && data.genres.length > 0) {
    elements.genreSelect.innerHTML = '<option value="">Todos</option>';
    data.genres.forEach((genre) => {
      const option = document.createElement('option');
      option.value = genre.id;
      option.textContent = genre.name;
      elements.genreSelect.appendChild(option);
    });
  }
}

// Obtener géneros desde el servidor según el tipo de contenido
async function getGenres(type) {
  try {
    const response = await fetch(`/api/genres/${type}`);
    if (!response.ok) {
      throw new Error('Error fetching genres');
    }
    const genres = await response.json();
    return genres;  // Devolver la lista de géneros
  } catch (error) {
    console.error('Error fetching genres:', error);
    return [];
  }
}

// Actualizar el select de géneros según el tipo de contenido (movie o tv)
async function updateGenreSelect() {
  const type = document.getElementById('type').value;  // Obtener el tipo seleccionado
  const genres = await getGenres(type);  // Obtener los géneros desde el servidor
  const genreSelect = document.getElementById('genre');

  // Limpiar el select de géneros
  genreSelect.innerHTML = '<option value="">Todos</option>';

  // Añadir los géneros al select
  genres.forEach(genre => {
    const option = document.createElement('option');
    option.value = genre.id;
    option.textContent = genre.name;
    genreSelect.appendChild(option);
  });
}



// Función para obtener títulos y mostrarlos
async function getTitles(page = 1) {
  if (isLoading) return;
  isLoading = true;

  const type = document.getElementById('type').value;
  const genre = document.getElementById('genre').value;
  const platform = document.getElementById('platform').value;
  const sortBy = document.getElementById('sort').value;
  const searchQuery = document.getElementById('search-bar') ? document.getElementById('search-bar').value.trim() : '';

  if (page === 1) {
    elements.movieGrid.innerHTML = ''; // Limpiar el grid al cambiar de página
  }

  let data;
  
  // Verificar si el filtro de favoritos está activo
  if (showingFavorites) {
    const favorites = JSON.parse(localStorage.getItem(selectedAccount)) || [];

    // Filter favorites by the current type (movie or tv)
    const filteredFavorites = favorites.filter(fav => fav.type === type);

    if (filteredFavorites.length === 0) {
        elements.movieGrid.innerHTML = '<p>No tienes favoritos en esta categoría.</p>';
        isLoading = false;
        return;
    }

    // Obtener los detalles de cada película/serie en la lista de favoritos
    data = { results: [] };

    for (let favorite of filteredFavorites) {
        const response = await fetch(`/api/titles/details?id=${favorite.id}&type=${type}&language=en`);
        const movie = await response.json();
        if (movie) {
            data.results.push(movie);
        }
    }
} else {
    // Si no está activo el filtro de favoritos, llamamos a la API normal
    const params = new URLSearchParams({
      type,
      searchQuery,
      genre,
      platform,
      sortBy,
      page
    }).toString();

    data = await fetchData('titles', params); // Llamada a la API
  }

  // Validar que tengamos resultados
  if (!data || !data.results || data.results.length === 0) {
    if (currentPage === 1) elements.movieGrid.innerHTML = '<p>No se encontraron resultados.</p>';
    isLoading = false;
    return;
  }

  totalResults = data.total_results;

  // Obtener los géneros y mapearlos por su ID
  const genreData = await fetchData('genres');
  const genreMap = {};
  genreData.genres.forEach(genre => {
    genreMap[genre.id] = genre.name;
  });

  // Iterar sobre cada título
  data.results.forEach(async (title) => {
    const movieCard = document.createElement('div');
    movieCard.id = `movie-card-${title.id}`;
    movieCard.classList.add('movie-card');

    // Obtener los géneros de la película/serie
    const movieGenres = title.genre_ids ? title.genre_ids.map(id => genreMap[id]).join(', ') : title.genres.map(genre => genre.name).join(', ');

    // Obtener las plataformas disponibles
    const providers = await fetchProvider(title.id, type);
    const providerNames = providers ? providers.join(', ') : 'No disponible';

    // Verificar el título y la fecha según si es película o serie de TV
    const titleName = title.original_title || title.original_name || 'Título desconocido';
    const releaseDate = title.release_date || title.first_air_date || 'Fecha desconocida';

    let seasons = '';
    let status = '';

    if (type === 'tv') {
      const tvDetails = await fetchTVDetails(title.id);
      seasons = tvDetails ? `${tvDetails.number_of_seasons} Temporadas` : 'N/A';
      status = tvDetails ? (tvDetails.status === 'Ended' ? 'Finalizada' : 'En emisión') : 'Estado desconocido';
    }

    const stars = renderStars(title.vote_average);

    

    movieCard.innerHTML = `
    <img src="https://image.tmdb.org/t/p/w500${title.poster_path}" alt="${titleName}">
    <h3>${titleName}</h3>
    <p><strong>Estreno:</strong> ${releaseDate}</p>
    <p><strong>Género:</strong> ${movieGenres}</p>
    ${seasons ? `<p><strong>Temporadas:</strong> ${seasons}</p>` : ''}
    ${status ? `<p><strong>Estado:</strong> ${status}</p>` : ''}
    <p><strong>Plataformas:</strong> ${providerNames}</p>
    <p><strong>Valoración:</strong> ${stars}</p>
  
    <!-- Contenedor para los íconos alineados a la derecha -->
    <div class="card-icons">
      <i id="heart-icon-${title.id}" 
         class="fas fa-heart" 
         style="cursor: pointer; color: ${isFavorite(title.id, type) ? 'red' : 'black'};" 
         onclick="toggleFavorite(${title.id}, '${type}', event)"></i>
      <i id="eye-icon-${title.id}" 
         class="fas fa-eye" 
         style="cursor: pointer; color: ${isWatched(title.id, type) ? 'blue' : 'black'};" 
         onclick="toggleWatched(${title.id}, '${type}', event)"></i>
    </div>
  `;
  

    if (isWatched(title.id, type)) {
      movieCard.classList.add('watched');
    } else {
      movieCard.classList.remove('watched');
    }

    movieCard.addEventListener('click', () => {
      showDetails(title.id, type, movieCard);
    });

    elements.movieGrid.appendChild(movieCard);
  });

  isLoading = false; // Marcamos como terminado
}


function toggleWatched(movieId, type, event) {
  event.stopPropagation(); // Evita que se abra el modal al hacer clic en el ícono

  if (!selectedAccount) {
    alert("Primero debes conectar MetaMask");
    return;
  }

  let watched = JSON.parse(localStorage.getItem(selectedAccount + '-watched')) || [];
  const watchedIndex = watched.findIndex(item => item.id === movieId && item.type === type);
  
  const movieCard = document.querySelector(`#movie-card-${movieId}`);

  if (watchedIndex !== -1) {
    // Si ya está en la lista de vistos, quitarlo
    watched.splice(watchedIndex, 1);
    document.getElementById(`eye-icon-${movieId}`).style.color = 'black'; // Cambia el color del ícono de "visto"
    movieCard.classList.remove('watched'); // Quitar la clase que oscurece la tarjeta
  } else {
    // Si no está en la lista, agregarlo
    watched.push({ id: movieId, type: type });
    document.getElementById(`eye-icon-${movieId}`).style.color = 'blue'; // Cambia el color del ícono de "visto"
    movieCard.classList.add('watched'); // Oscurecer la tarjeta
  }

  // Guardar el estado actualizado en el localStorage
  localStorage.setItem(selectedAccount + '-watched', JSON.stringify(watched));

 // updateMovieGrid();
}



function isWatched(movieId, type) {
  let watched = JSON.parse(localStorage.getItem(selectedAccount + '-watched')) || [];
  return watched.some(item => item.id === movieId && item.type === type);
}

function updateMovieGrid() {
  const movieCards = document.querySelectorAll('.movie-card');
  
  movieCards.forEach(card => {
    const movieId = card.getAttribute('data-id');
    const type = card.getAttribute('data-type');
    
    if (isWatched(movieId, type)) {
      card.classList.add('watched');
    } else {
      card.classList.remove('watched');
    }
  });
}



// Detectar cuando estamos cerca del final de la página
window.addEventListener('scroll', () => {
  if (showingFavorites) {
    // Si el filtro de favoritos está activado, no hacer nada en el scroll
    return;
}
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && !isLoading) {
    currentPage++;
    getTitles(currentPage);
  }
});

// Verifica si la película está en favoritos
function isFavorite(movieId, type) {
  let favorites = JSON.parse(localStorage.getItem(selectedAccount)) || [];
  return favorites.some(fav => fav.id === movieId && fav.type === type);
}
// Función para obtener los detalles completos de una serie de TV
async function fetchTVDetails(tvId) {
  try {
    const response = await fetch(`/api/tv/details/${tvId}`);
    if (!response.ok) {
      throw new Error('Error al obtener los detalles de la serie de TV');
    }
    const data = await response.json();
    return data;  // Devolver los detalles completos de la serie
  } catch (error) {
    console.error('Error fetching TV details:', error);
    return null;
  }
}



let currentImdbId = null; // Variable global para guardar el ID de IMDb

// Función para obtener detalles y mostrar el modal
async function showDetails(id, type, movieCard) {

  document.getElementById('loading-screen').style.display = 'flex';
  const lottiePlayer = document.querySelector('lottie-player');
  lottiePlayer.stop();  // Detener la animación
  lottiePlayer.play();  // Reproducir la animación desde el principio

  // Deshabilitar la tarjeta de la película temporalmente
  movieCard.style.pointerEvents = 'none'; // Deshabilita clics en la tarjeta
  movieCard.classList.add('disabled'); // Opcional: añadir una clase para aplicar estilos visuales

  try {
    // Cargar los detalles en el idioma original
    const urlOriginal = `/api/titles/details?id=${id}&type=${type}&language=en`;
    const dataOriginal = await fetch(urlOriginal).then(response => response.json());

    // Guardar el ID de IMDb
    currentImdbId = dataOriginal.imdb_id;

    // Cargar los detalles en español
    const urlSpanish = `/api/titles/details?id=${id}&type=${type}&language=es`;
    const dataSpanish = await fetch(urlSpanish).then(response => response.json());

    // Guardar el título y la descripción
    originalTitle = dataOriginal.original_title || dataOriginal.original_name || "No Title";
    spanishTitle = dataSpanish.title || dataSpanish.name || originalTitle; // Si no hay traducción, usa el original
    originalDescription = dataOriginal.overview || "No description available in English.";
    spanishDescription = dataSpanish.overview || "No hay descripción disponible en español.";

    // Mostrar el título con la traducción entre paréntesis y el toggle a la izquierda
    elements.modalTitle.innerHTML = `
  <div class="modal-header-content">
    <span id="modal-title-text">${originalTitle} <span id="translated-title">(${spanishTitle})</span></span>
    <div class="header-controls">
      <div class="toggle-container">
  <input type="checkbox" id="toggle-language" class="toggle" onclick="toggleDescriptionLanguage()">
  <label for="toggle-language" class="toggle-switch"></label>
</div>

  </div>
`;

    // Mostrar la descripción en español inicialmente
    elements.modalDescription.innerHTML = `<p id="description-text">${spanishDescription}</p>`;

    // Intentar buscar tráiler en el servidor (primero YouTube, luego Vimeo)

    const youtubeTrailer = await fetch(`/api/youtube-trailer?title=${encodeURIComponent(originalTitle)}`).then(response => response.json());

    if (youtubeTrailer.videoId) {
      // Mostrar tráiler de YouTube si se encuentra
      elements.modalTrailer.innerHTML = `<iframe src="https://www.youtube.com/embed/${youtubeTrailer.videoId}" frameborder="0" allowfullscreen></iframe>`;
    } else {
      // Si no se encuentra en YouTube, intentar buscar en Vimeo
      const vimeoTrailer = await fetch(`/api/vimeo-trailer?title=${encodeURIComponent(originalTitle)}`).then(response => response.json());
      if (vimeoTrailer.videoId) {
        elements.modalTrailer.innerHTML = `<iframe src="https://player.vimeo.com/video/${vimeoTrailer.videoId}" frameborder="0" allowfullscreen></iframe>`;
      } else {
        elements.modalTrailer.innerHTML = "<p>No hay tráiler disponible.</p>";
      }
    }

    // Mostrar los detalles adicionales (Géneros, Temporadas, Estado, Plataformas, Valoración)

    // Obtener géneros
    const genres = dataOriginal.genres ? dataOriginal.genres.map(genre => genre.name).join(', ') : 'Sin género';

    // Obtener las plataformas disponibles
    const providers = await fetchProvider(id, type);
    const providerNames = providers ? providers.join(', ') : 'No disponible';

    // Obtener el número de temporadas y estado si es una serie de TV
    let seasons = '';
    let status = '';
    if (type === 'tv') {
      seasons = dataOriginal.number_of_seasons ? `${dataOriginal.number_of_seasons} Temporadas` : 'N/A';
      status = dataOriginal.status === 'Ended' ? 'Finalizada' : 'En emisión';
    }

    // Renderizar la valoración con estrellas
    const stars = renderStars(dataOriginal.vote_average);

    // Agregar los detalles adicionales debajo de la descripción pero encima de los torrents
    elements.modalDescription.insertAdjacentHTML('beforeend', `
      <div class="movie-details">
        <p><strong>Género:</strong> ${genres}</p>
        ${type === 'tv' ? `<p><strong>Temporadas:</strong> ${seasons}</p>` : ''}
        ${type === 'tv' ? `<p><strong>Estado:</strong> ${status}</p>` : ''}
        <p><strong>Plataformas:</strong> ${providerNames}</p>
        <p><strong>Valoración:</strong> ${stars}</p>
      </div>
    `);

    // Si es una película, buscar torrents en YTS
    if (type === "movie") {
      await fetchTorrents(dataOriginal.title);
    }

    // Mostrar el modal
    elements.modal.style.display = 'block';

  } catch (error) {
    console.error("Error mostrando detalles:", error);
  } finally {
    document.getElementById('loading-screen').style.display = 'none';
    // Rehabilitar la tarjeta de la película después de mostrar los detalles
    movieCard.style.pointerEvents = 'auto';  // Habilita nuevamente los clics
    movieCard.classList.remove('disabled');  // Opcional: quitar la clase de deshabilitación
  }
}


async function fetchProvider(movieId, type) {
  try {
    const response = await fetch(`/api/${type}/${movieId}/watch/providers`);
    if (!response.ok) {
      throw new Error(`Error fetching providers: ${response.statusText}`);
    }

    const data = await response.json();

    // Verificar si está disponible en Argentina (AR)
    const providersAR = data.results?.AR?.flatrate || [];  // Plataformas en Argentina

    if (providersAR.length > 0) {
      // Si está disponible en Argentina, devolvemos los proveedores con la etiqueta "AR"
      return providersAR.map(provider => `${provider.provider_name} (AR)`);
    } else {
      // Si no está disponible en Argentina, buscamos en otras regiones
      const availableRegions = Object.keys(data.results);
      let otherProviders = [];

      // Iteramos sobre las regiones y obtenemos los proveedores de la primera región que tenga disponibilidad
      for (const region of availableRegions) {
        const providers = data.results[region]?.flatrate || [];
        if (providers.length > 0) {
          otherProviders = providers.map(provider => `${provider.provider_name} (${region})`);
          break;
        }
      }

      // Si encontramos proveedores en otras regiones, los devolvemos
      return otherProviders.length > 0 ? otherProviders : ['No disponible'];
    }
  } catch (error) {
    console.error('Error fetching providers:', error);
    return ['Error al obtener proveedores'];
  }
}


// Función para alternar entre la descripción en español y la descripción original
function toggleDescriptionLanguage() {
  const descriptionText = document.getElementById('description-text');
  const translatedTitle = document.getElementById('translated-title');
  const toggleLanguage = document.getElementById('toggle-language');

  if (!toggleLanguage.checked) {
    // Mostrar en español cuando el toggle está desactivado (es)
    descriptionText.textContent = spanishDescription;
    translatedTitle.textContent = `(${spanishTitle})`;
  } else {
    // Mostrar en inglés cuando el toggle está activado (en)
    descriptionText.textContent = originalDescription;
    translatedTitle.textContent = "";
  }
}



// Función para renderizar estrellas
function renderStars(voteAverage) {
  const starCount = Math.round(voteAverage / 2);  // Convertir de 0-10 a 0-5 estrellas
  let stars = '';

  // Crear las estrellas llenas
  for (let i = 0; i < starCount; i++) {
    stars += '<i class="fas fa-star"></i>';  // Usar un ícono de estrella llena
  }

  // Crear las estrellas vacías
  for (let i = starCount; i < 5; i++) {
    stars += '<i class="far fa-star"></i>';  // Usar un ícono de estrella vacía
  }

  return stars;
}

// Función para obtener torrents de YTS según el título de la película
async function fetchTorrents(movieTitle) {
  try {
    const response = await fetch(`/api/torrents?movieTitle=${encodeURIComponent(movieTitle)}`);

    if (!response.ok) {
      // Manejar 404 (no torrents encontrados) de forma amigable
      if (response.status === 404) {
        elements.modalDescription.insertAdjacentHTML(
          "beforeend",
          "<p>No hay torrents disponibles para esta película.</p>"
        );
        return;
      } else {
        throw new Error('Error fetching torrents');
      }
    }

    const data = await response.json();

    if (data.length > 0) {
      const movie = data[0];
      const torrents = movie.torrents;
      torrents.sort((a, b) => {
        const qualityOrder = ["4K", "1080p", "720p"];
        return qualityOrder.indexOf(a.quality) - qualityOrder.indexOf(b.quality);
      });
      let torrentButtons = `
        <div class="torrent-quote">
          <h3>Torrents disponibles</h3>
          <div class="torrent-buttons">
      `;
      torrents.forEach((torrent) => {
        const magnetLink = `magnet:?xt=urn:btih:${torrent.hash}&dn=${encodeURIComponent(movieTitle)}&tr=udp://tracker.openbittorrent.com:80/announce`;
        torrentButtons += `
            <button class="torrent-button" data-quality="${torrent.quality}" onclick="showTorrentOptions('${magnetLink}', '${movieTitle}')">
              <span class="torrent-quality">${torrent.quality}</span>
              <span class="torrent-size">${torrent.size}</span>
            </button>
        `;
      });
      torrentButtons += `</div></div>`;
      elements.modalDescription.insertAdjacentHTML("beforeend", torrentButtons);
    } else {
      elements.modalDescription.insertAdjacentHTML(
        "beforeend",
        '<div class="no-torrents-message">No hay torrents disponibles para esta película.</div>'
      );
    }
  } catch (error) {
    // Mostrar mensaje de error amigable en el modal
    elements.modalDescription.insertAdjacentHTML(
      "beforeend",
      `<div class="no-torrents-message" style="background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%); border-color: #f44336; color: #ffebee;">
        <span style="font-size: 2em; display: block; margin-bottom: 10px;">⚠️</span>
        No se pudieron obtener torrents. Intenta más tarde.
      </div>`
    );
    console.error("Error fetching torrents:", error);
  }
}

// Función para iniciar el reproductor de video WebTorrent
function startPlayer(magnetLink, movieTitle) {
  const playerContainer = document.getElementById('video-player-container');
  const videoPlayer = document.getElementById('video-player');
  const torrentQuote = document.querySelector('.torrent-quote'); // Selector para el contenedor de botones de torrents
  const loadingIndicator = document.getElementById('player-loading-indicator');
  const torrentStatsDiv = document.getElementById('torrent-stats');
  const torrentPeersSpan = document.getElementById('torrent-peers');
  const torrentProgressSpan = document.getElementById('torrent-progress');
  const torrentDownloadSpeedSpan = document.getElementById('torrent-download-speed');
  const playerStatusMessage = document.getElementById('player-status-message');
  const playerLoadingIndicator = document.getElementById('player-loading-indicator'); // Explicitly get for clarity
  const localSubtitleUploadContainer = document.getElementById('local-subtitle-upload-container');
  const subtitleUploadInput = document.getElementById('subtitle-upload-input');

  // Check if essential elements exist
  if (!playerContainer) {
    showNotification('Error: No se encontró el contenedor del reproductor', 'error');
    console.error('video-player-container element not found');
    return;
  }
  
  if (!videoPlayer) {
    showNotification('Error: No se encontró el elemento de video', 'error');
    console.error('video-player element not found');
    return;
  }

  // Show the video modal first
  const videoModal = document.getElementById('video-modal');
  if (videoModal) {
    videoModal.style.display = 'block';
  } else {
    showNotification('Error: No se encontró el modal de video', 'error');
    console.error('video-modal element not found');
    return;
  }

  // Show initial broad status
  if (playerLoadingIndicator) {
    playerLoadingIndicator.textContent = 'Fetching torrent metadata...';
    playerLoadingIndicator.style.display = 'block';
  }
  if (playerStatusMessage) {
    playerStatusMessage.style.display = 'none'; // Ensure specific status is hidden initially
  }
  if (localSubtitleUploadContainer) { // Hide initially
      localSubtitleUploadContainer.style.display = 'none';
  }
  if (torrentStatsDiv) {
    torrentStatsDiv.style.display = 'none';
  }

  if (torrentQuote) {
    torrentQuote.style.display = 'none'; // Ocultar contenedor de botones de torrents
  }
  
  // The playerContainer is already visible within the modal, no need to show it separately
  const client = new WebTorrent();
  window.currentTorrentClient = client; // Guardar cliente globalmente

  // Add error handling for the WebTorrent client
  client.on('error', (err) => {
    console.error('WebTorrent client error:', err);
    showNotification('Error del cliente torrent: ' + err.message, 'error');
    if (playerLoadingIndicator) playerLoadingIndicator.style.display = 'none';
    if (playerStatusMessage) {
      playerStatusMessage.textContent = 'Error de conexión torrent';
      playerStatusMessage.style.display = 'block';
    }
  });

  showNotification('Conectando al torrent...', 'info', 3000);  client.add(magnetLink, (torrent) => {
    showNotification(`Torrent conectado: ${torrent.name}`, 'success');
    
    // Add error handling for the torrent
    torrent.on('error', (err) => {
      console.error('Torrent error:', err);
      showNotification('Error del torrent: ' + err.message, 'error');
      if (playerLoadingIndicator) playerLoadingIndicator.style.display = 'none';
      if (playerStatusMessage) {
        playerStatusMessage.textContent = 'Error del torrent';
        playerStatusMessage.style.display = 'block';
      }
    });

    if (playerLoadingIndicator) { // Use the more specific variable name
      playerLoadingIndicator.textContent = 'Video loading...'; // General status that video is now the focus
    }    if (torrentStatsDiv) {
      torrentStatsDiv.style.display = 'block'; // Mostrar estadísticas
    }
    
    // Add null checks for torrent stat elements
    if (torrentPeersSpan) {
      torrentPeersSpan.textContent = `Peers: ${torrent.numPeers}`; // Initial peer count
    }

    if (playerStatusMessage) {
      if (torrent.numPeers === 0) {
          playerStatusMessage.textContent = 'Waiting for peers...';
          playerStatusMessage.style.display = 'block';
      } else {
          playerStatusMessage.textContent = `Connected to ${torrent.numPeers} peers.`;
          playerStatusMessage.style.display = 'block';
      }
    }

    const STALL_TIMEOUT_DURATION = 60000; // 60 seconds
    if (stallTimeoutId) clearTimeout(stallTimeoutId); // Clear previous timeout just in case
    stallTimeoutId = setTimeout(() => {
        const currentVideoPlayer = document.getElementById('video-player'); // Re-fetch in timeout scope
        if (currentVideoPlayer && currentVideoPlayer.paused && torrent.progress < 0.1 && torrent.numPeers < 2) {
            console.warn('Torrent stalled, timeout reached.');
            if (playerLoadingIndicator) playerLoadingIndicator.style.display = 'none';
            if (playerStatusMessage) {
                playerStatusMessage.textContent = 'Torrent seems stalled or very slow. Try another torrent or check your connection.';
                playerStatusMessage.style.display = 'block';
            }
            if (torrentStatsDiv) torrentStatsDiv.style.display = 'block';
        }
    }, STALL_TIMEOUT_DURATION);    torrent.on('download', bytes => {
      if (torrentDownloadSpeedSpan) {
        torrentDownloadSpeedSpan.textContent = `Speed: ${(torrent.downloadSpeed / 1024).toFixed(2)} kB/s`;
      }
      if (torrentProgressSpan) {
        torrentProgressSpan.textContent = `Progress: ${(torrent.progress * 100).toFixed(2)}%`;
      }
      if (torrentPeersSpan) {
        torrentPeersSpan.textContent = `Peers: ${torrent.numPeers}`;
      }
    });

    torrent.on('upload', bytes => {
      // Opcional: Mostrar velocidad de subida
    });

    torrent.on('wire', function onWire(wire, addr) {
        if (playerStatusMessage) {
            playerStatusMessage.textContent = `Connected to ${torrent.numPeers} peers.`;
            playerStatusMessage.style.display = 'block';
        }
        if (torrentPeersSpan) {
          torrentPeersSpan.textContent = `Peers: ${torrent.numPeers}`;
        }
    });

    // Enhanced file selection logic starts
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv'];
    let videoFiles = torrent.files.filter(f => {
        return videoExtensions.some(ext => f.name.toLowerCase().endsWith(ext));
    });    if (videoFiles.length === 0) {
        clearTimeout(stallTimeoutId);
        if (playerLoadingIndicator) playerLoadingIndicator.style.display = 'none';
        if (playerStatusMessage) {
            playerStatusMessage.textContent = 'No video files found in this torrent.'; // More specific than "No compatible..."
            playerStatusMessage.style.display = 'block';
        }
        if (torrentStatsDiv) torrentStatsDiv.style.display = 'none';
        showNotification('No se encontraron archivos de video en este torrent', 'error');
        return; // Exit from client.add callback
    }

    let selectedFile = null;
    if (videoFiles.length === 1) {
        selectedFile = videoFiles[0];
    } else {
        let preferredFiles = videoFiles.filter(f =>
            !/\b(sample|trailer|teaser|extras?|bonus)\b/i.test(f.name)
        );

        if (preferredFiles.length === 0) {
            preferredFiles = videoFiles;
        }

        preferredFiles.sort((a, b) => b.length - a.length);
        selectedFile = preferredFiles[0];

        console.log("Multiple video files found. Auto-selected:", selectedFile.name);
        // Optional: message about auto-selection
        // if (playerStatusMessage) {
        //     playerStatusMessage.textContent = `Auto-selected: ${selectedFile.name}. Playing...`;
        //     playerStatusMessage.style.display = 'block';
        // }
    }    if (!selectedFile) {
        clearTimeout(stallTimeoutId);
        if (playerLoadingIndicator) playerLoadingIndicator.style.display = 'none';
        if (playerStatusMessage) {
            playerStatusMessage.textContent = 'Could not select a video file.';
            playerStatusMessage.style.display = 'block';
        }
        if (torrentStatsDiv) torrentStatsDiv.style.display = 'none';
        showNotification('No se pudo seleccionar un archivo de video', 'error');
        return; // Exit from client.add callback
    }

    // Refined cleanup for video player
    // const videoPlayer = document.getElementById('video-player'); // Already available in this scope
    const oldSources = videoPlayer.getElementsByTagName('source');
    while (oldSources.length > 0) {
        videoPlayer.removeChild(oldSources[0]);
    }
    const oldTracks = videoPlayer.getElementsByTagName('track');
    while (oldTracks.length > 0) {
        videoPlayer.removeChild(oldTracks[0]);
    }
    videoPlayer.src = '';
    videoPlayer.load(); // Reset the player state after clearing sources/tracks

    // Logic to find and add subtitle tracks from torrent files
    const videoFileNameWithoutExt = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) || selectedFile.name;
    const subtitleExtensions = ['.srt', '.vtt'];

    torrent.files.forEach(torrentFile => { // Renamed 'file' to 'torrentFile' to avoid scope collision
        const fileExtension = torrentFile.name.substring(torrentFile.name.lastIndexOf('.')).toLowerCase();
        const fileNameWithoutExt = torrentFile.name.substring(0, torrentFile.name.lastIndexOf('.')) || torrentFile.name;

        if (subtitleExtensions.includes(fileExtension) && fileNameWithoutExt.toLowerCase().startsWith(videoFileNameWithoutExt.toLowerCase())) {
            // Found a potential subtitle file matching the video file name
            torrentFile.getBlobURL((err, blobUrl) => {
                if (err) {
                    console.error('Error getting blob URL for subtitle file:', torrentFile.name, err);
                    return;
                }

                const trackElement = document.createElement('track');
                trackElement.kind = 'subtitles';

                const nameParts = fileNameWithoutExt.toLowerCase().split('.');
                let lang = nameParts.length > 1 ? nameParts[nameParts.length - 1] : 'en';
                if (lang.length !== 2 && lang.length !== 3) {
                    lang = 'en';
                }

                trackElement.srclang = lang;
                trackElement.label = `${torrentFile.name} (${lang.toUpperCase()})`;
                trackElement.src = blobUrl;
                // trackElement.default = true; // Optionally make the first found subtitle default

                // videoPlayer is already defined in the outer scope of startPlayer
                videoPlayer.appendChild(trackElement);
                console.log('Added subtitle track:', torrentFile.name, 'Lang:', lang);
            });
        }
    });

    selectedFile.appendTo(videoPlayer, err => {
        if (err) {
            clearTimeout(stallTimeoutId);
            console.error('Error appending video file:', err);
            if (playerLoadingIndicator) playerLoadingIndicator.style.display = 'none';
            if (playerStatusMessage) {
                playerStatusMessage.textContent = 'Error playing video file: ' + err.message;
                playerStatusMessage.style.display = 'block';
            }
            if (torrentStatsDiv) torrentStatsDiv.style.display = 'none';
            return;
        }

        videoPlayer.oncanplay = () => {
            if (playerLoadingIndicator) playerLoadingIndicator.style.display = 'none';
            if (playerStatusMessage) playerStatusMessage.style.display = 'none';
            if (localSubtitleUploadContainer) { // Show subtitle upload oncanplay
                localSubtitleUploadContainer.style.display = 'block';
            }
        };

        videoPlayer.onplaying = () => {
            clearTimeout(stallTimeoutId);
            if (playerLoadingIndicator) playerLoadingIndicator.style.display = 'none';
            if (playerStatusMessage) playerStatusMessage.style.display = 'none';
        };
    });
    // Enhanced file selection logic ends
  });
  client.on('error', err => {
    clearTimeout(stallTimeoutId);
    console.error('Torrent client error:', err);
    if (playerLoadingIndicator) {
      playerLoadingIndicator.style.display = 'none';
    }
    let specificError = 'Error loading torrent. Please try another one.';
    let notificationMessage = 'Error cargando torrent. Intenta con otro.';
    
    if (err.message.includes('invalid magnet URI') || err.message.includes('Invalid torrent identifier')) {
        specificError = 'Invalid torrent link. Please try another one.';
        notificationMessage = 'Enlace de torrent inválido. Intenta con otro.';
    } else if (err.message.includes('connection error') || err.message.includes('timed out')) {
        specificError = 'Network connection error. Check your internet and try again.';
        notificationMessage = 'Error de conexión. Verifica tu internet e intenta de nuevo.';
    }
    
    showNotification(notificationMessage, 'error');
    
    if (playerStatusMessage) {
      playerStatusMessage.textContent = specificError;
      playerStatusMessage.style.display = 'block';
    }
    if (torrentStatsDiv) {
      torrentStatsDiv.style.display = 'none'; // Hide stats on error
    }
    // Opcional: Ocultar el reproductor y mostrar los botones de torrent nuevamente
    // playerContainer.style.display = 'none';
    // if (torrentQuote) torrentQuote.style.display = 'block';
  });

  if (subtitleUploadInput) { // Ensure element exists before adding listener
    subtitleUploadInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const currentVideoPlayer = document.getElementById('video-player');
        const existingTracks = currentVideoPlayer.getElementsByTagName('track');
        const localSubUrl = URL.createObjectURL(file);

        const trackElement = document.createElement('track');
        trackElement.kind = 'subtitles';
        trackElement.label = file.name + " (Local)";

        let lang = 'en';
        const nameParts = file.name.toLowerCase().split('.');
        if (nameParts.length > 2 && nameParts[nameParts.length - 2].length >= 2 && nameParts[nameParts.length - 2].length <= 3) {
            lang = nameParts[nameParts.length - 2];
        }
        trackElement.srclang = lang;
        trackElement.src = localSubUrl;

        for (let i = 0; i < existingTracks.length; i++) {
            existingTracks[i].default = false;
        }
        trackElement.default = true;

        currentVideoPlayer.appendChild(trackElement);

        if (!window.localSubtitleBlobUrls) {
            window.localSubtitleBlobUrls = [];
        }
        window.localSubtitleBlobUrls.push(localSubUrl);
        event.target.value = null;

        alert('Local subtitle "' + file.name + '" added. Use video player controls to select/deselect subtitles.');
    });
  }
}


// Función para cerrar el modal
async function closeModal() {
  elements.modal.style.display = "none";
  elements.modalTrailer.innerHTML = ""; // Limpiar tráiler cuando se cierra el modal

  if (stallTimeoutId) {
    clearTimeout(stallTimeoutId);
    stallTimeoutId = null;
  }

  // Limpiar estadísticas si están corriendo
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }

  // Detener y limpiar el torrent del servidor si tenemos información del torrent actual
  if (currentTorrentInfo && currentTorrentInfo.infoHash) {
    try {
      console.log(`Stopping torrent from modal close: ${currentTorrentInfo.infoHash}`);
      
      const response = await fetch(`/api/torrent/stop/${currentTorrentInfo.infoHash}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Torrent stopped from modal close:', result);
      } else {
        console.warn('Failed to stop torrent from modal close:', response.status);
      }
    } catch (error) {
      console.error('Error stopping torrent from modal close:', error);
    }
  }

  // Lógica para limpiar el reproductor de WebTorrent
  if (window.currentTorrentClient) {
    window.currentTorrentClient.destroy(err => {
      if (err) console.error("Error destruyendo el cliente de WebTorrent:", err);
    });
    window.currentTorrentClient = null;

    const playerContainer = document.getElementById('player-container');
    const videoPlayer = document.getElementById('video-player');
    const torrentQuote = document.querySelector('.torrent-quote');
    const playerLoadingIndicator = document.getElementById('player-loading-indicator');
    const torrentStatsDiv = document.getElementById('torrent-stats');
    const playerStatusMessage = document.getElementById('player-status-message');
    const localSubtitleUploadContainer = document.getElementById('local-subtitle-upload-container');

    if (playerLoadingIndicator) {
        playerLoadingIndicator.textContent = 'Loading torrent...';
        playerLoadingIndicator.style.display = 'none';
    }
    if (playerStatusMessage) {
        playerStatusMessage.textContent = '';
        playerStatusMessage.style.display = 'none';
    }
    if (localSubtitleUploadContainer) {
        localSubtitleUploadContainer.style.display = 'none';
    }
    if (window.localSubtitleBlobUrls && window.localSubtitleBlobUrls.length > 0) {
        window.localSubtitleBlobUrls.forEach(url => URL.revokeObjectURL(url));
        window.localSubtitleBlobUrls = [];
        console.log('Revoked local subtitle object URLs.');
    }

    if (torrentStatsDiv) {
        torrentStatsDiv.style.display = 'none';
        document.getElementById('torrent-peers').textContent = 'Peers: 0';
        document.getElementById('torrent-progress').textContent = 'Progress: 0%';
        document.getElementById('torrent-download-speed').textContent = 'Speed: 0 kB/s';
    }

    if (playerContainer) {
      playerContainer.style.display = 'none';
    }
    if (videoPlayer) {
      videoPlayer.pause();
      videoPlayer.src = '';
      // Detach event listeners
      videoPlayer.onplaying = null;
      videoPlayer.oncanplay = null;
      videoPlayer.load();
      while (videoPlayer.firstChild) {
        videoPlayer.removeChild(videoPlayer.firstChild);
      }
    }
    if (torrentQuote) {
      torrentQuote.style.display = 'block';
    }
  }

  // Resetear información del torrent
  currentTorrentInfo = null;
}

// Evento para actualizar los resultados cuando el usuario busca
document.getElementById("search-bar").addEventListener("input", () => {
  getTitles();
});

// Aplicar filtros y obtener títulos
function applyFilters() {
  currentPage = 1;  // Reiniciar a la primera página
  elements.movieGrid.innerHTML = '';  // Limpiar el contenedor de resultados
  getTitles(currentPage);  // Volver a cargar los títulos según los nuevos filtros
}

// Obtener el botón de Bitcoin
const btcButton = document.getElementById('btc-button');

// Agregar un evento al botón para copiar la dirección al portapapeles
btcButton.addEventListener('click', function () {
  // Obtener la dirección de Bitcoin del atributo data-btc-address
  const btcAddress = btcButton.getAttribute('data-btc-address');

  // Crear un campo de texto temporal para copiar la dirección
  const tempInput = document.createElement('input');
  tempInput.value = btcAddress;
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand('copy');
  document.body.removeChild(tempInput);

  // Cambiar el texto del botón temporalmente a "Address copied!"
  const originalText = btcButton.innerHTML;
  btcButton.innerHTML = '<i class="fab fa-bitcoin"></i> Address copied!';

  // Restaurar el texto original después de 2 segundos
  setTimeout(() => {
    btcButton.innerHTML = originalText;
  }, 2000); // Cambia el texto por 2 segundos
});

// Función para conectar a MetaMask y mostrar el filtro de favoritos si está conectado
async function connectMetaMask() {
  if (window.ethereum) {
      try {
          // Solicita la conexión a MetaMask
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          const accounts = await ethereum.request({ method: 'eth_accounts' });
          selectedAccount = accounts[0]; // Guarda la cuenta conectada
          console.log("Conectado a MetaMask:", selectedAccount);

          // Deshabilitar el botón de MetaMask y cambiar su apariencia
          const metamaskButton = document.getElementById('connect-metamask');
          metamaskButton.disabled = true;
          metamaskButton.textContent = "MetaMask Conectado";

          // Mostrar el filtro de favoritos
          document.getElementById('favorite-filter-group').style.display = 'flex';

          // Cargar los favoritos si el filtro está activado
          loadTitles();
      } catch (error) {
          console.error("Error al conectar MetaMask", error);
      }
  } else {
      alert('MetaMask no está instalado');
  }
}


async function getPlatforms(movieId) {
  try {
      const response = await fetch(`/api/movie/${movieId}/watch/providers`);
      const data = await response.json();
      const platforms = data.results?.US?.flatrate || [];
      return platforms.length > 0 ? platforms.map(p => p.provider_name).join(', ') : 'No disponible';
  } catch (error) {
      console.error('Error al obtener las plataformas:', error);
      return 'No disponible';
  }
}


// Alternar favoritos
function toggleFavorite(movieId, type, event) {
  // Evitar que el clic en el corazón se propague y abra el modal
  event.stopPropagation();

  if (!selectedAccount) {
      alert("Primero debes conectar MetaMask");
      return;
  }

  let favorites = JSON.parse(localStorage.getItem(selectedAccount)) || [];

  // Check if the favorite with the specific type is already in the list
  const favoriteIndex = favorites.findIndex(fav => fav.id === movieId && fav.type === type);

  // Agregar o quitar de favoritos
  if (favoriteIndex !== -1) {
      // Remove favorite
      favorites.splice(favoriteIndex, 1);
      document.getElementById(`heart-icon-${movieId}`).style.color = 'black'; // Cambiar a negro si se quita de favoritos
  } else {
      // Add new favorite with type
      favorites.push({ id: movieId, type: type });
      document.getElementById(`heart-icon-${movieId}`).style.color = 'red'; // Cambiar a rojo si se agrega a favoritos
  }

  // Guardar favoritos en localStorage
  localStorage.setItem(selectedAccount, JSON.stringify(favorites));

  // Actualizar la lista de favoritos (opcional)
  loadFavorites();
}



// Función para cargar los favoritos desde localStorage
function loadFavorites() {
  const favorites = JSON.parse(localStorage.getItem(selectedAccount)) || [];

  // Iterar sobre todas las películas y actualizar el color del corazón
  favorites.forEach(movieId => {
      const heartIcon = document.getElementById(`heart-icon-${movieId}`);
      if (heartIcon) {
          heartIcon.style.color = 'red'; // Cambiar a rojo si está en favoritos
      }
  });
}

// Función para activar/desactivar el filtro de favoritos
function toggleFavoritesFilter() {
  showingFavorites = !showingFavorites;
  getTitles();
}

// Inicializar la carga de títulos y géneros
getTitles();
fetchGenres();
fetchProviders("movie"); // Cargar proveedores iniciales de películas (por defecto)

window.onload = async function () {
  if (window.ethereum) {
    const accounts = await ethereum.request({ method: 'eth_accounts' });
    if (accounts.length > 0) {
        selectedAccount = accounts[0];
        const metamaskButton = document.getElementById('connect-metamask');
        metamaskButton.disabled = true;
        metamaskButton.textContent = "MetaMask Conectado";
        document.getElementById('favorite-filter-group').style.display = 'flex';

    }
}
  updateGenreSelect();  // Cargar los géneros iniciales (por ejemplo, películas)
};

// Agregar función para mostrar opciones de ver online o descargar
window.showTorrentOptions = function(magnetLink, movieTitle) {
  // Crear modal profesional con opciones
  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100vw';
  modal.style.height = '100vh';
  modal.style.background = 'rgba(0,0,0,0.55)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '99999';

  const box = document.createElement('div');
  box.style.background = '#23272f';
  box.style.padding = '32px 28px 24px 28px';
  box.style.borderRadius = '16px';
  box.style.textAlign = 'center';
  box.style.minWidth = '320px';
  box.style.maxWidth = '90vw';
  box.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)';
  box.style.color = '#f5f5f5';
  box.style.position = 'relative';

  box.innerHTML = `
    <h2 style="margin-bottom:18px;font-size:1.25em;font-weight:600;letter-spacing:0.5px;">¿Qué deseas hacer con el torrent?</h2>
    <p style="margin-bottom:28px;color:#b0b0b0;font-size:1em;">Puedes ver la película online o descargar el archivo torrent para usarlo en tu cliente favorito.</p>
    <div style="display:flex;justify-content:center;gap:18px;margin-bottom:18px;flex-wrap:wrap;">
      <button id="ver-online" style="padding:12px 28px;border-radius:8px;background:#1f80e0;color:white;border:none;font-size:1em;font-weight:500;cursor:pointer;transition:background 0.2s;box-shadow:0 2px 8px rgba(31,128,224,0.08);">Ver online</button>
      <a id="descargar-torrent" href="${magnetLink}" style="padding:12px 28px;border-radius:8px;background:#4caf50;color:white;text-decoration:none;font-size:1em;font-weight:500;display:inline-block;transition:background 0.2s;box-shadow:0 2px 8px rgba(76,175,80,0.08);" download>Descargar torrent</a>
    </div>
    <button id="cerrar-torrent-modal" style="margin-top:8px;padding:7px 22px;border-radius:6px;background:#444;color:#eee;border:none;font-size:0.95em;cursor:pointer;transition:background 0.2s;">Cancelar</button>
    <span style="position:absolute;top:12px;right:18px;font-size:1.5em;cursor:pointer;color:#aaa;" id="close-torrent-x" title="Cerrar">&times;</span>
  `;

  modal.appendChild(box);
  document.body.appendChild(modal);

  document.getElementById('ver-online').onclick = function() {
    document.body.removeChild(modal);
    // Usar la nueva función que incluye información de seeds/leechers
    watchOnlineWithStats(magnetLink, movieTitle);
  };
  document.getElementById('descargar-torrent').onclick = function() {
    document.body.removeChild(modal);
    // El enlace ya inicia la descarga
  };
  document.getElementById('cerrar-torrent-modal').onclick = function() {
    document.body.removeChild(modal);
  };
  document.getElementById('close-torrent-x').onclick = function() {
    document.body.removeChild(modal);
  };
};

// Función para explorar archivos en el torrent y mostrar el modal de selección
async function watchOnline(magnetURI, movieTitle) {
  // Mostrar modal de selección de archivos
  document.getElementById('file-selection-modal').style.display = 'block';
  document.getElementById('torrent-loading').style.display = 'block';
  document.getElementById('file-list').style.display = 'none';

  try {
    // Mostrar mensaje de carga más detallado
    document.getElementById('torrent-loading').innerHTML = `
      <p>Explorando torrent...</p>
      <div class="loading-spinner"></div>
      <p id="loading-status">Conectando con peers...</p>
    `;

    const response = await fetch('/api/torrent/explore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ magnetURI })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error explorando el torrent');
    }

    const torrentInfo = await response.json();
    currentTorrentInfo = torrentInfo;

    // Ocultar loading y mostrar lista de archivos
    document.getElementById('torrent-loading').style.display = 'none';
    document.getElementById('file-list').style.display = 'block';

    // Mostrar información del torrent
    const torrentInfoHtml = `
      <div class="torrent-info">
        <h4>Información del Torrent:</h4>
        <p><strong>Nombre:</strong> ${torrentInfo.name}</p>
        <p><strong>Tamaño:</strong> ${formatBytes(torrentInfo.length)}</p>
        <p><strong>Peers:</strong> ${torrentInfo.numPeers}</p>
        <p><strong>Progreso:</strong> ${(torrentInfo.progress * 100).toFixed(1)}%</p>
      </div>
    `;

    // Mostrar archivos de video disponibles
    const videoFilesList = document.getElementById('video-files-list');
    videoFilesList.innerHTML = torrentInfoHtml;

    if (torrentInfo.videoFiles.length === 0) {
      videoFilesList.innerHTML += '<p>No se encontraron archivos de video en este torrent.</p>';
      return;
    }

    const videoFilesHtml = '<h3>Archivos de Video Disponibles:</h3>';
    videoFilesList.innerHTML += videoFilesHtml;

    torrentInfo.videoFiles.forEach((file, index) => {
      const fileItem = document.createElement('div');
      fileItem.className = 'video-file-item';
      
      const fileSize = formatBytes(file.length);
      
      fileItem.innerHTML = `
        <div class="video-file-info">
          <div class="video-file-name">${file.name}</div>
          <div class="video-file-size">${fileSize}</div>
        </div>
        <button class="video-file-button" onclick="playVideoFile(${file.index})" data-file-index="${file.index}">
          Reproducir
        </button>
      `;
      
      videoFilesList.appendChild(fileItem);
    });

  } catch (error) {
    console.error('Error explorando torrent:', error);
    document.getElementById('torrent-loading').innerHTML = `
      <p style="color: red;">Error explorando el torrent: ${error.message}</p>
      <button onclick="closeFileSelectionModal()" style="margin-top: 10px; padding: 8px 16px; background-color: #ff4444; color: white; border: none; border-radius: 4px; cursor: pointer;">Cerrar</button>
    `;
  }
}

// Nueva función para ver online con estadísticas mejoradas
async function watchOnlineWithStats(magnetURI, movieTitle) {
  // Extraer hash del torrent para identificar solicitudes duplicadas
  const torrentHash = magnetURI.match(/xt=urn:btih:([^&]+)/i)?.[1] || magnetURI;
  
  // Verificar si ya hay una solicitud pendiente para este torrent
  if (pendingTorrentRequests.has(torrentHash)) {
    showNotification('Ya hay una solicitud en proceso para este torrent. Espera a que termine.', 'warning', 3000);
    return;
  }
  
  // Marcar solicitud como pendiente
  pendingTorrentRequests.set(torrentHash, true);
  
  // Mostrar modal de selección de archivos
  document.getElementById('file-selection-modal').style.display = 'block';
  document.getElementById('torrent-loading').style.display = 'block';
  document.getElementById('file-list').style.display = 'none';

  let retryCount = 0;
  const maxRetries = 3; // Reducir a 3 reintentos
  let currentTimeout = 5000; // Timeout inicial de 5 segundos

  const attemptExplore = async () => {
    try {
      // Mostrar mensaje de carga más detallado
      const retryText = retryCount > 0 ? ` (Intento ${retryCount + 1}/${maxRetries + 1})` : '';
      const statusMessages = [
        'Conectando con la red torrent...',
        'Buscando peers disponibles...',
        'Descargando metadatos del torrent...',
        'Verificando archivos del torrent...'
      ];
      
      const statusMessage = statusMessages[Math.min(retryCount, statusMessages.length - 1)];
      
      document.getElementById('torrent-loading').innerHTML = `
        <p>🔍 Explorando torrent...</p>
        <div class="loading-spinner"></div>
        <p id="loading-status">${statusMessage}${retryText}</p>
        <p style="font-size: 0.9em; color: #ccc; margin-top: 10px;">
          ⏱️ Los torrents pueden tardar 30-60 segundos en cargar dependiendo de la cantidad de peers disponibles.
        </p>
        <p style="font-size: 0.8em; color: #888; margin-top: 5px;">
          💡 Si un torrent no carga, intenta con otra calidad (720p suele ser más rápido que 1080p).
        </p>
      `;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // Aumentar a 30 segundos de timeout por request

      const response = await fetch('/api/torrent/explore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ magnetURI }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        
        // Si es un error 503 (torrent cargando), reintentar con backoff exponencial
        if (response.status === 503 && retryCount < maxRetries) {
          retryCount++;
          currentTimeout = Math.min(currentTimeout * 1.2, 8000); // Máximo 8 segundos
          
          document.getElementById('loading-status').textContent = 
            `⏳ El torrent está cargando, reintentando en ${Math.ceil(currentTimeout/1000)} segundos... (${retryCount}/${maxRetries + 1})`;
          
          setTimeout(attemptExplore, currentTimeout);
          return;
        }
        
        // Si es timeout (408), sugerir otro torrent
        if (response.status === 408) {
          throw new Error('⏰ El torrent está tardando demasiado en responder. Puede ser un torrent lento o sin peers activos. Intenta con otra calidad.');
        }
        
        throw new Error(errorData.message || 'Error explorando el torrent');
      }

      const torrentInfo = await response.json();
      currentTorrentInfo = torrentInfo;

      // Limpiar solicitud pendiente
      pendingTorrentRequests.delete(torrentHash);

      // Ocultar loading y mostrar lista de archivos
      document.getElementById('torrent-loading').style.display = 'none';
      document.getElementById('file-list').style.display = 'block';

      // Mostrar información detallada del torrent
      const torrentInfoHtml = `
        <div class="torrent-info">
          <h4>✅ Torrent Cargado Exitosamente:</h4>
          <p><strong>📝 Nombre:</strong> ${torrentInfo.name}</p>
          <p><strong>📦 Tamaño:</strong> ${formatBytes(torrentInfo.length)}</p>
          <p><strong>🌱 Seeds:</strong> <span style="color: #4caf50; font-weight: bold;">${torrentInfo.seeds || 0}</span></p>
          <p><strong>📥 Leechers:</strong> <span style="color: #ff9800; font-weight: bold;">${torrentInfo.leechers || 0}</span></p>
          <p><strong>👥 Peers totales:</strong> <span style="color: #2196f3;">${torrentInfo.numPeers}</span></p>
          <p><strong>📊 Progreso:</strong> <span style="color: #4caf50;">${(torrentInfo.progress * 100).toFixed(1)}%</span></p>
          <p><strong>⬇️ Velocidad descarga:</strong> <span style="color: #2196f3;">${formatSpeed(torrentInfo.downloadSpeed)}</span></p>
          <p><strong>⬆️ Velocidad subida:</strong> <span style="color: #9c27b0;">${formatSpeed(torrentInfo.uploadSpeed)}</span></p>
        </div>
      `;

      // Mostrar archivos de video disponibles
      const videoFilesList = document.getElementById('video-files-list');
      videoFilesList.innerHTML = torrentInfoHtml;

      if (torrentInfo.videoFiles.length === 0) {
        videoFilesList.innerHTML += `
          <div style="color: #ff4444; margin-top: 15px; padding: 15px; background: #2a1f1f; border-radius: 8px;">
            <p><strong>⚠️ No se encontraron archivos de video en este torrent.</strong></p>
            <p>Este torrent puede contener otros tipos de archivos. Intenta con otro torrent.</p>
          </div>
        `;
        return;
      }

      const videoFilesHtml = '<h3>🎬 Archivos de Video Disponibles:</h3>';
      videoFilesList.innerHTML += videoFilesHtml;

      torrentInfo.videoFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'video-file-item';
        
        const fileSize = formatBytes(file.length);
        
        fileItem.innerHTML = `
          <div class="video-file-info">
            <div class="video-file-name">🎥 ${file.name}</div>
            <div class="video-file-size">📦 ${fileSize}</div>
          </div>
          <button class="video-file-button" onclick="playVideoFileWithStats(${file.index})" data-file-index="${file.index}">
            ▶️ Reproducir
          </button>
        `;
        
        videoFilesList.appendChild(fileItem);
      });

      showNotification('¡Torrent cargado exitosamente! 🎉 Selecciona un archivo para reproducir.', 'success', 4000);

    } catch (error) {
      console.error('Error explorando torrent:', error);
      
      // Limpiar solicitud pendiente en caso de error
      pendingTorrentRequests.delete(torrentHash);
      
      let errorMessage = error.message;
      let suggestions = '';
      
      if (error.name === 'AbortError') {
        errorMessage = '⏰ La petición fue cancelada por timeout (30 segundos).';
        suggestions = 'El torrent puede estar muy lento o sin peers activos. Intenta con otra calidad.';
      } else if (error.message.includes('503')) {
        errorMessage = '⏳ El torrent está tardando en cargar.';
        suggestions = 'Esto es normal para algunos torrents. Puedes intentar nuevamente o probar con otra calidad.';
      } else if (error.message.includes('timeout') || error.message.includes('408')) {
        errorMessage = '⏰ El torrent está tardando demasiado en responder.';
        suggestions = 'Puede ser un torrent lento o sin peers activos. Te recomendamos probar con otra calidad (720p en lugar de 1080p, por ejemplo).';
      } else if (error.message.includes('No peers found')) {
        errorMessage = '👥 No se encontraron peers para este torrent.';
        suggestions = 'El torrent puede estar muerto o ser muy raro. Intenta con otra calidad o otra fuente.';
      }
      
      document.getElementById('torrent-loading').innerHTML = `
        <div style="color: #ff4444; text-align: center;">
          <h4>❌ Error explorando el torrent</h4>
          <p><strong>Error:</strong> ${errorMessage}</p>
          ${suggestions ? `<p style="color: #ccc; margin-top: 10px;"><strong>💡 Sugerencia:</strong> ${suggestions}</p>` : ''}
          <div style="margin-top: 20px;">
            <button onclick="closeFileSelectionModal()" style="padding: 8px 16px; background-color: #ff4444; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">❌ Cerrar</button>
            <button onclick="watchOnlineWithStats('${magnetURI}', '${movieTitle}')" style="padding: 8px 16px; background-color: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer;">🔄 Reintentar</button>
          </div>
        </div>
      `;
      showNotification('Error explorando torrent: ' + errorMessage, 'error', 6000);
    }
  };

  // Iniciar el proceso de exploración
  attemptExplore();
}

// Función auxiliar para formatear velocidad
function formatSpeed(bytesPerSecond) {
  if (!bytesPerSecond || bytesPerSecond === 0) return '0 B/s';
  
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
  
  return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Nueva función para reproducir archivo with estadísticas en tiempo real
function playVideoFileWithStats(fileIndex) {
  if (!currentTorrentInfo) {
    alert('Error: Información del torrent no disponible');
    return;
  }

  // Cerrar modal de selección de archivos
  closeFileSelectionModal();

  // Mostrar modal del reproductor de video
  document.getElementById('video-modal').style.display = 'block';
  
  const videoPlayer = document.getElementById('video-player');
  currentVideoPlayer = videoPlayer;

  // Configurar la URL del stream
  const streamUrl = `/api/torrent/stream/${currentTorrentInfo.infoHash}/${fileIndex}`;
  videoPlayer.src = streamUrl;

  // Mostrar y configurar estadísticas
  const torrentStatsDiv = document.getElementById('torrent-stats');
  if (torrentStatsDiv) {
    torrentStatsDiv.style.display = 'block';
  }

  // Inicializar estadísticas
  updateTorrentStats(currentTorrentInfo);

  // Limpiar interval anterior si existe
  if (statsInterval) {
    clearInterval(statsInterval);
  }

  // Configurar actualización periódica de estadísticas
  statsInterval = setInterval(() => {
    updateTorrentStatsFromServer(currentTorrentInfo.infoHash);
  }, 2000); // Actualizar cada 2 segundos

  // Limpiar interval cuando se cierre el modal
  const videoModal = document.getElementById('video-modal');
  const originalCloseFunction = window.closeVideoModal;
  window.closeVideoModal = function() {
    if (statsInterval) {
      clearInterval(statsInterval);
      statsInterval = null;
    }
    if (originalCloseFunction) originalCloseFunction();
    window.closeVideoModal = originalCloseFunction; // Restaurar función original
  };

  // Limpiar subtítulos anteriores
  clearSubtitles();

  // Cargar subtítulos del torrent si están disponibles
  loadTorrentSubtitles();

  // Configurar controles de subtítulos
  setupSubtitleControls();

  // Configurar eventos del reproductor
  setupVideoPlayerEvents();

  showNotification('Iniciando reproducción con estadísticas en tiempo real', 'info', 3000);
}

// Función para rastrear el progreso del torrent
function startProgressTracking() {
  if (!currentTorrentInfo) return;

  const progressInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/torrent/progress/${currentTorrentInfo.infoHash}`);
      if (response.ok) {
        const progressData = await response.json();
        
        // Actualizar información de progreso si hay un elemento para mostrarla
        const progressElement = document.getElementById('torrent-progress-info');
        if (progressElement) {
          progressElement.innerHTML = `
            <div class="progress-info">
              <p>Descarga: ${(progressData.progress * 100).toFixed(1)}%</p>
              <p>Velocidad: ${formatBytes(progressData.downloadSpeed)}/s</p>
              <p>Peers: ${progressData.numPeers}</p>
              <p>Descargado: ${formatBytes(progressData.downloaded)} / ${formatBytes(progressData.length)}</p>
            </div>
          `;
        }
      }
    } catch (error) {
      console.error('Error obteniendo progreso del torrent:', error);
    }

    // Detener el tracking si el modal se cierra
    if (document.getElementById('video-modal').style.display === 'none') {
      clearInterval(progressInterval);
    }
  }, 2000); // Actualizar cada 2 segundos
}

// Función para limpiar subtítulos anteriores
function clearSubtitles() {
  const videoPlayer = document.getElementById('video-player');
  const tracks = videoPlayer.querySelectorAll('track');
  tracks.forEach(track => track.remove());

  // Limpiar selectores
  document.getElementById('torrent-subtitle-select').innerHTML = '<option value="">Sin subtítulos</option>';
  document.getElementById('online-subtitle-select').innerHTML = '<option value="">Sin subtítulos online</option>';
  document.getElementById('uploaded-subtitle-select').innerHTML = '<option value="">Sin subtítulos subidos</option>';
}

// Función para cargar subtítulos del torrent
function loadTorrentSubtitles() {
  if (!currentTorrentInfo || !currentTorrentInfo.subtitleFiles) return;

  const select = document.getElementById('torrent-subtitle-select');
  
  currentTorrentInfo.subtitleFiles.forEach(subtitle => {
    const option = document.createElement('option');
    option.value = subtitle.index;
    option.textContent = subtitle.name;
    select.appendChild(option);
  });
}

// Función para configurar los controles de subtítulos
function setupSubtitleControls() {
  // Búsqueda de subtítulos online
  document.getElementById('search-subtitles-btn').onclick = async function() {
    const language = document.getElementById('language-select').value;
    await searchOnlineSubtitles(language);
  };

  // Subir subtítulos
  document.getElementById('upload-subtitle-btn').onclick = function() {
    const fileInput = document.getElementById('subtitle-file');
    fileInput.click();
  };

  document.getElementById('subtitle-file').onchange = function(event) {
    uploadSubtitle(event.target.files[0]);
  };

  // Habilitar/deshabilitar subtítulos
  document.getElementById('enable-subtitles-btn').onclick = enableSubtitles;
  document.getElementById('disable-subtitles-btn').onclick = disableSubtitles;

  // Cambio de subtítulos del torrent
  document.getElementById('torrent-subtitle-select').onchange = function() {
    if (this.value) {
      loadTorrentSubtitle(this.value);
    }
  };

  // Cambio de subtítulos online
  document.getElementById('online-subtitle-select').onchange = function() {
    if (this.value) {
      loadOnlineSubtitle(this.value);
    }
  };

  // Cambio de subtítulos subidos
  document.getElementById('uploaded-subtitle-select').onchange = function() {
    if (this.value) {
      loadUploadedSubtitle(this.value);
    }
  };
}

// Función para cargar subtítulo del torrent
async function loadTorrentSubtitle(subtitleIndex) {
  if (!currentTorrentInfo) {
    showNotification('No hay información del torrent disponible', 'error');
    return;
  }

  try {
    showNotification('Cargando subtítulo del torrent...', 'info', 2000);
    const subtitleUrl = `/api/torrent/subtitle/${currentTorrentInfo.infoHash}/${subtitleIndex}`;
    addSubtitleTrack(subtitleUrl, `Torrent Subtitle ${subtitleIndex}`, 'es');
    showNotification('Subtítulo del torrent cargado exitosamente', 'success');
  } catch (error) {
    console.error('Error cargando subtítulo del torrent:', error);
    showNotification('Error al cargar el subtítulo del torrent', 'error');
  }
}

// Función para buscar subtítulos online
async function searchOnlineSubtitles(language) {
  const searchBtn = document.getElementById('search-subtitles-btn');
  const originalText = searchBtn.textContent;
  
  try {
    // Show loading state
    searchBtn.textContent = 'Buscando...';
    searchBtn.disabled = true;
    showNotification('Buscando subtítulos online...', 'info', 2000);
    
    // Obtener el título original y el ID de IMDb de las variables globales
    const movieTitle = originalTitle || 'Unknown Movie';
    const imdbId = currentImdbId || null;
    
    // Construir la URL con los parámetros necesarios
    let searchUrl = `/api/subtitles/search?movieTitle=${encodeURIComponent(movieTitle)}&language=${language}`;
    if (imdbId) {
      searchUrl += `&imdbId=${encodeURIComponent(imdbId)}`;
    }
    
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const subtitles = await response.json();

    const select = document.getElementById('online-subtitle-select');
    select.innerHTML = '<option value="">Seleccionar subtítulo online</option>';

    if (subtitles && subtitles.length > 0) {
      subtitles.forEach((subtitle, index) => {
        const option = document.createElement('option');
        option.value = subtitle.downloadUrl;
        
        // Agregar indicador si es demo
        const demoIndicator = subtitle.isDemo ? ' [DEMO]' : '';
        option.textContent = `${subtitle.languageName} - ${subtitle.filename} (${subtitle.rating || 'N/A'})${demoIndicator}`;
        select.appendChild(option);
      });
      
      const demoCount = subtitles.filter(s => s.isDemo).length;
      const realCount = subtitles.length - demoCount;
      
      if (demoCount > 0 && realCount === 0) {
        showNotification(`Se encontraron ${subtitles.length} subtítulos de demostración para "${movieTitle}". Para subtítulos reales, se requiere integración con APIs externas.`, 'info');
      } else {
        showNotification(`Se encontraron ${subtitles.length} subtítulos para "${movieTitle}"`, 'success');
      }
    } else {
      showNotification(`No se encontraron subtítulos online para "${movieTitle}" en ${language}. La búsqueda de subtítulos requiere integración con APIs externas como OpenSubtitles.`, 'warning');
    }

  } catch (error) {
    console.error('Error buscando subtítulos online:', error);
    showNotification('Error al buscar subtítulos online. Por favor, inténtalo de nuevo.', 'error');
  } finally {
    // Reset button state
    searchBtn.textContent = originalText;
    searchBtn.disabled = false;
  }
}

// Función para cargar subtítulo online
async function loadOnlineSubtitle(subtitleUrl) {
  try {
    showNotification('Cargando subtítulo online...', 'info', 2000);
    
    // Primero verificar que la URL del subtítulo sea válida
    if (!subtitleUrl || subtitleUrl.includes('undefined')) {
      throw new Error('URL de subtítulo inválida. Por favor, selecciona otro subtítulo.');
    }
    
    console.log('Loading subtitle from URL:', subtitleUrl);
    
    // Determine if this is an OpenSubtitles URL (our backend endpoint) or external URL
    let finalUrl;
    if (subtitleUrl.startsWith('/api/subtitles/opensubtitles-download/')) {
      // This is already our backend OpenSubtitles endpoint, use it directly
      finalUrl = subtitleUrl;
    } else {
      // This is an external URL, use the proxy
      finalUrl = `/api/subtitles/proxy?url=${encodeURIComponent(subtitleUrl)}`;
    }
    
    console.log('Final URL for subtitle loading:', finalUrl);
    
    // Verificar que el endpoint puede acceder al subtítulo
    const response = await fetch(finalUrl);
    
    if (!response.ok) {
      let errorMessage = `Error del servidor: ${response.status}`;
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        // Si no se puede parsear JSON, usar el status text
        errorMessage = response.statusText || errorMessage;
      }
      
      // Proporcionar mensajes más específicos según el error
      if (response.status === 404) {
        errorMessage = 'Subtítulo no encontrado. Es posible que la URL haya expirado o que el subtítulo ya no esté disponible.';
      } else if (response.status === 403) {
        errorMessage = 'Acceso denegado al subtítulo. El servidor de subtítulos no permite el acceso.';
      } else if (response.status >= 500) {
        errorMessage = 'Error del servidor de subtítulos. Intenta más tarde.';
      }
      
      throw new Error(errorMessage);
    }
    
    // Verificar que el contenido es válido
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      // Si recibimos JSON, es probable que sea un error
      const jsonResponse = await response.json();
      throw new Error(jsonResponse.message || 'Respuesta inesperada del servidor');
    }
    
    // Si llegamos aquí, el subtítulo se puede cargar
    addSubtitleTrack(finalUrl, 'Online Subtitle', 'es');
    showNotification('Subtítulo online cargado exitosamente', 'success');
    
  } catch (error) {
    console.error('Error loading online subtitle:', error);
    
    // Proporcionar sugerencias adicionales
    let suggestion = '';
    if (error.message.includes('404') || error.message.includes('no encontrado')) {
      suggestion = ' Prueba subiendo tu propio archivo de subtítulos o busca en otro idioma.';
    } else if (error.message.includes('integración')) {
      suggestion = ' Esta aplicación necesita configuración adicional para acceder a fuentes de subtítulos reales.';
    }
    
    showNotification(`Error al cargar subtítulo: ${error.message}${suggestion}`, 'error', 8000);
  }
}

// Función para subir subtítulo
async function uploadSubtitle(file) {
  if (!file) return;

  const formData = new FormData();
  formData.append('subtitle', file);
  formData.append('language', document.getElementById('language-select').value);

  try {
    showNotification('Subiendo subtítulo...', 'info', 2000);
    
    const response = await fetch('/api/subtitles/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    // Agregar al selector de subtítulos subidos
    const select = document.getElementById('uploaded-subtitle-select');
    const option = document.createElement('option');
    option.value = result.path;
    option.textContent = result.originalName;
    select.appendChild(option);

    showNotification(`Subtítulo "${result.originalName}" subido exitosamente`, 'success');

  } catch (error) {
    console.error('Error subiendo subtítulo:', error);
    showNotification('Error al subir el subtítulo. Por favor, inténtalo de nuevo.', 'error');
  }
}

// Función para cargar subtítulo subido
function loadUploadedSubtitle(subtitlePath) {
  addSubtitleTrack(subtitlePath, 'Uploaded Subtitle', 'es');
  showNotification('Subtítulo subido cargado', 'success');
}

// Función para agregar track de subtítulo al video
function addSubtitleTrack(src, label, language) {
  const videoPlayer = document.getElementById('video-player');
  
  if (!videoPlayer) {
    showNotification('No se encontró el reproductor de video', 'error');
    return;
  }
  
  if (!src || src.includes('undefined')) {
    showNotification('URL de subtítulo inválida', 'error');
    return;
  }
  
  try {
    // Remover tracks anteriores del mismo tipo
    const existingTracks = videoPlayer.querySelectorAll('track');
    existingTracks.forEach(track => track.remove());

    // Crear nuevo track
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.src = src;
    track.srclang = language;
    track.label = label;
    track.default = true;

    // Agregar event listeners para el track
    track.addEventListener('load', () => {
      console.log('Subtítulo cargado exitosamente:', src);
      showNotification('Subtítulos activados', 'success');
    });
    
    track.addEventListener('error', (e) => {
      console.error('Error cargando subtítulo:', {
        error: e,
        src: src,
        track: track
      });
      
      // Proporcionar mensaje de error más específico
      let errorMessage = 'Error al cargar el archivo de subtítulo';
      if (src.includes('undefined')) {
        errorMessage = 'URL de subtítulo inválida (contiene "undefined")';
      } else if (!src.startsWith('http') && !src.startsWith('/')) {
        errorMessage = 'URL de subtítulo no válida';
      }
      
      showNotification(errorMessage, 'error');
    });

    videoPlayer.appendChild(track);
    
    // Habilitar automáticamente los subtítulos cuando se cargan
    setTimeout(() => {
      if (videoPlayer.textTracks.length > 0) {
        videoPlayer.textTracks[0].mode = 'showing';
        console.log('Subtítulos habilitados automáticamente');
      }
    }, 100);
    
  } catch (error) {
    console.error('Error agregando track de subtítulo:', error);
    showNotification('Error al agregar el subtítulo al video', 'error');
  }
}

// Función para habilitar subtítulos
function enableSubtitles() {
  const videoPlayer = document.getElementById('video-player');
  const tracks = videoPlayer.textTracks;
  
  let tracksEnabled = 0;
  for (let i = 0; i < tracks.length; i++) {
    tracks[i].mode = 'showing';
    tracksEnabled++;
  }
  
  if (tracksEnabled > 0) {
    showNotification(`${tracksEnabled} pista(s) de subtítulos habilitadas`, 'success');
  } else {
    showNotification('No hay subtítulos disponibles para habilitar', 'warning');
  }
}

// Función para deshabilitar subtítulos
function disableSubtitles() {
  const videoPlayer = document.getElementById('video-player');
  const tracks = videoPlayer.textTracks;
  
  let tracksDisabled = 0;
  for (let i = 0; i < tracks.length; i++) {
    tracks[i].mode = 'hidden';
    tracksDisabled++;
  }
  
  if (tracksDisabled > 0) {
    showNotification('Subtítulos deshabilitados', 'info');
  } else {
    showNotification('No hay subtítulos para deshabilitar', 'warning');
  }
}

// Función para cerrar el modal del reproductor de video
async function closeVideoModal() {
  document.getElementById('video-modal').style.display = 'none';
  
  // Detener y limpiar el video player
  if (currentVideoPlayer) {
    currentVideoPlayer.pause();
    currentVideoPlayer.src = '';
    currentVideoPlayer.load();
    currentVideoPlayer = null;
  }
  
  // Limpiar estadísticas si están corriendo
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  
  // Detener y limpiar el torrent del servidor si tenemos información del torrent actual
  if (currentTorrentInfo && currentTorrentInfo.infoHash) {
    try {
      console.log(`Stopping torrent: ${currentTorrentInfo.infoHash}`);
      showNotification('Deteniendo torrent y limpiando cache...', 'info', 2000);
      
      const response = await fetch(`/api/torrent/stop/${currentTorrentInfo.infoHash}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Torrent stopped successfully:', result);
        if (result.subtitlesCleaned > 0) {
          showNotification(`Torrent detenido y ${result.subtitlesCleaned} subtítulos limpiados del cache`, 'success', 3000);
        } else {
          showNotification('Torrent detenido y cache limpiado', 'success', 2000);
        }
      } else {
        console.warn('Failed to stop torrent on server:', response.status);
        showNotification('Advertencia: El torrent podría seguir activo en el servidor', 'warning', 3000);
      }
    } catch (error) {
      console.error('Error stopping torrent:', error);
      showNotification('Error al detener el torrent, pero el video se ha cerrado', 'warning', 3000);
    }
  }
  
  // Limpiar cliente WebTorrent local si existe
  if (window.currentTorrentClient) {
    try {
      window.currentTorrentClient.destroy((err) => {
        if (err) {
          console.error("Error destruyendo el cliente local de WebTorrent:", err);
        } else {
          console.log("Cliente local WebTorrent destruido correctamente");
        }
      });
      window.currentTorrentClient = null;
    } catch (error) {
      console.error("Error al destruir cliente WebTorrent local:", error);
    }
  }
  
  // Limpiar URLs de blob de subtítulos locales
  if (window.localSubtitleBlobUrls && window.localSubtitleBlobUrls.length > 0) {
    window.localSubtitleBlobUrls.forEach(url => URL.revokeObjectURL(url));
    window.localSubtitleBlobUrls = [];
    console.log('URLs de subtítulos locales limpiadas');
  }
  
  // Resetear información del torrent
  currentTorrentInfo = null;
  
  // Limpiar elementos de la UI
  const torrentStatsDiv = document.getElementById('torrent-stats');
  if (torrentStatsDiv) {
    torrentStatsDiv.style.display = 'none';
    // Resetear valores de estadísticas
    const peersElement = document.getElementById('torrent-peers');
    const progressElement = document.getElementById('torrent-progress');
    const downloadSpeedElement = document.getElementById('torrent-download-speed');
    const uploadSpeedElement = document.getElementById('torrent-upload-speed');
    
    if (peersElement) peersElement.textContent = 'Peers: 0';
    if (progressElement) progressElement.textContent = 'Progress: 0%';
    if (downloadSpeedElement) downloadSpeedElement.textContent = '↓ 0 kB/s';
    if (uploadSpeedElement) uploadSpeedElement.textContent = '↑ 0 kB/s';
  }
  
  console.log('Video modal cerrado y recursos limpiados completamente');
}

// Función para cerrar el modal de selección de archivos
function closeFileSelectionModal() {
  document.getElementById('file-selection-modal').style.display = 'none';
  // Limpiar solicitudes pendientes al cerrar
  pendingTorrentRequests.clear();
}

// Función para actualizar estadísticas del torrent
function updateTorrentStats(torrentInfo) {
  // Actualizar seeds y leechers
  const seedsElement = document.getElementById('torrent-seeds');
  const leechersElement = document.getElementById('torrent-leechers');
  const peersElement = document.getElementById('torrent-peers');
  
  if (seedsElement) seedsElement.textContent = `Seeds: ${torrentInfo.seeds || 0}`;
  if (leechersElement) leechersElement.textContent = `Leechers: ${torrentInfo.leechers || 0}`;
  if (peersElement) peersElement.textContent = `Peers: ${torrentInfo.numPeers || 0}`;

  // Actualizar progreso
  const progressElement = document.getElementById('torrent-progress');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const progressPercentage = document.getElementById('progress-percentage');
  
  const progress = (torrentInfo.progress * 100).toFixed(1);
  if (progressElement) progressElement.textContent = `Progress: ${progress}%`;
  if (progressBarFill) progressBarFill.style.width = `${progress}%`;
  if (progressPercentage) progressPercentage.textContent = `${progress}%`;

  // Actualizar velocidades
  const downloadSpeedElement = document.getElementById('torrent-download-speed');
  const uploadSpeedElement = document.getElementById('torrent-upload-speed');
  
  if (downloadSpeedElement) downloadSpeedElement.textContent = `↓ ${formatSpeed(torrentInfo.downloadSpeed)}`;
  if (uploadSpeedElement) uploadSpeedElement.textContent = `↑ ${formatSpeed(torrentInfo.uploadSpeed)}`;

  // Actualizar datos descargados/subidos
  const downloadedElement = document.getElementById('torrent-downloaded');
  const uploadedElement = document.getElementById('torrent-uploaded');
  const timeRemainingElement = document.getElementById('torrent-time-remaining');
  
  if (downloadedElement) downloadedElement.textContent = `Downloaded: ${formatBytes(torrentInfo.downloaded || 0)}`;
  if (uploadedElement) uploadedElement.textContent = `Uploaded: ${formatBytes(torrentInfo.uploaded || 0)}`;
  if (timeRemainingElement) {
    const eta = torrentInfo.timeRemaining ? formatTime(torrentInfo.timeRemaining) : '--:--';
    timeRemainingElement.textContent = `ETA: ${eta}`;
  }
}

// Función para obtener estadísticas actualizadas del servidor
async function updateTorrentStatsFromServer(infoHash) {
  try {
    const response = await fetch(`/api/torrent/stats/${infoHash}`);
    if (response.ok) {
      const stats = await response.json();
      updateTorrentStats(stats);
    } else if (response.status === 503) {
      console.warn('Torrent no está listo para estadísticas');
    } else {
      console.warn('No se pudieron obtener estadísticas actualizadas del torrent');
    }
  } catch (error) {
    // Si hay error de conexión, limpiar el interval para evitar spam
    if (error.message.includes('Failed to fetch') || error.message.includes('net::ERR_CONNECTION_REFUSED')) {
      if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
        console.warn('Servidor desconectado, pausando actualización de estadísticas');
      }
    } else {
      console.error('Error obteniendo estadísticas del torrent:', error);
    }
  }
}

// Función auxiliar para formatear tiempo
function formatTime(seconds) {
  if (!seconds || seconds === Infinity) return '--:--';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

// Función para configurar eventos del reproductor de video
function setupVideoPlayerEvents() {
  const videoPlayer = document.getElementById('video-player');
  const playerLoadingIndicator = document.getElementById('player-loading-indicator');
  const playerStatusMessage = document.getElementById('player-status-message');
  
  if (!videoPlayer) return;

  // Mostrar indicador de carga inicial
  if (playerLoadingIndicator) {
    playerLoadingIndicator.textContent = 'Cargando video...';
    playerLoadingIndicator.style.display = 'block';
  }

  videoPlayer.addEventListener('loadstart', () => {
    if (playerStatusMessage) {
      playerStatusMessage.textContent = 'Iniciando descarga...';
      playerStatusMessage.style.display = 'block';
    }
  });

  videoPlayer.addEventListener('progress', () => {
    if (videoPlayer.buffered.length > 0) {
      const buffered = (videoPlayer.buffered.end(0) / videoPlayer.duration * 100).toFixed(1);
      if (playerStatusMessage) {
        playerStatusMessage.textContent = `Buffer: ${buffered}%`;
      }
    }
  });

  videoPlayer.addEventListener('canplay', () => {
    if (playerLoadingIndicator) {
      playerLoadingIndicator.style.display = 'none';
    }
    if (playerStatusMessage) {
      playerStatusMessage.textContent = 'Listo para reproducir';
      setTimeout(() => {
        playerStatusMessage.style.display = 'none';
      }, 2000);
    }
    showNotification('Video listo para reproducir', 'success', 2000);
  });

  videoPlayer.addEventListener('error', (e) => {
    if (playerLoadingIndicator) {
      playerLoadingIndicator.style.display = 'none';
    }
    if (playerStatusMessage) {
      playerStatusMessage.textContent = 'Error al cargar el video';
      playerStatusMessage.style.display = 'block';
    }
    showNotification('Error al cargar el video', 'error');
    console.error('Error del reproductor de video:', e);
  });

  videoPlayer.addEventListener('waiting', () => {
    if (playerStatusMessage) {
      playerStatusMessage.textContent = 'Buffering...';
      playerStatusMessage.style.display = 'block';
    }
  });

  videoPlayer.addEventListener('playing', () => {
    if (playerStatusMessage) {
      playerStatusMessage.style.display = 'none';
    }
  });
}

// Add test function to window for manual testing
window.testVideoStreamingFeatures = testVideoStreamingFeatures;

// Test server API endpoints
async function testServerAPIs() {
  console.log('Testing Server APIs...');
  showNotification('Testing server APIs...', 'info');
  
  try {
    // Test subtitle search API
    const subtitleResponse = await fetch('/api/subtitles/search?movieTitle=Test Movie&language=es');
    if (subtitleResponse.ok) {
      const subtitles = await subtitleResponse.json();
      console.log('Subtitle search API working:', subtitles);
      showNotification('Subtitle search API working', 'success');
    } else {
      throw new Error('Subtitle search API failed');
    }
    
    // Test a simple health check if available
    try {
      const healthResponse = await fetch('/api/health');
      if (healthResponse.ok) {
        console.log('Health check API working');
      }
    } catch (e) {
      console.log('Health check API not available (this is normal)');
    }
    
    console.log('All available server APIs are working');
    showNotification('Server APIs are functioning correctly', 'success');
    
  } catch (error) {
    console.error('Server API test failed:', error);
    showNotification('Server API test failed: ' + error.message, 'error');
  }
}

// Add to window for manual testing
window.testServerAPIs = testServerAPIs;

// Limpiar recursos al cerrar o navegar fuera de la página
window.addEventListener('beforeunload', () => {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  
  // Limpiar solicitudes pendientes
  pendingTorrentRequests.clear();
  
  // Limpiar URLs de blobs
  if (window.localSubtitleBlobUrls) {
    window.localSubtitleBlobUrls.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        // Ignorar errores al limpiar URLs
      }
    });
    window.localSubtitleBlobUrls = [];
  }
});

// Función para actualizar el estado de los subtítulos en la UI
function updateSubtitleStatus(status, type = 'info') {
  const statusElement = document.getElementById('subtitle-status');
  if (statusElement) {
    statusElement.textContent = status;
    
    // Actualizar color según el tipo
    statusElement.className = '';
    switch(type) {
      case 'success':
        statusElement.style.color = '#4caf50';
        break;
      case 'error':
        statusElement.style.color = '#f44336';
        break;
      case 'warning':
        statusElement.style.color = '#ffa726';
        break;
      default:
        statusElement.style.color = '#2196f3';
    }
  }
}

// Función de prueba para verificar la funcionalidad de subtítulos
async function testSubtitleFunctionality() {
  console.log('🧪 Testing subtitle functionality...');
  updateSubtitleStatus('Probando funcionalidad...', 'info');
  
  try {
    // Test 1: Buscar subtítulos de demostración
    console.log('Testing subtitle search...');
    const searchResponse = await fetch('/api/subtitles/search?movieTitle=Test Movie&language=es&imdbId=tt1234567');
    
    if (searchResponse.ok) {
      const subtitles = await searchResponse.json();
      console.log('✅ Subtitle search working:', subtitles);
      
      if (subtitles.length > 0) {
        // Test 2: Probar el proxy con URL de demo
        const demoUrl = subtitles[0].downloadUrl;
        if (demoUrl) {
          console.log('Testing subtitle proxy with demo URL...');
          const proxyResponse = await fetch(`/api/subtitles/proxy?url=${encodeURIComponent(demoUrl)}`);
          
          if (proxyResponse.ok) {
            const content = await proxyResponse.text();
            console.log('✅ Subtitle proxy working, content length:', content.length);
            updateSubtitleStatus('Funcionalidad verificada - Sistema operativo', 'success');
            showNotification('✅ Sistema de subtítulos funcionando correctamente', 'success');
          } else {
            console.error('❌ Subtitle proxy failed:', proxyResponse.status);
            updateSubtitleStatus('Error en proxy de subtítulos', 'error');
          }
        } else {
          console.error('❌ No demo URL found');
          updateSubtitleStatus('URLs de demo no disponibles', 'warning');
        }
      } else {
        console.log('ℹ️ No subtitles found (expected for demo)');
        updateSubtitleStatus('Búsqueda retorna resultados vacíos', 'warning');
      }
    } else {
      console.error('❌ Subtitle search failed:', searchResponse.status);
      updateSubtitleStatus('Error en búsqueda de subtítulos', 'error');
    }
    
  } catch (error) {
    console.error('❌ Subtitle test failed:', error);
    updateSubtitleStatus('Error en prueba del sistema', 'error');
    showNotification('❌ Error probando sistema de subtítulos: ' + error.message, 'error');
  }
}

// Ejecutar la prueba cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
  // Esperar un poco para que todo esté cargado
  setTimeout(testSubtitleFunctionality, 2000);
});

// Exponer función de prueba para uso manual
window.testSubtitleFunctionality = testSubtitleFunctionality;

// Función para limpiar recursos cuando el usuario cierra la pestaña o navega fuera
function cleanupOnPageUnload() {
  // Detener torrent del servidor si hay uno activo
  if (currentTorrentInfo && currentTorrentInfo.infoHash) {
    try {
      // Usar sendBeacon para enviar la solicitud de limpieza de manera confiable
      // incluso cuando la página se está cerrando
      const data = JSON.stringify({ infoHash: currentTorrentInfo.infoHash });
      const beaconSent = navigator.sendBeacon(`/api/torrent/stop/${currentTorrentInfo.infoHash}`, data);
      
      if (beaconSent) {
        console.log('Cleanup beacon sent successfully for torrent:', currentTorrentInfo.infoHash);
      } else {
        console.log('Failed to send cleanup beacon for torrent:', currentTorrentInfo.infoHash);
        // Fallback: intento síncrono rápido
        try {
          fetch(`/api/torrent/stop/${currentTorrentInfo.infoHash}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true // Intenta mantener la conexión durante el unload
          }).catch(() => {}); // Ignorar errores ya que la página se está cerrando
        } catch (e) {}
      }
    } catch (error) {
      console.error('Error during page unload cleanup:', error);
    }
  }
  
  // Limpiar cliente WebTorrent local
  if (window.currentTorrentClient) {
    try {
      window.currentTorrentClient.destroy();
      window.currentTorrentClient = null;
    } catch (error) {
      console.error('Error cleaning up WebTorrent client on unload:', error);
    }
  }
  
  // Limpiar URLs de blob
  if (window.localSubtitleBlobUrls && window.localSubtitleBlobUrls.length > 0) {
    window.localSubtitleBlobUrls.forEach(url => URL.revokeObjectURL(url));
    window.localSubtitleBlobUrls = [];
  }
}

// Registrar event listeners para limpieza automática
window.addEventListener('beforeunload', cleanupOnPageUnload);
window.addEventListener('pagehide', cleanupOnPageUnload);

// También limpiar cuando la pestaña pierde visibilidad (cuando el usuario cambia de pestaña)
document.addEventListener('visibilitychange', function() {
  if (document.hidden && currentTorrentInfo && currentTorrentInfo.infoHash) {
    // Pausar el torrent cuando la pestaña se oculta para ahorrar ancho de banda
    fetch(`/api/torrent/stats/${currentTorrentInfo.infoHash}`)
      .then(response => {
        if (response.ok) {
          console.log('Torrent status checked due to tab visibility change');
        }
      })
      .catch(error => {
        console.log('Error checking torrent status on visibility change:', error);
      });
  }
});
