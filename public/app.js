// Import Supabase functions
import { 
  initializeAuth, 
  signIn, 
  signUp, 
  signOut, 
  getCurrentUser, 
  isAuthenticated,
  onAuthStateChange 
} from './supabase-config.js';

import { 
  getFavorites,
  addFavorite,
  removeFavorite,
  isFavorite as checkIsFavorite,
  getWatchedItems,
  addWatchedItem,
  removeWatchedItem,
  isWatched as checkIsWatched
} from './database.js';

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
    'torrent-subtitle-select',
    'language-select',
    'search-subtitles-btn', 
    'online-subtitle-select',
    'subtitle-file',
    'uploaded-subtitle-select',
    'select-file-btn',
    'upload-subtitle-btn'
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

// Función para mostrar/ocultar indicador de carga en búsqueda
function showSearchLoading(show) {
  const loadingIndicator = document.getElementById('search-loading');
  if (loadingIndicator) {
    if (show) {
      loadingIndicator.classList.remove('hidden');
    } else {
      loadingIndicator.classList.add('hidden');
    }
  }
}

// Función para mostrar información de resultados de búsqueda
function showSearchResultsInfo(data) {
  const resultsInfo = document.getElementById('search-results-info');
  const resultsCount = document.getElementById('results-count');
  const resultsBreakdown = document.getElementById('results-breakdown');
  
  if (resultsInfo && resultsCount && resultsBreakdown) {
    const totalResults = data.total_results || 0;
    const movieResults = data.movie_results || 0;
    const tvResults = data.tv_results || 0;
    
    // Build results text with filtering indicators
    let resultsText = `${totalResults} resultado${totalResults !== 1 ? 's' : ''} encontrado${totalResults !== 1 ? 's' : ''}`;
    
    // Add filtering indicators
    if (data.is_filtered && data.active_filters) {
      const filterIndicators = [];
      
      if (data.active_filters.platform) {
        const platformSelect = document.getElementById('platform');
        const platformText = platformSelect ? platformSelect.options[platformSelect.selectedIndex].text : data.active_filters.platform;
        filterIndicators.push(`📱 ${platformText}`);
      }
      
      if (data.active_filters.genre) {
        const genreSelect = document.getElementById('genre');
        const genreText = genreSelect ? genreSelect.options[genreSelect.selectedIndex].text : data.active_filters.genre;
        filterIndicators.push(`🎪 ${genreText}`);
      }
      
      if (data.active_filters.type) {
        const typeSelect = document.getElementById('type');
        const typeText = typeSelect ? typeSelect.options[typeSelect.selectedIndex].text : data.active_filters.type;
        filterIndicators.push(`🎭 ${typeText}`);
      }
      
      // Filtro de contenido adulto oculto de los resultados por privacidad
      /*
      if (data.active_filters.adultFilter) {
        const adultFilterToggle = document.getElementById('adult-filter');
        let adultFilterText = 'Sin contenido +18';
        if (adultFilterToggle) {
          const state = adultFilterToggle.getAttribute('data-state');
          switch (state) {
            case 'false': adultFilterText = '🚫 Sin contenido +18'; break;
            case '': adultFilterText = '🔞 Con contenido +18'; break;
            case 'only': adultFilterText = '🔞 Solo contenido +18'; break;
          }
        }
        filterIndicators.push(adultFilterText);
      }
      */
      
      if (filterIndicators.length > 0) {
        resultsText += ` (filtrado por: ${filterIndicators.join(', ')})`;
      }
    }
    
    resultsCount.textContent = resultsText;
    
    if (movieResults > 0 && tvResults > 0) {
      resultsBreakdown.textContent = `${movieResults} película${movieResults !== 1 ? 's' : ''} • ${tvResults} serie${tvResults !== 1 ? 's' : ''}`;
    } else if (movieResults > 0) {
      resultsBreakdown.textContent = `${movieResults} película${movieResults !== 1 ? 's' : ''}`;
    } else if (tvResults > 0) {
      resultsBreakdown.textContent = `${tvResults} serie${tvResults !== 1 ? 's' : ''}`;
    } else {
      resultsBreakdown.textContent = '';
    }
    
    resultsInfo.classList.remove('hidden');
  }
}

// Función para ocultar información de resultados
function hideSearchResultsInfo() {
  const resultsInfo = document.getElementById('search-results-info');
  if (resultsInfo) {
    resultsInfo.classList.add('hidden');
  }
}

// Función para limpiar todos los filtros
function clearAllFilters() {
  // Limpiar campo de búsqueda
  const searchBar = document.getElementById('search-bar');
  if (searchBar) {
    searchBar.value = '';
  }
  
  // Resetear filtros a valores por defecto
  const typeSelect = document.getElementById('type');
  const genreSelect = document.getElementById('genre');
  const platformSelect = document.getElementById('platform');
  const adultFilterToggle = document.getElementById('adult-filter');
  const sortSelect = document.getElementById('sort');
  
  if (typeSelect) typeSelect.value = '';
  if (genreSelect) genreSelect.value = '';
  if (platformSelect) platformSelect.value = '';
  if (adultFilterToggle) {
    adultFilterToggle.setAttribute('data-state', 'false');
    updateAdultFilterDisplay(adultFilterToggle);
  }
  if (sortSelect) sortSelect.value = 'popularity.desc';
  
  // Limpiar radio buttons de tipo
  const typeRadios = document.querySelectorAll('input[name="type"]');
  typeRadios.forEach(radio => {
    radio.checked = radio.value === '';
  });
  
  // Desactivar filtro de favoritos
  const favoritesCheckbox = document.getElementById('favorites-checkbox');
  if (favoritesCheckbox) {
    favoritesCheckbox.checked = false;
    showingFavorites = false;
    updateFavoritesChip();
  }
  
  // Ocultar información de resultados
  hideSearchResultsInfo();
  
  // Recargar contenido inicial
  currentPage = 1;
  getTitles(currentPage);
  
  // Mostrar notificación (if available)
  if (typeof showNotification === 'function') {
    showNotification('Filtros limpiados correctamente', 'success', 2000);
  }
}

// Adult filter toggle functionality
function updateAdultFilterDisplay(toggle) {
  const state = toggle.getAttribute('data-state');
  const icon = toggle.querySelector('.toggle-icon');
  const text = toggle.querySelector('.toggle-text');
  
  switch (state) {
    case 'false':
      icon.textContent = '🚫';
      text.textContent = 'Excluir contenido +18';
      break;
    case '':
      icon.textContent = '🔞';
      text.textContent = 'Incluir contenido +18';
      break;
    case 'only':
      icon.textContent = '🔞';
      text.textContent = 'Solo contenido +18';
      break;
  }
}

function cycleAdultFilter() {
  const toggle = document.getElementById('adult-filter');
  const currentState = toggle.getAttribute('data-state');
  
  let nextState;
  switch (currentState) {
    case 'false': nextState = ''; break;      // exclude -> include all
    case '': nextState = 'only'; break;       // include all -> only adult
    case 'only': nextState = 'false'; break; // only adult -> exclude
    default: nextState = 'false'; break;     // fallback to exclude
  }
  
  toggle.setAttribute('data-state', nextState);
  updateAdultFilterDisplay(toggle);
  applyFilters();
}

// Comentamos estos event listeners para moverlos al DOMContentLoaded
// document.getElementById("type").addEventListener("change", applyFilters);
// document.getElementById("genre").addEventListener("change", applyFilters);
// document.getElementById("platform").addEventListener("change", applyFilters);
// document.getElementById("adult-filter").addEventListener("click", cycleAdultFilter);
// document.getElementById("sort").addEventListener("change", applyFilters);

// Nuevas funcionalidades para la interfaz rediseñada
document.addEventListener('DOMContentLoaded', function() {
  initializeNewInterface();
  
  // Registrar todos los event listeners de filtros
  const typeSelect = document.getElementById("type");
  const genreSelect = document.getElementById("genre");
  const platformSelect = document.getElementById("platform");
  const sortSelect = document.getElementById("sort");
  const adultFilter = document.getElementById("adult-filter");
  
  if (typeSelect) {
    typeSelect.addEventListener("change", applyFilters);
    typeSelect.addEventListener('change', updateGenreSelect);
  }
  if (genreSelect) genreSelect.addEventListener("change", applyFilters);
  if (platformSelect) platformSelect.addEventListener("change", applyFilters);
  if (sortSelect) sortSelect.addEventListener("change", applyFilters);
  if (adultFilter) adultFilter.addEventListener("click", cycleAdultFilter);
  
  // Event listener para el botón de limpiar filtros
  const clearFiltersBtn = document.getElementById('clear-filters-btn');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', clearAllFilters);
  }
  
  // Initialize adult filter toggle
  const adultFilterToggle = document.getElementById('adult-filter');
  if (adultFilterToggle) {
    updateAdultFilterDisplay(adultFilterToggle);
  }
  
  // Cargar contenido inicial
  getTitles(1);
});

function initializeNewInterface() {
  // Inicializar toggle de filtros
  initializeFiltersToggle();
  
  // Inicializar sugerencias de búsqueda
  initializeSearchSuggestions();
  
  // Inicializar filtros de tipo de contenido (radio buttons)
  initializeTypeFilters();
  
  // Inicializar búsqueda por voz (opcional)
  initializeVoiceSearch();
  
  // Inicializar configuración avanzada
  initializeAdvancedSettings();
}

// Configuración avanzada (contenido adulto)
function initializeAdvancedSettings() {
  const advancedSettings = document.querySelector('.adult-content-settings');
  
  if (advancedSettings) {
    // Añadir animación suave al abrir/cerrar
    advancedSettings.addEventListener('toggle', function() {
      if (this.open) {
        this.querySelector('.settings-content').style.animation = 'slideDown 0.3s ease-out';
      }
    });
  }
}

// Toggle para mostrar/ocultar filtros expandidos
function initializeFiltersToggle() {
  const filtersToggle = document.getElementById('filters-toggle');
  const filtersContent = document.getElementById('filters-content');
  
  if (filtersToggle && filtersContent) {
    filtersToggle.addEventListener('click', function() {
      const isExpanded = filtersContent.classList.contains('expanded');
      
      if (isExpanded) {
        filtersContent.classList.remove('expanded');
        filtersToggle.classList.remove('active');
        // Update ARIA attribute
        filtersToggle.setAttribute('aria-expanded', 'false');
      } else {
        filtersContent.classList.add('expanded');
        filtersToggle.classList.add('active');
        // Update ARIA attribute
        filtersToggle.setAttribute('aria-expanded', 'true');
      }
    });
    
    // Keyboard navigation support
    filtersToggle.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.click();
      }
    });
  }
}

// Sugerencias de búsqueda rápida
function initializeSearchSuggestions() {
  const suggestionTags = document.querySelectorAll('.suggestion-tag');
  const searchBar = document.getElementById('search-bar');
  
  suggestionTags.forEach(tag => {
    // Click handler
    tag.addEventListener('click', function() {
      const searchTerm = this.getAttribute('data-search');
      if (searchBar && searchTerm) {
        searchBar.value = searchTerm;
        searchBar.focus();
        // Trigger search
        performSearch();
      }
    });
    
    // Keyboard navigation support
    tag.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.click();
      }
    });
    
    // Enhanced visual feedback for keyboard focus
    tag.addEventListener('focus', function() {
      this.style.transform = 'translateY(-2px)';
    });
    
    tag.addEventListener('blur', function() {
      this.style.transform = '';
    });
  });
}

// Filtros de tipo de contenido con radio buttons
function initializeTypeFilters() {
  const typeRadios = document.querySelectorAll('input[name="type"]');
  
  typeRadios.forEach(radio => {
    radio.addEventListener('change', function() {
      if (this.checked) {
        // Actualizar el select oculto para mantener compatibilidad
        const typeSelect = document.getElementById('type');
        if (typeSelect) {
          typeSelect.value = this.value;
          applyFilters();
          updateGenreSelect(); // Actualizar géneros según el tipo
        }
      }
    });
  });
}

// Búsqueda por voz (funcionalidad básica)
function initializeVoiceSearch() {
  const voiceBtn = document.querySelector('.voice-search-btn');
  
  if (voiceBtn && 'webkitSpeechRecognition' in window) {
    const recognition = new webkitSpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;
    
    voiceBtn.addEventListener('click', function() {
      recognition.start();
      this.classList.add('listening');
      this.innerHTML = '<i class="fas fa-circle" style="color: #ff1493;"></i>';
    });
    
    recognition.onresult = function(event) {
      const transcript = event.results[0][0].transcript;
      const searchBar = document.getElementById('search-bar');
      if (searchBar) {
        searchBar.value = transcript;
        performSearch();
      }
    };
    
    recognition.onend = function() {
      voiceBtn.classList.remove('listening');
      voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    };
    
    recognition.onerror = function() {
      voiceBtn.classList.remove('listening');
      voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
      showNotification('Error en el reconocimiento de voz', 'error');
    };
  } else if (voiceBtn) {
    // Ocultar el botón si no hay soporte
    voiceBtn.style.display = 'none';
  }
}

// Función para sincronizar radio buttons con select cuando se cambia externamente
function syncTypeFilters(selectedValue) {
  const typeRadios = document.querySelectorAll('input[name="type"]');
  typeRadios.forEach(radio => {
    radio.checked = radio.value === selectedValue;
  });
}

// Función para actualizar el estado visual del chip de favoritos
function updateFavoritesChip() {
  const favoritesChip = document.querySelector('.favorites-chip');
  const favoritesCheckbox = document.getElementById('favorites-checkbox');
  
  if (favoritesChip && favoritesCheckbox) {
    if (favoritesCheckbox.checked) {
      favoritesChip.classList.add('active');
    } else {
      favoritesChip.classList.remove('active');
    }
  }
}

// Función helper para realizar búsqueda
function performSearch() {
  const searchBar = document.getElementById('search-bar');
  if (searchBar && searchBar.value.trim()) {
    applyFilters();
  }
}

// Authentication Event Listeners
document.addEventListener('DOMContentLoaded', function() {
  // Initialize authentication
  initializeAuth().then(isLoggedIn => {
    updateAuthUI(isLoggedIn);
  });

  // Set up auth state change listener
  onAuthStateChange((event, session) => {
    updateAuthUI(!!session);
  });

  // Login button
  document.getElementById('login-btn').addEventListener('click', showLoginModal);
  
  // Register button  
  document.getElementById('register-btn').addEventListener('click', showRegisterModal);
  
  // Logout button
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  
  // Modal close
  document.getElementById('auth-modal-close').addEventListener('click', hideAuthModal);
  
  // Switch between login and register
  document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterForm();
  });
  
  document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
  });
  
  // Form submissions
  document.getElementById('login-form-element').addEventListener('submit', handleLogin);
  document.getElementById('register-form-element').addEventListener('submit', handleRegister);
  
  // Close modal when clicking outside
  document.getElementById('auth-modal').addEventListener('click', (e) => {
    if (e.target.id === 'auth-modal') {
      hideAuthModal();
    }
  });

  // Initialize other components
  updateGenreSelect();  // Cargar los géneros iniciales (por ejemplo, películas)

  // Debug: verificar que los elementos principales existan
  setTimeout(() => {
    console.log('=== DEBUG: Verificando elementos ===');
    const requiredElements = [
      'search-bar',
      'filters-toggle', 
      'filters-content',
      'type',
      'genre',
      'platform',
      'sort',
      'adult-filter',
      'movie-grid'
    ];
    
    requiredElements.forEach(id => {
      const element = document.getElementById(id);
      console.log(`${id}:`, element ? '✓ Encontrado' : '✗ NO ENCONTRADO');
    });
    
    console.log('Radio buttons tipo:', document.querySelectorAll('input[name="type"]').length);
    console.log('=== FIN DEBUG ===');
  }, 1000);
});


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
    const data = await response.json();
    
    // Verificar que sea un array (puede ser un objeto de error si no hay API key)
    if (Array.isArray(data)) {
      return data;
    } else if (data && Array.isArray(data.genres)) {
      return data.genres;
    } else {
      console.warn('Invalid genres response:', data);
      return [];
    }
  } catch (error) {
    console.error('Error fetching genres:', error);
    return [];
  }
}

// Actualizar el select de géneros según el tipo de contenido (movie o tv)
async function updateGenreSelect() {
  // Obtener el tipo desde el select oculto o desde los radio buttons
  let type = document.getElementById('type').value;
  
  // Si no hay valor en el select, obtenerlo de los radio buttons
  if (!type) {
    const selectedRadio = document.querySelector('input[name="type"]:checked');
    if (selectedRadio) {
      type = selectedRadio.value;
    }
  }
  
  const genres = await getGenres(type);  // Obtener los géneros desde el servidor
  const genreSelect = document.getElementById('genre');

  // Limpiar el select de géneros
  genreSelect.innerHTML = '<option value="">Todos los géneros</option>';

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

  // Mostrar indicador de carga
  showSearchLoading(true);

  // Obtener el tipo desde el select o desde los radio buttons
  let type = document.getElementById('type').value;
  if (!type) {
    const selectedRadio = document.querySelector('input[name="type"]:checked');
    if (selectedRadio) {
      type = selectedRadio.value;
      // Sincronizar con el select oculto
      document.getElementById('type').value = type;
    }
  }
  
  const genre = document.getElementById('genre').value;
  const platform = document.getElementById('platform').value;
  const adultFilter = document.getElementById('adult-filter').getAttribute('data-state');
  const sortBy = document.getElementById('sort').value;
  const searchQuery = document.getElementById('search-bar') ? document.getElementById('search-bar').value.trim() : '';

  if (page === 1) {
    elements.movieGrid.innerHTML = ''; // Limpiar el grid al cambiar de página
  }

  let data;
  
  // Verificar si el filtro de favoritos está activo
  if (showingFavorites) {
    if (!isAuthenticated()) {
      elements.movieGrid.innerHTML = '<p>Debes iniciar sesión para ver tus favoritos.</p>';
      showSearchLoading(false);
      isLoading = false;
      return;
    }

    try {
      const favorites = await getFavorites();

      // Filter favorites by the current type (movie or tv), or all if no type selected
      let filteredFavorites = favorites;
      if (type && type !== '') {
        filteredFavorites = favorites.filter(fav => fav.type === type);
      }

      if (filteredFavorites.length === 0) {
          elements.movieGrid.innerHTML = '<p>No tienes favoritos en esta categoría.</p>';
          showSearchLoading(false);
          isLoading = false;
          return;
      }

      // Obtener los detalles de cada película/serie en la lista de favoritos
      data = { results: [] };

      for (let favorite of filteredFavorites) {
          const response = await fetch(`/api/titles/details?id=${favorite.movie_id}&type=${favorite.type}&language=en`);
          const movie = await response.json();
          if (movie && movie.poster_path) { // Only include results with images
              movie.content_type = favorite.type; // Asegurar que el tipo esté disponible
              data.results.push(movie);
          }
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
      elements.movieGrid.innerHTML = '<p>Error al cargar favoritos.</p>';
      showSearchLoading(false);
      isLoading = false;
      return;
    }
  } else if (searchQuery && searchQuery.length > 0) {
    // Si hay búsqueda, usar la nueva API que busca en ambos tipos
    const params = new URLSearchParams({
      searchQuery,
      type, // Pass type filter to search API
      genre,
      platform,
      adultFilter,
      sortBy,
      page
    }).toString();

    data = await fetchData('search-all', params);
  } else {
    // Si no hay búsqueda, usar la API original
    // Si no se especifica tipo, mostrar contenido por defecto (películas)
    const defaultType = type || 'movie';
    const params = new URLSearchParams({
      type: defaultType,
      searchQuery,
      genre,
      platform,
      adultFilter,
      sortBy,
      page
    }).toString();

    data = await fetchData('titles', params);
    
    // Agregar el tipo de contenido a los resultados
    if (data && data.results) {
      data.results = data.results.map(item => ({
        ...item,
        content_type: defaultType
      }));
    }
  }

  // Ocultar indicador de carga
  showSearchLoading(false);

  // Validar que tengamos resultados
  if (!data || !data.results || data.results.length === 0) {
    if (currentPage === 1) {
      elements.movieGrid.innerHTML = '<p>No se encontraron resultados.</p>';
      hideSearchResultsInfo();
    }
    isLoading = false;
    return;
  }

  // Mostrar información de resultados si hay búsqueda
  if (searchQuery && searchQuery.length > 0) {
    showSearchResultsInfo(data);
  } else {
    hideSearchResultsInfo();
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
    
    // Determinar el tipo de contenido
    const contentType = title.content_type || type || 'movie';
    movieCard.classList.add(`content-${contentType}`);
    movieCard.setAttribute('data-type', contentType);
    movieCard.setAttribute('data-id', title.id);

    // Obtener los géneros de la película/serie
    const movieGenres = title.genre_ids ? title.genre_ids.map(id => genreMap[id]).join(', ') : title.genres ? title.genres.map(genre => genre.name).join(', ') : 'N/A';

    // Obtener las plataformas disponibles
    const providers = await fetchProvider(title.id, contentType);
    const providerNames = providers ? providers.join(', ') : 'No disponible';

    // Función auxiliar para detectar caracteres no latinos
    const containsNonLatinChars = (str) => {
      if (!str) return false;
      // Detectar caracteres asiáticos (coreano, japonés, chino, etc.)
      return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf\uac00-\ud7a3]/.test(str);
    };

    // Lógica inteligente para seleccionar el título - priorizar caracteres latinos
    let titleName;
    if (title.title && !containsNonLatinChars(title.title)) {
      // Para películas, usar title si está en caracteres latinos
      titleName = title.title;
    } else if (title.name && !containsNonLatinChars(title.name)) {
      // Para series, usar name si está en caracteres latinos
      titleName = title.name;
    } else if (title.original_title && !containsNonLatinChars(title.original_title)) {
      // Si original_title está en caracteres latinos, usarlo
      titleName = title.original_title;
    } else if (title.original_name && !containsNonLatinChars(title.original_name)) {
      // Si original_name está en caracteres latinos, usarlo
      titleName = title.original_name;
    } else {
      // Como último recurso, usar cualquiera que esté disponible
      titleName = title.title || title.name || title.original_title || title.original_name || 'Título desconocido';
    }

    // Verificar la fecha según si es película o serie de TV
    const releaseDate = title.release_date || title.first_air_date || 'Fecha desconocida';

    let seasons = '';
    let status = '';

    if (contentType === 'tv') {
      const tvDetails = await fetchTVDetails(title.id);
      seasons = tvDetails ? `${tvDetails.number_of_seasons} Temporadas` : 'N/A';
      status = tvDetails ? (tvDetails.status === 'Ended' ? 'Finalizada' : 'En emisión') : 'Estado desconocido';
    }

    const stars = renderStars(title.vote_average);

    // Tag de tipo de contenido (simplificado)
    const contentTypeTag = contentType === 'movie' ? 'Película' : 'Serie';
    
    movieCard.innerHTML = `
    <div class="content-type-tag ${contentType}">${contentTypeTag}</div>
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
         style="cursor: pointer; color: black;" 
         onclick="toggleFavorite(${title.id}, '${contentType}', event)"></i>
      <i id="eye-icon-${title.id}" 
         class="fas fa-eye" 
         style="cursor: pointer; color: black;" 
         onclick="toggleWatched(${title.id}, '${contentType}', event)"></i>
    </div>
  `;
  
    // Add the card to the DOM first
    movieCard.addEventListener('click', () => {
      showDetails(title.id, contentType, movieCard);
    });

    elements.movieGrid.appendChild(movieCard);
    
    // Then update the favorite and watched status asynchronously
    updateCardStatus(title.id, contentType);
  });

// Function to update card status (favorites and watched) asynchronously
async function updateCardStatus(movieId, contentType) {
  if (!isAuthenticated()) {
    return;
  }
  
  try {
    // Check favorite status
    const isFav = await checkIsFavorite(movieId, contentType);
    const heartIcon = document.getElementById(`heart-icon-${movieId}`);
    if (heartIcon) {
      heartIcon.style.color = isFav ? 'red' : 'black';
    }
    
    // Check watched status
    const isWatchedStatus = await checkIsWatched(movieId, contentType);
    const eyeIcon = document.getElementById(`eye-icon-${movieId}`);
    const movieCard = document.getElementById(`movie-card-${movieId}`);
    
    if (eyeIcon) {
      eyeIcon.style.color = isWatchedStatus ? 'blue' : 'black';
    }
    
    if (movieCard) {
      if (isWatchedStatus) {
        movieCard.classList.add('watched');
      } else {
        movieCard.classList.remove('watched');
      }
    }
  } catch (error) {
    console.error('Error updating card status:', error);
  }
}

  isLoading = false; // Marcamos como terminado
}


async function toggleWatched(movieId, type, event) {
  event.stopPropagation(); // Evita que se abra el modal al hacer clic en el ícono

  if (!isAuthenticated()) {
    showNotification("Primero debes iniciar sesión", 'warning');
    return;
  }

  try {
    const isWatchedStatus = await checkIsWatched(movieId, type);
    const movieCard = document.querySelector(`#movie-card-${movieId}`);
    
    if (isWatchedStatus) {
      // Si ya está en la lista de vistos, quitarlo
      await removeWatchedItem(movieId, type);
      document.getElementById(`eye-icon-${movieId}`).style.color = 'black';
      movieCard.classList.remove('watched');
      showNotification('Eliminado de vistos', 'info');
    } else {
      // Si no está en la lista, agregarlo
      await addWatchedItem(movieId, type);
      document.getElementById(`eye-icon-${movieId}`).style.color = 'blue';
      movieCard.classList.add('watched');
      showNotification('Marcado como visto', 'success');
    }
  } catch (error) {
    console.error('Error toggling watched status:', error);
    showNotification('Error al gestionar estado de visto', 'error');
  }
}



async function isWatched(movieId, type) {
  if (!isAuthenticated()) {
    return false;
  }
  
  try {
    return await checkIsWatched(movieId, type);
  } catch (error) {
    console.error('Error checking watched status:', error);
    return false;
  }
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
async function isFavorite(movieId, type) {
  if (!isAuthenticated()) {
    return false;
  }
  
  try {
    return await checkIsFavorite(movieId, type);
  } catch (error) {
    console.error('Error checking favorite:', error);
    return false;
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


// Función mejorada para cargar trailers con múltiples fuentes y mejor relevancia
async function loadEnhancedTrailer(id, type, title, dataOriginal) {
  // Para series de TV, mostrar selector de temporadas si hay múltiples temporadas
  if (type === 'tv' && dataOriginal && dataOriginal.number_of_seasons > 1) {
    await displayTVSeasonTrailers(id, type, title, dataOriginal);
  } else {
    // Para películas o series con una sola temporada, cargar trailer directamente
    await loadSingleTrailer(id, type, title, dataOriginal);
  }
}

// Función para cargar un solo trailer (películas o series sin selector de temporada)
async function loadSingleTrailer(id, type, title, dataOriginal, season = null) {
  // Mostrar indicador de carga
  elements.modalTrailer.innerHTML = '<div class="trailer-loading"><i class="fas fa-spinner fa-spin"></i> Buscando trailer...</div>';
  
  try {
    // Extraer año de lanzamiento para búsqueda más precisa
    let year = null;
    if (dataOriginal) {
      if (type === 'movie') {
        year = dataOriginal.release_date ? new Date(dataOriginal.release_date).getFullYear() : null;
      } else if (type === 'tv') {
        year = dataOriginal.first_air_date ? new Date(dataOriginal.first_air_date).getFullYear() : null;
      }
    }

    // Usar la nueva API mejorada
    const params = new URLSearchParams({
      title: title,
      type: type,
      id: id
    });
    
    if (year) {
      params.append('year', year);
    }
    
    if (season) {
      params.append('season', season);
    }

    const response = await fetch(`/api/enhanced-trailer?${params}`);
    
    if (response.ok) {
      const trailerData = await response.json();
      displayTrailer(trailerData);
    } else {
      // Si no se encontró trailer, mostrar fallback con imágenes
      await displayImageFallback(dataOriginal, title, season);
    }
  } catch (error) {
    console.error('Error loading enhanced trailer:', error);
    await displayImageFallback(dataOriginal, title, season);
  }
}

// Función para mostrar selector de temporadas y trailers para series de TV
async function displayTVSeasonTrailers(id, type, title, dataOriginal) {
  const seasons = dataOriginal.seasons || [];
  const regularSeasons = seasons.filter(season => season.season_number > 0);
  
  if (regularSeasons.length === 0) {
    await loadSingleTrailer(id, type, title, dataOriginal);
    return;
  }
  
  // Crear selector de temporadas minimalista
  let seasonSelector = `
    <div class="tv-trailer-selector">
      <div class="selector-header">
        <h4><i class="fas fa-tv"></i> Trailers</h4>
        <p>Selecciona una temporada:</p>
      </div>
      <div class="season-buttons">
  `;
  
  // Agregar botón para trailer general
  seasonSelector += `
    <button class="season-btn active" data-season="general" onclick="loadSeasonTrailer('${id}', '${type}', '${title}', null)">
      <i class="fas fa-film"></i>
      <span>General</span>
    </button>
  `;
  
  // Agregar botones para cada temporada (más compactos)
  regularSeasons.slice(0, 8).forEach(season => { // Limitar a 8 temporadas para mantener compacto
    seasonSelector += `
      <button class="season-btn" data-season="${season.season_number}" onclick="loadSeasonTrailer('${id}', '${type}', '${title}', ${season.season_number})">
        <i class="fas fa-play-circle"></i>
        <span>T${season.season_number}</span>
        <small>${season.episode_count}ep</small>
      </button>
    `;
  });
  
  // Si hay más de 8 temporadas, agregar indicador
  if (regularSeasons.length > 8) {
    seasonSelector += `
      <button class="season-btn" disabled style="opacity: 0.5;">
        <i class="fas fa-ellipsis-h"></i>
        <span>+${regularSeasons.length - 8}</span>
        <small>más</small>
      </button>
    `;
  }
  
  seasonSelector += `
      </div>
      <div id="selected-trailer-container">
        <!-- El trailer seleccionado aparecerá aquí -->
      </div>
    </div>
  `;
  
  elements.modalTrailer.innerHTML = seasonSelector;
  
  // Cargar trailer general por defecto
  await loadSeasonTrailerContent(id, type, title, dataOriginal, null);
}

// Función para cargar trailer de temporada específica
async function loadSeasonTrailerContent(id, type, title, dataOriginal, season) {
  const container = document.getElementById('selected-trailer-container');
  if (!container) return;
  
  // Mostrar indicador de carga
  container.innerHTML = '<div class="trailer-loading"><i class="fas fa-spinner fa-spin"></i> Buscando trailer...</div>';
  
  try {
    // Extraer año de lanzamiento
    let year = null;
    if (dataOriginal && dataOriginal.first_air_date) {
      year = new Date(dataOriginal.first_air_date).getFullYear();
    }

    // Usar la nueva API mejorada
    const params = new URLSearchParams({
      title: title,
      type: type,
      id: id
    });
    
    if (year) {
      params.append('year', year);
    }
    
    if (season) {
      params.append('season', season);
    }

    const response = await fetch(`/api/enhanced-trailer?${params}`);
    
    if (response.ok) {
      const trailerData = await response.json();
      displayTrailerInContainer(trailerData, container);
    } else {
      // Si no se encontró trailer, mostrar fallback con imágenes
      await displayImageFallbackInContainer(dataOriginal, title, season, container);
    }
  } catch (error) {
    console.error('Error loading season trailer:', error);
    await displayImageFallbackInContainer(dataOriginal, title, season, container);
  }
}

// Función global para cargar trailer de temporada (llamada desde onClick)
window.loadSeasonTrailer = async function(id, type, title, season) {
  // Actualizar botones activos
  document.querySelectorAll('.season-btn').forEach(btn => btn.classList.remove('active'));
  const clickedBtn = document.querySelector(`[data-season="${season || 'general'}"]`);
  if (clickedBtn) clickedBtn.classList.add('active');
  
  // Obtener datos originales desde variables globales o DOM
  const dataOriginal = window.currentDataOriginal || null;
  
  await loadSeasonTrailerContent(id, type, title, dataOriginal, season);
}

// Función para mostrar el trailer
function displayTrailer(trailerData) {
  const { videoId, source, title, official, fromTMDb, season } = trailerData;
  
  let embedUrl;
  let trailerInfo = '';
  
  // Crear URL del embed según la fuente
  if (source === 'youtube') {
    embedUrl = `https://www.youtube.com/embed/${videoId}`;
  } else if (source === 'vimeo') {
    embedUrl = `https://player.vimeo.com/video/${videoId}`;
  } else if (source === 'dailymotion') {
    embedUrl = `https://www.dailymotion.com/embed/video/${videoId}`;
  } else {
    elements.modalTrailer.innerHTML = "<p>Fuente de video no soportada.</p>";
    return;
  }
  
  // Mostrar información del trailer
  if (official) {
    trailerInfo = '<div class="trailer-info official"><i class="fas fa-check-circle"></i> Trailer Oficial</div>';
  } else if (fromTMDb) {
    trailerInfo = '<div class="trailer-info tmdb"><i class="fas fa-star"></i> De TMDb</div>';
  } else {
    trailerInfo = '<div class="trailer-info external"><i class="fas fa-external-link-alt"></i> Fuente Externa</div>';
  }
  
  // Agregar información de temporada si aplica
  if (season) {
    trailerInfo += `<div class="season-info"><i class="fas fa-tv"></i> Temporada ${season}</div>`;
  }
  
  elements.modalTrailer.innerHTML = `
    ${trailerInfo}
    <iframe src="${embedUrl}" frameborder="0" allowfullscreen></iframe>
  `;
}

// Función para mostrar trailer en contenedor específico
function displayTrailerInContainer(trailerData, container) {
  const { videoId, source, title, official, fromTMDb, season } = trailerData;
  
  let embedUrl;
  let trailerInfo = '';
  
  // Crear URL del embed según la fuente
  if (source === 'youtube') {
    embedUrl = `https://www.youtube.com/embed/${videoId}`;
  } else if (source === 'vimeo') {
    embedUrl = `https://player.vimeo.com/video/${videoId}`;
  } else if (source === 'dailymotion') {
    embedUrl = `https://www.dailymotion.com/embed/video/${videoId}`;
  } else {
    container.innerHTML = "<p>Fuente de video no soportada.</p>";
    return;
  }
  
  // Mostrar información del trailer
  if (official) {
    trailerInfo = '<div class="trailer-info official"><i class="fas fa-check-circle"></i> Trailer Oficial</div>';
  } else if (fromTMDb) {
    trailerInfo = '<div class="trailer-info tmdb"><i class="fas fa-star"></i> De TMDb</div>';
  } else {
    trailerInfo = '<div class="trailer-info external"><i class="fas fa-external-link-alt"></i> Fuente Externa</div>';
  }
  
  // Agregar información de temporada si aplica
  if (season) {
    trailerInfo += `<div class="season-info"><i class="fas fa-tv"></i> Temporada ${season}</div>`;
  }
  
  container.innerHTML = `
    ${trailerInfo}
    <iframe src="${embedUrl}" frameborder="0" allowfullscreen></iframe>
  `;
}

// Función para mostrar imágenes cuando no hay trailer disponible
async function displayImageFallback(dataOriginal, title, season = null) {
  await displayImageFallbackInContainer(dataOriginal, title, season, elements.modalTrailer);
}

// Función para mostrar imágenes en contenedor específico
async function displayImageFallbackInContainer(dataOriginal, title, season, container) {
  try {
    const images = [];
    
    // Recopilar imágenes disponibles de TMDb
    if (dataOriginal) {
      if (dataOriginal.backdrop_path) {
        images.push(`https://image.tmdb.org/t/p/w780${dataOriginal.backdrop_path}`);
      }
      if (dataOriginal.poster_path) {
        images.push(`https://image.tmdb.org/t/p/w500${dataOriginal.poster_path}`);
      }
    }
    
    if (images.length > 0) {
      let imageCarousel = '<div class="image-carousel">';
      
      // Mensaje personalizado para temporadas
      const message = season ? 
        `<i class="fas fa-info-circle"></i> No hay trailer disponible para la temporada ${season}. Aquí tienes algunas imágenes:` :
        '<i class="fas fa-info-circle"></i> No hay trailer disponible. Aquí tienes algunas imágenes:';
      
      imageCarousel += `<div class="no-trailer-message">${message}</div>`;
      
      if (images.length === 1) {
        imageCarousel += `<img src="${images[0]}" alt="${title}" class="fallback-image">`;
      } else {
        imageCarousel += '<div class="image-slider">';
        images.forEach((image, index) => {
          imageCarousel += `<img src="${image}" alt="${title}" class="fallback-image ${index === 0 ? 'active' : ''}" data-index="${index}">`;
        });
        imageCarousel += '</div>';
        
        if (images.length > 1) {
          imageCarousel += `
            <div class="slider-controls">
              <button class="slider-btn prev" onclick="changeImage(-1)"><i class="fas fa-chevron-left"></i></button>
              <div class="slider-dots">
                ${images.map((_, index) => `<span class="dot ${index === 0 ? 'active' : ''}" onclick="currentSlide(${index + 1})"></span>`).join('')}
              </div>
              <button class="slider-btn next" onclick="changeImage(1)"><i class="fas fa-chevron-right"></i></button>
            </div>
          `;
        }
      }
      
      imageCarousel += '</div>';
      container.innerHTML = imageCarousel;
    } else {
      const message = season ? 
        `<i class="fas fa-film"></i><p>No hay trailer ni imágenes disponibles para la temporada ${season}.</p>` :
        '<i class="fas fa-film"></i><p>No hay trailer ni imágenes disponibles.</p>';
      
      container.innerHTML = `<div class="no-content">${message}</div>`;
    }
  } catch (error) {
    console.error('Error displaying image fallback:', error);
    const message = season ? 
      `<i class="fas fa-exclamation-triangle"></i><p>No hay trailer disponible para la temporada ${season}.</p>` :
      '<i class="fas fa-exclamation-triangle"></i><p>No hay trailer disponible.</p>';
    
    container.innerHTML = `<div class="no-content">${message}</div>`;
  }
}

// Funciones para controlar el carrusel de imágenes
let currentImageIndex = 0;

function changeImage(direction) {
  const images = document.querySelectorAll('.fallback-image');
  const dots = document.querySelectorAll('.dot');
  
  if (images.length <= 1) return;
  
  images[currentImageIndex].classList.remove('active');
  dots[currentImageIndex].classList.remove('active');
  
  currentImageIndex += direction;
  
  if (currentImageIndex >= images.length) {
    currentImageIndex = 0;
  } else if (currentImageIndex < 0) {
    currentImageIndex = images.length - 1;
  }
  
  images[currentImageIndex].classList.add('active');
  dots[currentImageIndex].classList.add('active');
}

function currentSlide(index) {
  const images = document.querySelectorAll('.fallback-image');
  const dots = document.querySelectorAll('.dot');
  
  if (images.length <= 1) return;
  
  images[currentImageIndex].classList.remove('active');
  dots[currentImageIndex].classList.remove('active');
  
  currentImageIndex = index - 1;
  
  images[currentImageIndex].classList.add('active');
  dots[currentImageIndex].classList.add('active');
}


let currentImdbId = null; // Variable global para guardar el ID de IMDb

// Función para limpiar el contenido del modal
function clearModalContent() {
  // Limpiar contenido dinámico que se añade con insertAdjacentHTML
  const existingMovieDetails = document.querySelector('.movie-details');
  if (existingMovieDetails) {
    existingMovieDetails.remove();
  }
  
  const existingTorrentQuote = document.querySelector('.torrent-quote');
  if (existingTorrentQuote) {
    existingTorrentQuote.remove();
  }
  
  const existingNoTorrentsMessage = document.querySelector('.no-torrents-message');
  if (existingNoTorrentsMessage) {
    existingNoTorrentsMessage.remove();
  }
  
  // Limpiar selectores de temporada y episodio para series de TV
  const existingSeasonSelect = document.querySelector('.season-episode-selector');
  if (existingSeasonSelect) {
    existingSeasonSelect.remove();
  }
  
  // Limpiar cualquier mensaje adicional que pueda haberse añadido
  const existingMessages = document.querySelectorAll('.modal .additional-message');
  existingMessages.forEach(msg => msg.remove());
  
  // Limpiar contenido de los elementos principales
  elements.modalTitle.innerHTML = '';
  elements.modalDescription.innerHTML = '';
  elements.modalTrailer.innerHTML = '';
}

// Función para obtener detalles y mostrar el modal
async function showDetails(id, type, movieCard) {

  document.getElementById('loading-screen').style.display = 'flex';
  const lottiePlayer = document.querySelector('lottie-player');
  lottiePlayer.stop();  // Detener la animación
  lottiePlayer.play();  // Reproducir la animación desde el principio

  // Limpiar el contenido anterior del modal
  clearModalContent();

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

    // Función auxiliar para detectar caracteres no latinos
    const containsNonLatinChars = (str) => {
      if (!str) return false;
      // Detectar caracteres asiáticos (coreano, japonés, chino, etc.)
      return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf\uac00-\ud7a3]/.test(str);
    };

    // Lógica inteligente para seleccionar el título del modal - priorizar caracteres latinos
    if (dataOriginal.title && !containsNonLatinChars(dataOriginal.title)) {
      // Para películas, usar title si está en caracteres latinos
      originalTitle = dataOriginal.title;
    } else if (dataOriginal.name && !containsNonLatinChars(dataOriginal.name)) {
      // Para series, usar name si está en caracteres latinos
      originalTitle = dataOriginal.name;
    } else if (dataOriginal.original_title && !containsNonLatinChars(dataOriginal.original_title)) {
      // Si original_title está en caracteres latinos, usarlo
      originalTitle = dataOriginal.original_title;
    } else if (dataOriginal.original_name && !containsNonLatinChars(dataOriginal.original_name)) {
      // Si original_name está en caracteres latinos, usarlo
      originalTitle = dataOriginal.original_name;
    } else {
      // Como último recurso, usar cualquiera que esté disponible
      originalTitle = dataOriginal.title || dataOriginal.name || dataOriginal.original_title || dataOriginal.original_name || "No Title";
    }
    spanishTitle = dataSpanish.title || dataSpanish.name || originalTitle; // Si no hay traducción, usa el original
    originalDescription = dataOriginal.overview || "No description available in English.";
    spanishDescription = dataSpanish.overview || "No hay descripción disponible en español.";

    // Mostrar el título con la traducción entre paréntesis y el selector de idioma
    elements.modalTitle.innerHTML = `
  <div class="modal-header-content">
    <span id="modal-title-text">${originalTitle} <span id="translated-title">(${spanishTitle})</span></span>
    <div class="header-controls">
      <div class="language-selector">
        <div class="language-option active" data-lang="es" onclick="switchLanguage('es')">
          <span class="lang-code">ES</span>
          <span class="lang-name">Español</span>
        </div>
        <div class="language-option" data-lang="en" onclick="switchLanguage('en')">
          <span class="lang-code">EN</span>
          <span class="lang-name">English</span>
        </div>
        <div class="language-slider"></div>
      </div>
    </div>
  </div>
`;

    // Mostrar la descripción en español inicialmente
    elements.modalDescription.innerHTML = `<p id="description-text">${spanishDescription}</p>`;

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

    // Insertar los detalles (movie-details) después de modal-description pero antes de modal-trailer
    const movieDetailsHTML = `
      <div class="movie-details">
        <p><strong>Género:</strong> ${genres}</p>
        ${type === 'tv' ? `<p><strong>Temporadas:</strong> ${seasons}</p>` : ''}
        ${type === 'tv' ? `<p><strong>Estado:</strong> ${status}</p>` : ''}
        <p><strong>Plataformas:</strong> ${providerNames}</p>
        <p><strong>Valoración:</strong> ${stars}</p>
      </div>
    `;
    
    // Insertar movie-details después de modal-description
    elements.modalDescription.insertAdjacentHTML('afterend', movieDetailsHTML);

    // Buscar trailer usando la nueva API mejorada (modal-trailer va después de movie-details)
    // Guardar datos para uso global
    window.currentDataOriginal = dataOriginal;
    await loadEnhancedTrailer(id, type, originalTitle, dataOriginal);

    // Buscar torrents según el tipo de contenido (torrent-quote va al final)
    if (type === "movie") {
      // Usar el mismo originalTitle que ya se calculó con lógica inteligente
      await fetchTorrents(originalTitle);
    } else if (type === "tv") {
      // Para series de TV, obtener los detalles completos y buscar torrents
      const tvDetails = await fetchTVDetails(id);
      if (tvDetails) {
        // Función auxiliar para detectar caracteres no latinos
        const containsNonLatinChars = (str) => {
          if (!str) return false;
          // Detectar caracteres asiáticos (coreano, japonés, chino, etc.)
          return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf\uac00-\ud7a3]/.test(str);
        };
        
        // Lógica inteligente para seleccionar el nombre de la serie
        let tvTitle;
        if (dataOriginal.name && !containsNonLatinChars(dataOriginal.name)) {
          // Si name existe y está en caracteres latinos, usarlo
          tvTitle = dataOriginal.name;
        } else if (dataOriginal.original_name && !containsNonLatinChars(dataOriginal.original_name)) {
          // Si original_name existe y está en caracteres latinos, usarlo
          tvTitle = dataOriginal.original_name;
        } else {
          // Como último recurso, usar el que esté disponible
          tvTitle = dataOriginal.name || dataOriginal.original_name;
        }
        
        console.log(`🔍 TV Title for torrent search: "${tvTitle}" (name: "${dataOriginal.name}", original_name: "${dataOriginal.original_name}")`);
        
        await fetchTVTorrents(tvTitle, tvDetails);
      } else {
        elements.modalTrailer.insertAdjacentHTML(
          "afterend",
          '<div class="no-torrents-message">No se pudieron obtener los detalles de la serie para buscar torrents.</div>'
        );
      }
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

// Función para cambiar el idioma del modal
function switchLanguage(language) {
  const descriptionText = document.getElementById('description-text');
  const translatedTitle = document.getElementById('translated-title');
  const languageOptions = document.querySelectorAll('.language-option');
  const languageSlider = document.querySelector('.language-slider');
  
  // Remover clase active de todas las opciones
  languageOptions.forEach(option => option.classList.remove('active'));
  
  // Añadir clase active a la opción seleccionada
  const selectedOption = document.querySelector(`[data-lang="${language}"]`);
  selectedOption.classList.add('active');
  
  // Mover el slider
  if (language === 'es') {
    languageSlider.style.transform = 'translateX(0%)';
    descriptionText.textContent = spanishDescription;
    translatedTitle.textContent = `(${spanishTitle})`;
  } else {
    languageSlider.style.transform = 'translateX(100%)';
    descriptionText.textContent = originalDescription;
    translatedTitle.textContent = "";
  }
}

// Función para alternar entre la descripción en español y la descripción original (mantener compatibilidad)
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
      // Handle both old YTS format and new direct torrent format
      let allTorrents = [];
      
      // Check if data is direct torrent array (new format) or YTS movie format (old format)
      if (data[0] && data[0].title && data[0].magnet) {
        // New format: direct torrent array
        allTorrents = data.map(torrent => ({
          ...torrent,
          title: torrent.title || movieTitle
        }));
      } else {
        // Old YTS format: movies with torrents array
        data.forEach(movie => {
          if (movie.torrents && movie.torrents.length > 0) {
            movie.torrents.forEach(torrent => {
              allTorrents.push({
                ...torrent,
                title: movie.title // Agregar título de la película al torrent
              });
            });
          }
        });
      }

      if (allTorrents.length > 0) {
        // Check if any torrents are demo data
        const hasDemo = allTorrents.some(torrent => torrent.isDemo);
        
        allTorrents.sort((a, b) => {
          const qualityOrder = ["4K", "1080p", "720p", "DVDRip", "WEB-DL", "SD"];
          return qualityOrder.indexOf(a.quality) - qualityOrder.indexOf(b.quality);
        });
        
        let torrentButtons = `
          <div class="torrent-quote">
            <h3>Torrents disponibles</h3>`;
        
        // Add demo data warning if applicable
        if (hasDemo) {
          torrentButtons += `
            <div class="demo-warning" style="background: #ff6b35; color: white; padding: 8px 12px; border-radius: 4px; margin-bottom: 10px; font-size: 14px;">
              ⚠️ Datos de demostración - Los torrents reales no están disponibles debido a restricciones de red
            </div>`;
        }
        
        torrentButtons += `<div class="torrent-buttons">`;
        
        allTorrents.forEach((torrent, index) => {
          const magnetLink = torrent.magnet || torrent.url || `magnet:?xt=urn:btih:${torrent.hash}&dn=${encodeURIComponent(movieTitle)}&tr=udp://tracker.openbittorrent.com:80/announce`;
          const providerInfo = torrent.isDemo ? " 🎭 Demo" : "";
          
          // Escapar comillas simples y dobles para evitar errores de sintaxis
          const escapedMagnetLink = magnetLink.replace(/'/g, "\\'").replace(/"/g, '\\"');
          const escapedMovieTitle = movieTitle.replace(/'/g, "\\'").replace(/"/g, '\\"');
          
          torrentButtons += `
            <div class="torrent-item${torrent.isDemo ? ' demo-torrent' : ''}">
              <div class="torrent-header">
                <button class="torrent-button" data-quality="${torrent.quality}" data-magnet="${magnetLink}" data-title="${movieTitle}" onclick="toggleTorrentActions(this)">
                  <div class="torrent-info-left">
                    <span class="torrent-quality">${torrent.quality}${providerInfo}</span>
                    <span class="torrent-size">${torrent.size}</span>
                  </div>
                  <div class="torrent-info-right">
                    <span class="torrent-seeds">🌱 ${torrent.seeds || 0}</span>
                    <span class="torrent-expand">⌄</span>
                  </div>
                </button>
              </div>
              <div class="torrent-name" title="${torrent.title || movieTitle}">
                📁 ${torrent.title || movieTitle}
              </div>
              <div class="torrent-actions" style="display: none;">
                <button class="action-button watch-online" onclick="event.stopPropagation(); watchOnlineWithStats('${escapedMagnetLink}', '${escapedMovieTitle}')">
                  <span class="action-icon">▶</span>
                  <span class="action-text">Ver Online</span>
                </button>
                <a class="action-button download-torrent" href="${magnetLink}" download>
                  <span class="action-icon">🧲</span>
                  <span class="action-text">Descargar</span>
                </a>
              </div>
            </div>
          `;
        });
        torrentButtons += `</div></div>`;
        elements.modalTrailer.insertAdjacentHTML("afterend", torrentButtons);
      } else {
        elements.modalTrailer.insertAdjacentHTML(
          "afterend",
          '<div class="no-torrents-message">No se encontraron torrents válidos para esta película.</div>'
        );
      }
    } else {
      elements.modalTrailer.insertAdjacentHTML(
        "afterend",
        '<div class="no-torrents-message">No hay torrents disponibles para esta película.</div>'
      );
    }
  } catch (error) {
    // Mostrar mensaje de error amigable en el modal
    elements.modalTrailer.insertAdjacentHTML(
      "afterend",
      `<div class="no-torrents-message" style="background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%); border-color: #f44336; color: #ffebee;">
        <span style="font-size: 2em; display: block; margin-bottom: 10px;">⚠️</span>
        No se pudieron obtener torrents. Intenta más tarde.
      </div>`
    );
    console.error("Error fetching torrents:", error);
  }
}

// Función para obtener torrents de series de TV
async function fetchTVTorrents(tvTitle, tvDetails) {
  try {
    // Crear interfaz de selección de temporada y episodio
    const seasonSelect = createSeasonEpisodeSelector(tvDetails);
    
    elements.modalTrailer.insertAdjacentHTML("afterend", seasonSelect);
    
    // Agregar event listeners para los selectores
    const seasonSelector = document.getElementById('season-selector');
    const episodeSelector = document.getElementById('episode-selector');
    const searchTorrentsBtn = document.getElementById('search-torrents-btn');
    const torrentResultsContainer = document.getElementById('torrent-results');
    
    // Actualizar episodios cuando cambie la temporada
    seasonSelector.addEventListener('change', function() {
      updateEpisodeSelector(tvDetails, this.value);
    });
    
    // Buscar torrents cuando se haga clic en el botón
    searchTorrentsBtn.addEventListener('click', async function() {
      const selectedSeason = seasonSelector.value;
      const selectedEpisode = episodeSelector.value;
      
      if (!selectedSeason) {
        alert('Por favor selecciona una temporada');
        return;
      }
      
      // Mostrar indicador de carga
      torrentResultsContainer.innerHTML = '<div class="loading-torrents">🔍 Buscando torrents...</div>';
      
      await searchTVTorrents(tvTitle, selectedSeason, selectedEpisode, torrentResultsContainer);
    });
    
    // Cargar episodios de la primera temporada por defecto
    if (seasonSelector.value) {
      updateEpisodeSelector(tvDetails, seasonSelector.value);
    }
    
  } catch (error) {
    console.error("Error setting up TV torrents:", error);
    elements.modalDescription.insertAdjacentHTML(
      "beforeend",
      `<div class="no-torrents-message" style="background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%); border-color: #f44336; color: #ffebee;">
        <span style="font-size: 2em; display: block; margin-bottom: 10px;">⚠️</span>
        Error al configurar la búsqueda de torrents para series.
      </div>`
    );
  }
}

// Función para crear el selector de temporada y episodio
function createSeasonEpisodeSelector(tvDetails) {
  const seasons = tvDetails.seasons || [];
  let seasonOptions = '<option value="">Selecciona una temporada</option>';
  
  seasons.forEach(season => {
    if (season.season_number > 0) { // Omitir temporada 0 (especiales)
      seasonOptions += `<option value="${season.season_number}">Temporada ${season.season_number} (${season.episode_count} episodios)</option>`;
    }
  });
  
  return `
    <div class="tv-torrent-selector">
      <h3>📺 Buscar Torrents para Episodios</h3>
      <div class="selector-container">
        <div class="selector-group">
          <label for="season-selector">Temporada:</label>
          <select id="season-selector" class="season-episode-select">
            ${seasonOptions}
          </select>
        </div>
        <div class="selector-group">
          <label for="episode-selector">Episodio:</label>
          <select id="episode-selector" class="season-episode-select">
            <option value="">Selecciona un episodio</option>
          </select>
        </div>
        <button id="search-torrents-btn" class="search-torrents-btn">🔍 Buscar Torrents</button>
      </div>
      <div id="torrent-results" class="torrent-results"></div>
    </div>
  `;
}

// Función para actualizar el selector de episodios
function updateEpisodeSelector(tvDetails, seasonNumber) {
  const episodeSelector = document.getElementById('episode-selector');
  const selectedSeason = tvDetails.seasons.find(s => s.season_number == seasonNumber);
  
  if (!selectedSeason) {
    episodeSelector.innerHTML = '<option value="">Temporada no encontrada</option>';
    return;
  }
  
  let episodeOptions = '<option value="">Temporada completa</option>';
  
  // Generar opciones para cada episodio
  for (let i = 1; i <= selectedSeason.episode_count; i++) {
    episodeOptions += `<option value="${i}">Episodio ${i}</option>`;
  }
  
  episodeSelector.innerHTML = episodeOptions;
}

// Función para buscar torrents de TV
async function searchTVTorrents(tvTitle, season, episode, resultsContainer) {
  try {
    const response = await fetch(`/api/tv-torrents?tvTitle=${encodeURIComponent(tvTitle)}&season=${season}&episode=${episode || ''}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        resultsContainer.innerHTML = '<div class="no-torrents-message">No se encontraron torrents para este episodio.</div>';
        return;
      } else {
        throw new Error('Error fetching TV torrents');
      }
    }
    
    const torrents = await response.json();
    
    if (torrents.length > 0) {
      displayTVTorrents(torrents, resultsContainer, tvTitle);
    } else {
      resultsContainer.innerHTML = '<div class="no-torrents-message">No se encontraron torrents para este episodio.</div>';
    }
    
  } catch (error) {
    console.error("Error searching TV torrents:", error);
    resultsContainer.innerHTML = `
      <div class="no-torrents-message" style="background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%); border-color: #f44336; color: #ffebee;">
        <span style="font-size: 2em; display: block; margin-bottom: 10px;">⚠️</span>
        Error al buscar torrents. Intenta más tarde.
      </div>
    `;
  }
}

// Función para mostrar los torrents de TV
function displayTVTorrents(torrents, container, tvTitle) {
  // Check if any torrents are demo data
  const hasDemo = torrents.some(torrent => torrent.isDemo);
  
  let torrentButtons = `
    <div class="torrent-quote">
      <h4>Torrents encontrados</h4>`;
  
  // Add demo data warning if applicable
  if (hasDemo) {
    torrentButtons += `
      <div class="demo-warning" style="background: #ff6b35; color: white; padding: 8px 12px; border-radius: 4px; margin-bottom: 10px; font-size: 14px;">
        ⚠️ Datos de demostración - Los torrents reales no están disponibles debido a restricciones de red
      </div>`;
  }
  
  torrentButtons += `<div class="torrent-buttons">`;
  
  torrents.forEach((torrent) => {
    const magnetLink = torrent.magnet;
    const torrentTitle = torrent.title;
    const providerInfo = torrent.isDemo ? " 🎭 Demo" : "";
    
    // Escapar comillas simples y dobles para evitar errores de sintaxis
    const escapedMagnetLink = magnetLink.replace(/'/g, "\\'").replace(/"/g, '\\"');
    const escapedTorrentTitle = torrentTitle.replace(/'/g, "\\'").replace(/"/g, '\\"');
    
    torrentButtons += `
      <div class="torrent-item${torrent.isDemo ? ' demo-torrent' : ''}">
        <div class="torrent-header">
          <button class="torrent-button" data-quality="${torrent.quality}" data-magnet="${magnetLink}" data-title="${torrentTitle}" onclick="toggleTorrentActions(this)">
            <div class="torrent-info-left">
              <span class="torrent-quality">${torrent.quality}${providerInfo}</span>
              <span class="torrent-size">${torrent.size}</span>
            </div>
            <div class="torrent-info-right">
              <span class="torrent-seeds">🌱 ${torrent.seeds}</span>
              <span class="torrent-expand">⌄</span>
            </div>
          </button>
        </div>
        <div class="torrent-name" title="${torrentTitle}">
          📁 ${torrentTitle}
        </div>
        <div class="torrent-actions" style="display: none;">
          <button class="action-button watch-online" onclick="event.stopPropagation(); watchOnlineWithStats('${escapedMagnetLink}', '${escapedTorrentTitle}')">
            <span class="action-icon">▶</span>
            <span class="action-text">Ver Online</span>
          </button>
          <a class="action-button download-torrent" href="${magnetLink}" download>
            <span class="action-icon">🧲</span>
            <span class="action-text">Descargar</span>
          </a>
        </div>
      </div>
    `;
  });
  
  torrentButtons += `</div></div>`;
  container.innerHTML = torrentButtons;
}

// Función para verificar compatibilidad de códecs
function checkCodecSupport() {
  const video = document.createElement('video');
  const codecSupport = {
    h264: video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '',
    h265: video.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"') !== '',
    vp9: video.canPlayType('video/webm; codecs="vp9"') !== '',
    av1: video.canPlayType('video/mp4; codecs="av01.0.05M.08"') !== '',
    // Audio codecs
    aac: video.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== '',
    mp3: video.canPlayType('audio/mpeg') !== '',
    opus: video.canPlayType('audio/webm; codecs="opus"') !== '',
    vorbis: video.canPlayType('audio/webm; codecs="vorbis"') !== '',
    flac: video.canPlayType('audio/flac') !== '',
    dts: video.canPlayType('audio/mp4; codecs="dts"') === '', // Normalmente no soportado
    ac3: video.canPlayType('audio/mp4; codecs="ac-3"') === '', // Normalmente no soportado
  };
  
  console.log('Codec support:', codecSupport);
  return codecSupport;
}

// Función para mostrar información sobre problemas de audio comunes
function showAudioTroubleshooting() {
  const troubleshootingMessage = `
    <div style="background: rgba(255, 193, 7, 0.1); border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 10px 0;">
      <h4 style="color: #ffc107; margin: 0 0 10px 0;">🔧 Solución de problemas de audio</h4>
      <p style="margin: 5px 0; font-size: 0.9em; color: #fff;">
        <strong>Si no escuchas audio:</strong><br>
        1. Verifica que el volumen no esté en 0 o muteado<br>
        2. Algunos archivos MKV usan códecs de audio no compatibles (DTS, AC3)<br>
        3. Prueba con otro torrent que tenga formato MP4<br>
        4. Asegúrate de que tu navegador esté actualizado
      </p>
    </div>
  `;
  
  // Buscar un contenedor donde mostrar el mensaje
  const playerContainer = document.getElementById('video-player-container');
  if (playerContainer) {
    // Verificar si ya existe el mensaje para no duplicarlo
    const existingTroubleshooting = playerContainer.querySelector('.audio-troubleshooting');
    if (!existingTroubleshooting) {
      const troubleshootingDiv = document.createElement('div');
      troubleshootingDiv.className = 'audio-troubleshooting';
      troubleshootingDiv.innerHTML = troubleshootingMessage;
      playerContainer.appendChild(troubleshootingDiv);
    }
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

        // Configuraciones mejoradas para el reproductor de video
        videoPlayer.muted = false; // Asegurar que no esté muteado
        videoPlayer.volume = 1.0; // Volumen al máximo
        videoPlayer.autoplay = false; // No reproducir automáticamente
        videoPlayer.preload = 'metadata'; // Precargar metadatos

        // Función para verificar y habilitar audio
        function ensureAudioEnabled() {
            if (videoPlayer.muted) {
                videoPlayer.muted = false;
                console.log('Audio was muted, unmuting...');
            }
            if (videoPlayer.volume === 0) {
                videoPlayer.volume = 1.0;
                console.log('Volume was 0, setting to maximum...');
            }
        }

        // Función para detectar problemas de audio
        function detectAudioIssues() {
            // Verificar compatibilidad de códecs
            const codecSupport = checkCodecSupport();
            
            // Verificar si hay pistas de audio disponibles
            setTimeout(() => {
                if (videoPlayer.audioTracks && videoPlayer.audioTracks.length === 0) {
                    console.warn('No audio tracks detected in video file');
                    showNotification('⚠️ No se detectaron pistas de audio en este archivo', 'warning', 5000);
                    showAudioTroubleshooting();
                }
                
                // Verificar códecs de audio para archivos MKV
                if (selectedFile.name.toLowerCase().endsWith('.mkv')) {
                    console.log('MKV file detected, checking audio compatibility...');
                    showNotification('📁 Archivo MKV detectado. Si no hay audio, podría ser un problema de códec.', 'info', 6000);
                    
                    // Mostrar información de solución de problemas para archivos MKV
                    setTimeout(() => {
                        if (videoPlayer.muted || videoPlayer.volume === 0) {
                            showAudioTroubleshooting();
                        }
                    }, 3000);
                    
                    // Intentar detectar si el audio funciona
                    try {
                        // Solo crear el contexto de audio si es necesario
                        if (window.AudioContext || window.webkitAudioContext) {
                            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                            const source = audioContext.createMediaElementSource(videoPlayer);
                            source.connect(audioContext.destination);
                            console.log('Audio context connected successfully for MKV file');
                        }
                    } catch (audioError) {
                        console.warn('Audio context error:', audioError);
                        showNotification('⚠️ Posible problema de compatibilidad de audio con este archivo MKV', 'warning', 7000);
                        showAudioTroubleshooting();
                    }
                }
                
                // Verificar después de un tiempo si el audio realmente funciona
                setTimeout(() => {
                    if (videoPlayer.currentTime > 0 && !videoPlayer.paused && videoPlayer.volume > 0 && !videoPlayer.muted) {
                        // El video está reproduciendo, verificar si realmente hay audio
                        console.log('Video playing, checking for actual audio output...');
                    }
                }, 5000);
            }, 1000);
        }

        videoPlayer.oncanplay = () => {
            if (playerLoadingIndicator) playerLoadingIndicator.style.display = 'none';
            if (playerStatusMessage) playerStatusMessage.style.display = 'none';
            if (localSubtitleUploadContainer) { // Show subtitle upload oncanplay
                localSubtitleUploadContainer.style.display = 'block';
            }
            
            // Asegurar que el audio esté habilitado cuando el video esté listo
            ensureAudioEnabled();
            detectAudioIssues();
        };

        videoPlayer.onplaying = () => {
            clearTimeout(stallTimeoutId);
            if (playerLoadingIndicator) playerLoadingIndicator.style.display = 'none';
            if (playerStatusMessage) playerStatusMessage.style.display = 'none';
            
            // Verificar audio nuevamente cuando comience la reproducción
            ensureAudioEnabled();
        };

        // Event listener para errores de audio específicos
        videoPlayer.onerror = (event) => {
            const error = videoPlayer.error;
            if (error) {
                console.error('Video player error:', error);
                let errorMessage = 'Error de reproducción';
                
                switch (error.code) {
                    case MediaError.MEDIA_ERR_ABORTED:
                        errorMessage = 'Reproducción cancelada';
                        break;
                    case MediaError.MEDIA_ERR_NETWORK:
                        errorMessage = 'Error de red durante la descarga';
                        break;
                    case MediaError.MEDIA_ERR_DECODE:
                        errorMessage = 'Error al decodificar el archivo (posible problema de códec)';
                        if (selectedFile.name.toLowerCase().endsWith('.mkv')) {
                            errorMessage += '. Los archivos MKV pueden tener códecs no compatibles.';
                        }
                        break;
                    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                        errorMessage = 'Formato de archivo no soportado';
                        break;
                }
                
                showNotification(errorMessage, 'error', 8000);
            }
        };

        // Listener para cambios en el volumen/mute
        videoPlayer.onvolumchange = () => {
            if (videoPlayer.muted) {
                console.log('Video was muted by user or system');
                // Opcional: mostrar notificación si se mutea automáticamente
                setTimeout(() => {
                    if (videoPlayer.muted) {
                        showNotification('🔇 El audio está desactivado. Haz clic en el botón de volumen para activarlo.', 'info', 5000);
                    }
                }, 500);
            }
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
let searchTimeout;
document.getElementById("search-bar").addEventListener("input", (e) => {
  // Cancelar el timeout anterior si existe
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  const searchQuery = e.target.value.trim();
  
  // Si la búsqueda está vacía, restaurar estado inicial inmediatamente
  if (searchQuery === '') {
    hideSearchResultsInfo();
    currentPage = 1;
    getTitles(currentPage);
    return;
  }
  
  // Debounce para búsquedas con contenido (300ms de delay)
  searchTimeout = setTimeout(() => {
    currentPage = 1;
    getTitles(currentPage);
  }, 300);
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

// Authentication Functions
function updateAuthUI(isLoggedIn) {
  const authButtons = document.getElementById('auth-buttons');
  const userInfo = document.getElementById('user-info');
  const userEmail = document.getElementById('user-email');
  
  if (isLoggedIn) {
    const user = getCurrentUser();
    authButtons.classList.add('hidden');
    userInfo.classList.remove('hidden');
    if (user && user.email) {
      userEmail.textContent = user.email;
    }
    
    // Show favorites filter
    const favoritesFilterGroup = document.getElementById('favorite-filter-group');
    if (favoritesFilterGroup) {
      favoritesFilterGroup.style.display = 'flex';
    }
    
    // Load user data
    loadUserData();
  } else {
    authButtons.classList.remove('hidden');
    userInfo.classList.add('hidden');
    
    // Hide favorites filter
    const favoritesFilterGroup = document.getElementById('favorite-filter-group');
    if (favoritesFilterGroup) {
      favoritesFilterGroup.style.display = 'none';
    }
  }
}

function showLoginModal() {
  showLoginForm();
  document.getElementById('auth-modal').classList.remove('hidden');
}

function showRegisterModal() {
  showRegisterForm();
  document.getElementById('auth-modal').classList.remove('hidden');
}

function hideAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
}

function showLoginForm() {
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('register-form').classList.add('hidden');
}

function showRegisterForm() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.remove('hidden');
}

async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  if (!email || !password) {
    showNotification('Por favor completa todos los campos', 'error');
    return;
  }
  
  try {
    const result = await signIn(email, password);
    
    if (result.success) {
      showNotification('Sesión iniciada correctamente', 'success');
      hideAuthModal();
      updateAuthUI(true);
    } else {
      showNotification(result.error || 'Error al iniciar sesión', 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showNotification('Error al iniciar sesión', 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-confirm-password').value;
  
  if (!email || !password || !confirmPassword) {
    showNotification('Por favor completa todos los campos', 'error');
    return;
  }
  
  if (password !== confirmPassword) {
    showNotification('Las contraseñas no coinciden', 'error');
    return;
  }
  
  if (password.length < 6) {
    showNotification('La contraseña debe tener al menos 6 caracteres', 'error');
    return;
  }
  
  try {
    const result = await signUp(email, password);
    
    if (result.success) {
      showNotification('Cuenta creada correctamente. Revisa tu email para confirmar tu cuenta.', 'success');
      hideAuthModal();
    } else {
      showNotification(result.error || 'Error al crear la cuenta', 'error');
    }
  } catch (error) {
    console.error('Register error:', error);
    showNotification('Error al crear la cuenta', 'error');
  }
}

async function handleLogout() {
  try {
    const result = await signOut();
    
    if (result.success) {
      showNotification('Sesión cerrada correctamente', 'success');
      updateAuthUI(false);
      
      // Clear favorites filter if active
      const favoritesCheckbox = document.getElementById('favorites-checkbox');
      if (favoritesCheckbox && favoritesCheckbox.checked) {
        favoritesCheckbox.checked = false;
        showingFavorites = false;
        updateFavoritesChip();
        getTitles();
      }
    } else {
      showNotification('Error al cerrar sesión', 'error');
    }
  } catch (error) {
    console.error('Logout error:', error);
    showNotification('Error al cerrar sesión', 'error');
  }
}

async function loadUserData() {
  // This function will be called when user logs in to load their data
  console.log('Loading user data...');
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
async function toggleFavorite(movieId, type, event) {
  // Evitar que el clic en el corazón se propague y abra el modal
  event.stopPropagation();

  if (!isAuthenticated()) {
      showNotification("Primero debes iniciar sesión", 'warning');
      return;
  }

  try {
    const isFav = await checkIsFavorite(movieId, type);
    
    if (isFav) {
      // Remove favorite
      await removeFavorite(movieId, type);
      document.getElementById(`heart-icon-${movieId}`).style.color = 'black';
      showNotification('Eliminado de favoritos', 'info');
    } else {
      // Add favorite
      await addFavorite(movieId, type);
      document.getElementById(`heart-icon-${movieId}`).style.color = 'red';
      showNotification('Agregado a favoritos', 'success');
    }
  } catch (error) {
    console.error('Error toggling favorite:', error);
    showNotification('Error al gestionar favoritos', 'error');
  }
}



// Función para cargar los favoritos desde Supabase
async function loadFavorites() {
  if (!isAuthenticated()) {
    return;
  }
  
  try {
    const favorites = await getFavorites();
    
    // Iterar sobre todas las películas y actualizar el color del corazón
    favorites.forEach(favorite => {
      const heartIcon = document.getElementById(`heart-icon-${favorite.movie_id}`);
      if (heartIcon) {
        heartIcon.style.color = 'red'; // Cambiar a rojo si está en favoritos
      }
    });
  } catch (error) {
    console.error('Error loading favorites:', error);
  }
}

// Función para activar/desactivar el filtro de favoritos
function toggleFavoritesFilter() {
  showingFavorites = !showingFavorites;
  updateFavoritesChip(); // Actualizar estado visual del chip
  getTitles();
}

// Inicializar la carga de títulos y géneros
// getTitles(); // Comentado para evitar duplicados - se llama en DOMContentLoaded
fetchGenres();
fetchProviders("movie"); // Cargar proveedores iniciales de películas (por defecto)

// Remove the old MetaMask window.onload function as it's now handled in DOMContentLoaded
// The auth initialization is now handled in the DOMContentLoaded event listener above

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

      // Si solo hay un archivo de video, saltar la selección y reproducir directamente
      if (torrentInfo.videoFiles.length === 1) {
        // Limpiar solicitud pendiente
        pendingTorrentRequests.delete(torrentHash);
        closeFileSelectionModal();
        playVideoFileWithStats(torrentInfo.videoFiles[0].index);
        return;
      }

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

  // Subir subtítulos - nuevo flujo con botón de selección separado
  document.getElementById('select-file-btn').onclick = function() {
    const fileInput = document.getElementById('subtitle-file');
    fileInput.click();
  };

  document.getElementById('subtitle-file').onchange = function(event) {
    const file = event.target.files[0];
    if (file) {
      // Actualizar el botón de selección para mostrar el archivo seleccionado
      const selectBtn = document.getElementById('select-file-btn');
      selectBtn.innerHTML = `<span class="btn-icon">📄</span>${file.name}`;
      
      // Habilitar el botón de subir
      const uploadBtn = document.getElementById('upload-subtitle-btn');
      uploadBtn.disabled = false;
      
      // Actualizar el evento del botón de subir
      uploadBtn.onclick = function() {
        uploadSubtitle(file);
      };
    }
  };

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
    
    // Check if we have season/episode selectors (for TV series)
    const seasonSelector = document.getElementById('season-selector');
    const episodeSelector = document.getElementById('episode-selector');
    let season = null;
    let episode = null;
    
    if (seasonSelector && seasonSelector.value) {
      season = seasonSelector.value;
      if (episodeSelector && episodeSelector.value) {
        episode = episodeSelector.value;
      }
    }
    
    // Construir la URL con los parámetros necesarios
    let searchUrl = `/api/subtitles/search?movieTitle=${encodeURIComponent(movieTitle)}&language=${language}`;
    if (imdbId) {
      searchUrl += `&imdbId=${encodeURIComponent(imdbId)}`;
    }
    if (season !== null) {
      searchUrl += `&season=${encodeURIComponent(season)}`;
      if (episode !== null) {
        searchUrl += `&episode=${encodeURIComponent(episode)}`;
      }
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
        
        option.textContent = `${subtitle.languageName} - ${subtitle.filename} (${subtitle.rating || 'N/A'})`;
        select.appendChild(option);
      });
      
      if (subtitles.length > 0) {
        showNotification(`Se encontraron ${subtitles.length} subtítulos para "${movieTitle}".`, 'success');
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
      // This is our backend OpenSubtitles endpoint, use it directly (no proxy needed)
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
      showNotification('Subtítulos activados automáticamente', 'success');
    });
    
    track.addEventListener('error', (e) => {
      console.error('Error cargando subtítulo:', {
        error: e,
        src: src,
        track: track,
        readyState: track.readyState,
        error: track.error
      });
      
      // Intentar obtener información más detallada del error
      let errorMessage = 'Error al cargar el archivo de subtítulo';
      
      if (track.error) {
        switch (track.error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Descarga de subtítulo cancelada';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Error de red al descargar subtítulo';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Error al decodificar el archivo de subtítulo';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Formato de subtítulo no soportado';
            break;
          default:
            errorMessage = `Error desconocido (código: ${track.error.code})`;
        }
      } else if (src.includes('undefined')) {
        errorMessage = 'URL de subtítulo inválida (contiene "undefined")';
      } else if (!src.startsWith('http') && !src.startsWith('/')) {
        errorMessage = 'URL de subtítulo no válida';
      }
      
      showNotification(errorMessage, 'error');
      
      // Intentar verificar si el archivo es accesible
      console.log('Verificando accesibilidad del subtítulo...');
      fetch(src, {method: 'HEAD'})
        .then(response => {
          console.log('Respuesta del servidor para subtítulo:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
          });
          
          // Si es un subtítulo de OpenSubtitles, hacer debug adicional
          if (src.includes('/api/subtitles/opensubtitles-download/')) {
            const debugUrl = src.replace('/api/subtitles/opensubtitles-download/', '/api/subtitles/debug/');
            console.log('Haciendo debug del subtítulo:', debugUrl);
            
            fetch(debugUrl)
              .then(debugResponse => debugResponse.json())
              .then(debugData => {
                console.log('Debug info del subtítulo:', debugData);
                if (!debugData.hasContent) {
                  showNotification('El archivo de subtítulo está vacío', 'warning');
                } else if (!debugData.looksLikeSRT) {
                  showNotification('El formato del subtítulo no es válido', 'warning');
                }
              })
              .catch(debugErr => {
                console.error('Error en debug del subtítulo:', debugErr);
              });
          }
        })
        .catch(err => {
          console.error('Error verificando subtítulo:', err);
        });
    });

    videoPlayer.appendChild(track);
    
    // Habilitar automáticamente los subtítulos cuando se cargan
    setTimeout(() => {
      if (videoPlayer.textTracks.length > 0) {
        // Activar automáticamente la primera pista de subtítulos
        videoPlayer.textTracks[0].mode = 'showing';
        console.log('Subtítulos habilitados automáticamente');
        showNotification('Subtítulos activados automáticamente', 'success', 2000);
      }
    }, 100);
    
  } catch (error) {
    console.error('Error agregando track de subtítulo:', error);
    showNotification('Error al agregar el subtítulo al video', 'error');
  }
}

// Función para habilitar subtítulos automáticamente
function enableSubtitles() {
  const videoPlayer = document.getElementById('video-player');
  const tracks = videoPlayer.textTracks;
  
  let tracksEnabled = 0;
  for (let i = 0; i < tracks.length; i++) {
    tracks[i].mode = 'showing';
    tracksEnabled++;
  }
  
  if (tracksEnabled > 0) {
    showNotification(`${tracksEnabled} pista(s) de subtítulos habilitadas automáticamente`, 'success');
  }
  
  return tracksEnabled > 0;
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
  }
  
  return tracksDisabled > 0;
}

// Función para cerrar el modal del reproductor de video
async function closeVideoModal() {
  document.getElementById('video-modal').style.display = 'none';
  
  // Detener y limpiar el video player
  const videoPlayer = document.getElementById('video-player');
  if (videoPlayer) {
    videoPlayer.pause();
    videoPlayer.src = '';
    videoPlayer.load();
    
    // Limpiar pistas de subtítulos
    const tracks = videoPlayer.getElementsByTagName('track');
    while (tracks.length > 0) {
      videoPlayer.removeChild(tracks[0]);
    }
  }
  
  if (currentVideoPlayer) {
    currentVideoPlayer.pause();
    currentVideoPlayer.src = '';
    currentVideoPlayer.load();
    currentVideoPlayer = null;
  }
  
  // Limpiar URLs de blob de subtítulos locales
  if (window.localSubtitleBlobUrls) {
    window.localSubtitleBlobUrls.forEach(url => {
      URL.revokeObjectURL(url);
    });
    window.localSubtitleBlobUrls = [];
  }
  
  // Limpiar el cliente torrent WebTorrent si existe
  if (window.currentTorrentClient) {
    window.currentTorrentClient.destroy();
    window.currentTorrentClient = null;
  }
  
  // Limpiar mensaje de solución de problemas de audio
  const troubleshootingDiv = document.querySelector('.audio-troubleshooting');
  if (troubleshootingDiv) {
    troubleshootingDiv.remove();
  }
  
  // Limpiar timeout de stall si existe
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
      window.currentTorrentClient.destroy();
      window.currentTorrentClient = null;
    } catch (error) {
      console.error('Error cleaning up WebTorrent client on unload:', error);
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
  // Actualizar seeds y leechers (elementos originales)
  const seedsElement = document.getElementById('torrent-seeds');
  const leechersElement = document.getElementById('torrent-leechers');
  const peersElement = document.getElementById('torrent-peers');
  
  if (seedsElement) seedsElement.textContent = `Seeds: ${torrentInfo.seeds || 0}`;
  if (leechersElement) leechersElement.textContent = `Leechers: ${torrentInfo.leechers || 0}`;
  if (peersElement) peersElement.textContent = `Peers: ${torrentInfo.numPeers || 0}`;

  // Actualizar progreso (elementos originales)
  const progressElement = document.getElementById('torrent-progress');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const progressPercentage = document.getElementById('progress-percentage');
  
  const progress = (torrentInfo.progress * 100).toFixed(1);
  if (progressElement) progressElement.textContent = `Progress: ${progress}%`;
  if (progressBarFill) progressBarFill.style.width = `${progress}%`;
  if (progressPercentage) progressPercentage.textContent = `${progress}%`;

  // Actualizar velocidades (elementos originales)
  const downloadSpeedElement = document.getElementById('torrent-download-speed');
  const uploadSpeedElement = document.getElementById('torrent-upload-speed');
  
  if (downloadSpeedElement) downloadSpeedElement.textContent = `↓ ${formatSpeed(torrentInfo.downloadSpeed)}`;
  if (uploadSpeedElement) uploadSpeedElement.textContent = `↑ ${formatSpeed(torrentInfo.uploadSpeed)}`;

  // Actualizar datos descargados/subidos (elementos originales)
  const downloadedElement = document.getElementById('torrent-downloaded');
  const uploadedElement = document.getElementById('torrent-uploaded');
  const timeRemainingElement = document.getElementById('torrent-time-remaining');
  
  if (downloadedElement) downloadedElement.textContent = `Downloaded: ${formatBytes(torrentInfo.downloaded || 0)}`;
  if (uploadedElement) uploadedElement.textContent = `Uploaded: ${formatBytes(torrentInfo.uploaded || 0)}`;
  if (timeRemainingElement) {
    const eta = torrentInfo.timeRemaining ? formatTime(torrentInfo.timeRemaining) : '--:--';
    timeRemainingElement.textContent = `ETA: ${eta}`;
  }

  // Actualizar elementos compactos del nuevo overlay
  const seedsCompact = document.getElementById('torrent-seeds-compact');
  const leechersCompact = document.getElementById('torrent-leechers-compact');
  const progressCompact = document.getElementById('torrent-progress-compact');
  const downloadSpeedCompact = document.getElementById('torrent-download-speed-compact');
  const progressBarFillCompact = document.getElementById('progress-bar-fill-compact');
  
  if (seedsCompact) seedsCompact.textContent = torrentInfo.seeds || 0;
  if (leechersCompact) leechersCompact.textContent = torrentInfo.leechers || 0;
  if (progressCompact) progressCompact.textContent = `${progress}%`;
  if (downloadSpeedCompact) downloadSpeedCompact.textContent = formatSpeed(torrentInfo.downloadSpeed);
  if (progressBarFillCompact) progressBarFillCompact.style.width = `${progress}%`;
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

// Función para alternar las acciones del torrent
window.toggleTorrentActions = function(button) {
  const torrentItem = button.closest('.torrent-item');
  const actionsDiv = torrentItem.querySelector('.torrent-actions');
  const allActions = document.querySelectorAll('.torrent-actions');
  const allButtons = document.querySelectorAll('.torrent-button');
  
  // Cerrar todas las otras acciones abiertas
  allActions.forEach(actions => {
    if (actions !== actionsDiv && actions.classList.contains('active')) {
      actions.classList.remove('active');
      actions.style.maxHeight = '0px';
      setTimeout(() => {
        actions.style.display = 'none';
      }, 300);
    }
  });
  
  // Remover estado activo de otros botones
  allButtons.forEach(btn => {
    if (btn !== button) {
      btn.classList.remove('active');
    }
  });
  
  // Toggle del botón y acciones actuales
  if (actionsDiv.classList.contains('active')) {
    // Cerrar
    button.classList.remove('active');
    actionsDiv.classList.remove('active');
    actionsDiv.style.maxHeight = '0px';
    setTimeout(() => {
      actionsDiv.style.display = 'none';
    }, 300);
  } else {
    // Abrir
    button.classList.add('active');
    actionsDiv.style.display = 'flex';
    actionsDiv.classList.add('active');
    // Pequeño delay para la animación
    setTimeout(() => {
      actionsDiv.style.maxHeight = '80px';
    }, 10);
  }
};

// Cerrar acciones de torrent al hacer clic fuera
document.addEventListener('click', function(event) {
  // Si el clic no es en un torrent item
  if (!event.target.closest('.torrent-item')) {
    const allActions = document.querySelectorAll('.torrent-actions.active');
    const allButtons = document.querySelectorAll('.torrent-button.active');
    
    allActions.forEach(actions => {
      actions.classList.remove('active');
      actions.style.maxHeight = '0px';
      setTimeout(() => {
        actions.style.display = 'none';
      }, 300);
    });
    
    allButtons.forEach(button => {
      button.classList.remove('active');
    });
  }
});
