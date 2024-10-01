
let currentPage = 1;
let totalResults = 0;
let isLoading = false;
let originalDescription = '';
let spanishDescription = '';
let originalTitle = '';
let spanishTitle = '';
let selectedAccount;
let showingFavorites = false; 


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
  <i id="heart-icon-${title.id}" 
     class="fas fa-heart" 
     style="cursor: pointer; color: ${isFavorite(title.id, type) ? 'red' : 'black'};" 
     onclick="toggleFavorite(${title.id}, '${type}', event)"></i>
  <i id="eye-icon-${title.id}" class="fas fa-eye" 
     style="cursor: pointer; color: ${isWatched(title.id, type) ? 'blue' : 'black'};" 
     onclick="toggleWatched(${title.id}, '${type}', event)"></i>
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
    // Haz la solicitud a tu servidor, que a su vez pedirá los datos a YTS
    const response = await fetch(`/api/torrents?movieTitle=${encodeURIComponent(movieTitle)}`);

    // Verifica si la respuesta es válida
    if (!response.ok) {
      throw new Error('Error fetching torrents');
    }

    const data = await response.json();

    if (data.length > 0) {
      const movie = data[0]; // Obtén la primera coincidencia de película
      const torrents = movie.torrents;

      // Ordenar los torrents por calidad (4K, 1080p, 720p)
      torrents.sort((a, b) => {
        const qualityOrder = ["4K", "1080p", "720p"];
        return qualityOrder.indexOf(a.quality) - qualityOrder.indexOf(b.quality);
      });

      // Crear el estilo de Quote para los torrents disponibles
      let torrentButtons = `
        <blockquote class="torrent-quote">
          <h3>Torrents disponibles:</h3>
          <div class="torrent-buttons">
      `;

      torrents.forEach((torrent) => {
        torrentButtons += `
          <button class="torrent-button" onclick="window.open('magnet:?xt=urn:btih:${torrent.hash}&dn=${encodeURIComponent(movieTitle)}&tr=udp://tracker.openbittorrent.com:80/announce', '_blank')">
            ${torrent.quality} - ${torrent.size}
          </button>
        `;
      });

      torrentButtons += `</div></blockquote>`;

      // Agregar los botones al modal dentro de la cita
      elements.modalDescription.insertAdjacentHTML("beforeend", torrentButtons);
    } else {
      elements.modalDescription.insertAdjacentHTML(
        "beforeend",
        "<p>No hay torrents disponibles para esta película.</p>"
      );
    }
  } catch (error) {
    console.error("Error fetching torrents:", error);
  }
}




// Función para cerrar el modal
function closeModal() {
  elements.modal.style.display = "none";
  elements.modalTrailer.innerHTML = ""; // Limpiar tráiler cuando se cierra el modal
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
