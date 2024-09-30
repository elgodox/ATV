
let currentPage = 1;
let totalResults = 0;
let originalDescription = '';
let spanishDescription = '';
let originalTitle = '';
let spanishTitle = '';

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
  prevPageButton: document.getElementById("prev-page"),
  nextPageButton: document.getElementById("next-page"),
  platformSelect: document.getElementById("platform"),
  sortSelect: document.getElementById("sort")
  
};

document.getElementById("type").addEventListener("change", applyFilters);
document.getElementById("genre").addEventListener("change", applyFilters);
document.getElementById("platform").addEventListener("change", applyFilters);
document.getElementById("sort").addEventListener("change", applyFilters);
document.getElementById('type').addEventListener('change', updateGenreSelect);

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
  const type = document.getElementById('type').value;  
  const genre = document.getElementById('genre').value;
  const platform = document.getElementById('platform').value;
  const sortBy = document.getElementById('sort').value;
  const searchQuery = document.getElementById('search-bar') ? document.getElementById('search-bar').value.trim() : '';

  const params = new URLSearchParams({
    type,
    searchQuery,
    genre,
    platform,
    sortBy,
    page
  }).toString();

  try {
    const data = await fetchData('titles', params);
    
    // Verificación de resultados
    if (!data || !data.results || data.results.length === 0) {
      elements.movieGrid.innerHTML = '<p>No se encontraron resultados.</p>';
      return;
    }

    totalResults = data.total_results;
    elements.movieGrid.innerHTML = '';

    // Obtener los géneros y mapearlos por su ID
    const genreData = await fetchData('genres');
    const genreMap = {};
    genreData.genres.forEach(genre => {
      genreMap[genre.id] = genre.name;
    });

    // Iterar sobre cada título
    data.results.forEach(async (title) => {
      const movieCard = document.createElement('div');
      movieCard.classList.add('movie-card');

      // Obtener los géneros de la película/serie
      const movieGenres = title.genre_ids.map(id => genreMap[id]).join(', ');

      // Obtener las plataformas disponibles
      const providers = await fetchProvider(title.id, type);
      const providerNames = providers ? providers.join(', ') : 'No disponible';

      // Verificar el título y la fecha según si es película o serie de TV
      const titleName = title.original_title || title.original_name || 'Título desconocido';
      const releaseDate = title.release_date || title.first_air_date || 'Fecha desconocida';

      let seasons = '';
    let status = '';

    // Si es una serie de TV, obtener el número de temporadas y el estado (si está finalizada o no)
    if (type === 'tv') {
      const tvDetails = await fetchTVDetails(title.id);  // Realizar la solicitud adicional
      seasons = tvDetails ? `${tvDetails.number_of_seasons} Temporadas` : 'N/A';
      status = tvDetails ? (tvDetails.status === 'Ended' ? 'Finalizada' : 'En emisión') : 'Estado desconocido';
    }

      // Renderizar la valoración con estrellas
      const stars = renderStars(title.vote_average);  // Convertir la valoración a estrellas

      // Renderizar la tarjeta de película/serie con géneros, plataformas, temporadas (si es TV), estado y valoración
    movieCard.innerHTML = `
    <img src="https://image.tmdb.org/t/p/w500${title.poster_path}" alt="${titleName}">
    <h3>${titleName}</h3>
    <p><strong>Estreno:</strong> ${releaseDate}</p>
    <p><strong>Género:</strong> ${movieGenres}</p>
    ${seasons ? `<p><strong>Temporadas:</strong> ${seasons}</p>` : ''}
    ${status ? `<p><strong>Estado:</strong> ${status}</p>` : ''}
    <p><strong>Plataformas:</strong> ${providerNames}</p>
    <p><strong>Valoración:</strong> ${stars}</p>
  `;

      // Asignar evento de clic para mostrar detalles
      movieCard.addEventListener('click', () => {
        showDetails(title.id, type, movieCard);
      });

      elements.movieGrid.appendChild(movieCard);
    });

  } catch (error) {
    console.error('Error fetching titles:', error);
    elements.movieGrid.innerHTML = '<p>Error al cargar los títulos. Intente nuevamente.</p>';
  }

  // Actualizar la paginación
  elements.currentPage.textContent = page;
  elements.prevPageButton.disabled = currentPage === 1;
  elements.nextPageButton.disabled = currentPage * 20 >= totalResults;
}


// Función para avanzar a la siguiente página
function nextPage() {
  if (currentPage * 20 < totalResults) {
    currentPage++;
    getTitles(currentPage);
  }
}

// Función para retroceder a la página anterior
function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    getTitles(currentPage);
  }
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

    // Mostrar tráiler si está disponible
    const trailer = dataOriginal.videos?.results?.find(video => video.type === 'Trailer' && video.site === 'YouTube');
    if (trailer) {
      elements.modalTrailer.innerHTML = `<iframe src="https://www.youtube.com/embed/${trailer.key}" frameborder="0" allowfullscreen></iframe>`;
    } else {
      elements.modalTrailer.innerHTML = "<p>No hay tráiler disponible.</p>";
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




// Función para buscar un tráiler en Vimeo
async function fetchVimeoTrailer(movieTitle) {
  const searchUrl = `https://api.vimeo.com/videos?query=${encodeURIComponent(movieTitle)}&per_page=1&access_token=0f71c71042a935a28f001427100c2edf`;
  
  try {
    const response = await fetch(searchUrl);
    const data = await response.json();

    if (data && data.data && data.data.length > 0) {
      const vimeoTrailerId = data.data[0].uri.split('/').pop(); // Extraer el ID del video
      return vimeoTrailerId; // Devolver el ID del video para incrustarlo
    }
  } catch (error) {
    console.error("Error fetching Vimeo trailer:", error);
  }

  return null; // No se encontró tráiler
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
  currentPage = 1;
  getTitles(currentPage);
}

// Inicializar la carga de títulos y géneros
getTitles();
fetchGenres();
fetchProviders("movie"); // Cargar proveedores iniciales de películas (por defecto)

window.onload = function() {
  updateGenreSelect();  // Cargar los géneros iniciales (por ejemplo, películas)
};
