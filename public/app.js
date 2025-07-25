
let auth, favorites;


async function initSupabase() {
  try {
    const supabaseModule = await window.loadSupabaseConfig();
    auth = supabaseModule.auth;
    favorites = supabaseModule.favorites;

  } catch (error) {


  }
}

let currentPage = 1;
let totalResults = 0;
let isLoading = false;
let originalDescription = '';
let spanishDescription = '';
let originalTitle = '';
let spanishTitle = '';
let currentUser = null;
let showingFavorites = false; 
let showingContinueWatching = false;
let stallTimeoutId = null;
let statsInterval = null;
window.localSubtitleBlobUrls = [];
// Watch progress tracking variables
let watchProgressInterval = null;
let currentWatchData = null;
let currentContentData = null; // Store current movie/show data for streaming
let lastSavedTime = 0;
const SAVE_INTERVAL = 10; // Save progress every 10 seconds

// Function to get authentication token
async function getAuthToken() {
  try {
    if (!auth) {
      console.log('Auth no disponible');
      return null;
    }
    const token = await auth.getAccessToken();
    return token;
  } catch (error) {
    console.error('Error obteniendo token de acceso:', error);
    return null;
  }
}

// Function to save watch progress
async function saveWatchProgress(currentTime, totalDuration = null) {
  if (!currentWatchData) {
    console.log('⚠️ No se puede guardar progreso: información de contenido no disponible');
    return;
  }
  
  if (!currentUser) {
    console.log('⚠️ No se puede guardar progreso: usuario no autenticado');
    return;
  }

  // Validate TV show has season and episode info
  if (currentWatchData.content_type === 'tv') {
    if (currentWatchData.season_number === null || currentWatchData.episode_number === null) {
      console.log('⚠️ No se puede guardar progreso de serie: información de temporada/episodio faltante');
      return;
    }
  }

  try {
    const token = await getAuthToken();
    if (!token) {
      console.warn('No auth token available for saving progress');
      return;
    }

    const progressData = {
      content_type: currentWatchData.content_type,
      tmdb_id: currentWatchData.tmdb_id,
      title: currentWatchData.title,
      season_number: currentWatchData.season_number,
      episode_number: currentWatchData.episode_number,
      playback_position: currentTime,
      total_duration: totalDuration,
      torrent_magnet_uri: currentWatchData.torrent_magnet_uri,
      torrent_hash: currentWatchData.torrent_hash,
      torrent_file_index: currentWatchData.torrent_file_index,
      torrent_file_name: currentWatchData.torrent_file_name,
      torrent_file_size: currentWatchData.torrent_file_size,
      torrent_quality: currentWatchData.torrent_quality,
      // Asegurar que guardamos información completa del torrent para poder recargarlo
      torrent_name: currentWatchData.torrent_name || currentWatchData.title,
      torrent_seeds: currentWatchData.torrent_seeds || 0,
      torrent_size: currentWatchData.torrent_size || currentWatchData.torrent_file_size
    };

    const response = await fetch('/api/watch-progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(progressData)
    });

    if (response.ok) {
      lastSavedTime = currentTime;
      console.log(`💾 Progress saved: ${currentTime}s for ${currentWatchData.title}`);
      
      // Refresh continue watching section (debounced to avoid too many updates)
      if (typeof refreshContinueWatchingSection === 'function') {
        clearTimeout(window.continueWatchingRefreshTimeout);
        window.continueWatchingRefreshTimeout = setTimeout(() => {
          refreshContinueWatchingSection();
        }, 2000);
      }
    } else {
      console.error('Failed to save watch progress:', await response.text());
    }

  } catch (error) {
    console.error('Error saving watch progress:', error);
  }
}

// Function to load existing watch progress
async function loadWatchProgress(content_type, tmdb_id, season_number = null, episode_number = null) {
  if (!currentUser) {
    return null;
  }

  try {
    const token = await getAuthToken();
    if (!token) {
      return null;
    }

    let url = `/api/watch-progress/${content_type}/${tmdb_id}`;
    const params = new URLSearchParams();
    
    if (season_number !== null) {
      params.append('season_number', season_number);
    }
    if (episode_number !== null) {
      params.append('episode_number', episode_number);
    }
    
    if (params.toString()) {
      url += '?' + params.toString();
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const progressData = await response.json();
      console.log(`📖 Loaded progress: ${progressData.playback_position}s for ${progressData.title}`);
      return progressData;
    } else if (response.status === 404) {
      // No existing progress found
      return null;
    } else {
      console.error('Failed to load watch progress:', await response.text());
      return null;
    }

  } catch (error) {
    console.error('Error loading watch progress:', error);
    return null;
  }
}

// Function to start watch progress tracking
function startWatchProgressTracking() {
  // Only start tracking if we have valid watch data and user
  if (!currentWatchData || !currentUser) {
    console.log('⚠️ No se puede iniciar rastreo de progreso: datos insuficientes');
    return;
  }
  
  if (watchProgressInterval) {
    clearInterval(watchProgressInterval);
  }

  watchProgressInterval = setInterval(() => {
    const videoPlayer = currentVideoPlayer;
    if (videoPlayer && !videoPlayer.paused && !videoPlayer.ended) {
      const currentTime = videoPlayer.currentTime;
      const totalDuration = videoPlayer.duration;
      
      // Save progress every SAVE_INTERVAL seconds or when near the end
      if (currentTime - lastSavedTime >= SAVE_INTERVAL || 
          (totalDuration && currentTime >= totalDuration - 30)) {
        saveWatchProgress(currentTime, totalDuration);
      }
    }
  }, 5000); // Check every 5 seconds
}

// Function to stop watch progress tracking
function stopWatchProgressTracking() {
  if (watchProgressInterval) {
    clearInterval(watchProgressInterval);
    watchProgressInterval = null;
  }
  
  // Save final progress when stopping
  const videoPlayer = currentVideoPlayer;
  if (videoPlayer && currentWatchData) {
    const currentTime = videoPlayer.currentTime;
    const totalDuration = videoPlayer.duration;
    saveWatchProgress(currentTime, totalDuration);
  }
}

// Function to set up current watch data for progress tracking
function setupWatchData(content_type, tmdb_id, title, season_number = null, episode_number = null, torrentInfo = null, fileIndex = null) {
  currentWatchData = {
    content_type,
    tmdb_id,
    title,
    season_number,
    episode_number,
    torrent_magnet_uri: torrentInfo?.magnetURI || null,
    torrent_hash: torrentInfo?.infoHash || null,
    torrent_file_index: fileIndex,
    torrent_file_name: torrentInfo?.videoFiles?.[fileIndex]?.name || null,
    torrent_file_size: torrentInfo?.videoFiles?.[fileIndex]?.length || null,
    torrent_quality: extractQualityFromTorrentName(torrentInfo?.name) || null,
    // Información adicional del torrent para poder recargarlo
    torrent_name: torrentInfo?.name || title,
    torrent_seeds: torrentInfo?.seeds || torrentInfo?.numPeers || 0,
    torrent_size: torrentInfo?.length || null
  };
}

// Helper function to extract quality from torrent name
function extractQualityFromTorrentName(name) {
  if (!name) return null;
  
  const nameUpper = name.toUpperCase();
  if (nameUpper.includes('2160P') || nameUpper.includes('4K')) return '4K';
  if (nameUpper.includes('1080P')) return '1080p';
  if (nameUpper.includes('720P')) return '720p';
  if (nameUpper.includes('480P')) return '480p';
  return 'Unknown';
}


let pendingTorrentRequests = new Map();


function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}


function showNotification(message, type = 'info', duration = 4000) {
  const notification = document.getElementById('notification');
  const messageElement = document.getElementById('notification-message');
  const container = document.getElementById('notification-container');
  

  messageElement.textContent = message;
  notification.className = `notification ${type}`;
  

  notification.classList.remove('hidden');
  setTimeout(() => notification.classList.add('show'), 10);
  

  const hideTimeout = setTimeout(() => {
    hideNotification();
  }, duration);
  

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


function testVideoStreamingFeatures() {

  

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

    showNotification(`Missing subtitle elements: ${missingElements.join(', ')}`, 'warning');
  } else {

    showNotification('All subtitle controls are available', 'success');
  }
}


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


function showSearchResultsInfo(data) {
  const resultsInfo = document.getElementById('search-results-info');
  const resultsCount = document.getElementById('results-count');
  const resultsBreakdown = document.getElementById('results-breakdown');
  
  if (resultsInfo && resultsCount && resultsBreakdown) {
    const totalResults = data.total_results || 0;
    const movieResults = data.movie_results || 0;
    const tvResults = data.tv_results || 0;
    

    let resultsText = `${totalResults} resultado${totalResults !== 1 ? 's' : ''} encontrado${totalResults !== 1 ? 's' : ''}`;
    

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


function hideSearchResultsInfo() {
  const resultsInfo = document.getElementById('search-results-info');
  if (resultsInfo) {
    resultsInfo.classList.add('hidden');
  }
}


function clearAllFilters() {

  const searchBar = document.getElementById('search-bar');
  if (searchBar) {
    searchBar.value = '';
  }
  

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
  

  const typeRadios = document.querySelectorAll('input[name="type"]');
  typeRadios.forEach(radio => {
    radio.checked = radio.value === '';
  });
  

  const favoritesCheckbox = document.getElementById('favorites-checkbox');
  if (favoritesCheckbox) {
    favoritesCheckbox.checked = false;
    showingFavorites = false;
    updateFavoritesChip();
  }
  
  // Reset continue watching mode (no checkbox anymore)
  showingContinueWatching = false;
  
  // Reset continue watching button text
  const seeAllBtn = document.getElementById('continue-watching-see-all');
  if (seeAllBtn) {
    seeAllBtn.innerHTML = `
      Ver todo
      <i class="fas fa-chevron-right"></i>
    `;
    seeAllBtn.classList.remove('active');
  }
  

  hideSearchResultsInfo();
  

  updateClearButtonVisibility();
  

  currentPage = 1;
  getTitles(currentPage);
  

  if (typeof showNotification === 'function') {
    showNotification('Filtros limpiados correctamente', 'success', 2000);
  }
}


function hasActiveFilters() {
  const searchBar = document.getElementById('search-bar');
  const typeSelect = document.getElementById('type');
  const genreSelect = document.getElementById('genre');
  const platformSelect = document.getElementById('platform');
  const adultFilterToggle = document.getElementById('adult-filter');
  const sortSelect = document.getElementById('sort');
  const favoritesCheckbox = document.getElementById('favorites-checkbox');
  

  if (searchBar && searchBar.value.trim() !== '') return true;
  

  if (typeSelect && typeSelect.value !== '') return true;
  if (genreSelect && genreSelect.value !== '') return true;
  if (platformSelect && platformSelect.value !== '') return true;
  

  if (adultFilterToggle && adultFilterToggle.getAttribute('data-state') !== 'false') return true;
  

  if (sortSelect && sortSelect.value !== 'popularity.desc') return true;
  

  if (favoritesCheckbox && favoritesCheckbox.checked) return true;
  
  // Check continue watching mode (no checkbox anymore, just check the flag)
  if (showingContinueWatching) return true;
  
  return false;
}


function updateClearButtonVisibility() {
  const clearFiltersBtn = document.getElementById('clear-filters-btn');
  if (clearFiltersBtn) {
    if (hasActiveFilters()) {
      clearFiltersBtn.classList.add('show');
    } else {
      clearFiltersBtn.classList.remove('show');
    }
  }
}


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
    case 'false': nextState = ''; break;
    case '': nextState = 'only'; break;
    case 'only': nextState = 'false'; break;
    default: nextState = 'false'; break;
  }
  
  toggle.setAttribute('data-state', nextState);
  updateAdultFilterDisplay(toggle);
  applyFilters();
}









document.addEventListener('DOMContentLoaded', function() {
  initializeNewInterface();
  

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
  

  const clearFiltersBtn = document.getElementById('clear-filters-btn');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', clearAllFilters);
  }
  

  const adultFilterToggle = document.getElementById('adult-filter');
  if (adultFilterToggle) {
    updateAdultFilterDisplay(adultFilterToggle);
  }
  

  updateClearButtonVisibility();
  
  // Add back to top button functionality
  const backToTopBtn = document.getElementById('back-to-top');
  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      // Smooth scroll to top
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
      
      // Also reset to normal view if in continue watching mode
      if (showingContinueWatching) {
        showAllContinueWatching(); // This will toggle back to compact view
      }
    });
  }
  

  getTitles(1);
  
  // Initialize continue watching section
  loadContinueWatchingSection();
});

function initializeNewInterface() {

  initializeFiltersToggle();
  

  initializeSearchSuggestions();
  

  initializeTypeFilters();
  

  initializeVoiceSearch();
  

  initializeAdvancedSettings();
}


function initializeAdvancedSettings() {
  const advancedSettings = document.querySelector('.adult-content-settings');
  
  if (advancedSettings) {

    advancedSettings.addEventListener('toggle', function() {
      if (this.open) {
        this.querySelector('.settings-content').style.animation = 'slideDown 0.3s ease-out';
      }
    });
  }
}


function initializeFiltersToggle() {
  const filtersToggle = document.getElementById('filters-toggle');
  const filtersContent = document.getElementById('filters-content');
  
  if (filtersToggle && filtersContent) {
    filtersToggle.addEventListener('click', function() {
      const isExpanded = filtersContent.classList.contains('expanded');
      
      if (isExpanded) {
        filtersContent.classList.remove('expanded');
        filtersToggle.classList.remove('active');

        filtersToggle.setAttribute('aria-expanded', 'false');
      } else {
        filtersContent.classList.add('expanded');
        filtersToggle.classList.add('active');

        filtersToggle.setAttribute('aria-expanded', 'true');
      }
    });
    

    filtersToggle.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.click();
      }
    });
  }
}


function initializeSearchSuggestions() {
  const suggestionTags = document.querySelectorAll('.suggestion-tag');
  const searchBar = document.getElementById('search-bar');
  
  suggestionTags.forEach(tag => {

    tag.addEventListener('click', function() {
      const searchTerm = this.getAttribute('data-search');
      if (searchBar && searchTerm) {
        searchBar.value = searchTerm;
        searchBar.focus();

        performSearch();
      }
    });
    

    tag.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.click();
      }
    });
    

    tag.addEventListener('focus', function() {
      this.style.transform = 'translateY(-2px)';
    });
    
    tag.addEventListener('blur', function() {
      this.style.transform = '';
    });
  });
}


function initializeTypeFilters() {
  const typeRadios = document.querySelectorAll('input[name="type"]');
  
  typeRadios.forEach(radio => {
    radio.addEventListener('change', function() {
      if (this.checked) {

        const typeSelect = document.getElementById('type');
        if (typeSelect) {
          typeSelect.value = this.value;
          applyFilters();
          updateGenreSelect();
        }
      }
    });
  });
}


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

    voiceBtn.style.display = 'none';
  }
}


function syncTypeFilters(selectedValue) {
  const typeRadios = document.querySelectorAll('input[name="type"]');
  typeRadios.forEach(radio => {
    radio.checked = radio.value === selectedValue;
  });
}


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


function performSearch() {
  const searchBar = document.getElementById('search-bar');
  if (searchBar && searchBar.value.trim()) {
    applyFilters();
  }
}


document.getElementById('login-btn').addEventListener('click', showLoginModal);
document.getElementById('register-btn').addEventListener('click', showRegisterModal);
document.getElementById('logout-btn').addEventListener('click', handleLogout);


document.getElementById('close-modal').addEventListener('click', hideAuthModal);
document.getElementById('switch-to-register').addEventListener('click', switchToRegister);
document.getElementById('login-form').addEventListener('submit', handleLogin);
document.getElementById('register-form').addEventListener('submit', handleRegister);


document.getElementById('auth-modal').addEventListener('click', (e) => {
  if (e.target.id === 'auth-modal') {
    hideAuthModal();
  }
});


document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {

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

    });
    


  }, 1000);
});



async function fetchProviders(type) {
  try {
    const response = await fetch(`/api/providers?type=${type}`);
    const data = await response.json();


    elements.platformSelect.innerHTML = '<option value="">Todas</option>';

    if (data.results.length > 0) {
      data.results.forEach((provider) => {
        const option = document.createElement("option");
        option.value = provider.provider_id;
        option.textContent = provider.provider_name;
        elements.platformSelect.appendChild(option);
      });
    }
  } catch (error) {

  }
}



async function fetchData(endpoint, params = '') {
  try {
    const response = await fetch(`/api/${endpoint}?${params}`);
    return await response.json();
  } catch (error) {

  }
}


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


async function getGenres(type) {
  try {
    const response = await fetch(`/api/genres/${type}`);
    if (!response.ok) {
      throw new Error('Error fetching genres');
    }
    const data = await response.json();
    

    if (Array.isArray(data)) {
      return data;
    } else if (data && Array.isArray(data.genres)) {
      return data.genres;
    } else {

      return [];
    }
  } catch (error) {

    return [];
  }
}


async function updateGenreSelect() {

  let type = document.getElementById('type').value;
  

  if (!type) {
    const selectedRadio = document.querySelector('input[name="type"]:checked');
    if (selectedRadio) {
      type = selectedRadio.value;
    }
  }
  
  const genres = await getGenres(type);
  const genreSelect = document.getElementById('genre');


  genreSelect.innerHTML = '<option value="">Todos los géneros</option>';


  genres.forEach(genre => {
    const option = document.createElement('option');
    option.value = genre.id;
    option.textContent = genre.name;
    genreSelect.appendChild(option);
  });
}


// Function to create trending cards with photo-style design and hover effects
function createTrendingCard(title, defaultContentType = 'movie') {
  const movieCard = document.createElement('div');
  movieCard.id = `trending-card-${title.id}`;
  movieCard.classList.add('trending-card');
  
  const contentType = title.content_type || title.media_type || defaultContentType;
  movieCard.classList.add(`content-${contentType}`);
  movieCard.setAttribute('data-type', contentType);
  movieCard.setAttribute('data-id', title.id);

  // Handle movie genres - need to ensure genreMap is available
  let movieGenres = 'N/A';
  if (title.genre_ids && window.genreMap) {
    movieGenres = title.genre_ids.map(id => window.genreMap[id]).filter(Boolean).join(', ') || 'N/A';
  } else if (title.genres) {
    movieGenres = title.genres.map(genre => genre.name).join(', ') || 'N/A';
  }

  // Function to check for non-Latin characters  
  const containsNonLatinChars = (str) => {
    if (!str) return false;
    return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf\uac00-\ud7a3]/.test(str);
  };

  // Determine the best title to display
  let titleName;
  if (title.title && !containsNonLatinChars(title.title)) {
    titleName = title.title;
  } else if (title.name && !containsNonLatinChars(title.name)) {
    titleName = title.name;
  } else if (title.original_title && !containsNonLatinChars(title.original_title)) {
    titleName = title.original_title;
  } else if (title.original_name && !containsNonLatinChars(title.original_name)) {
    titleName = title.original_name;
  } else {
    titleName = title.title || title.name || title.original_title || title.original_name || 'Título desconocido';
  }

  const releaseDate = title.release_date || title.first_air_date || 'Fecha desconocida';
  const year = releaseDate.split('-')[0];

  // Handle TV show specific data
  let seasons = '';
  let status = '';
  if (contentType === 'tv') {
    seasons = title.number_of_seasons ? `${title.number_of_seasons} Temporadas` : 'N/A';
    status = title.status ? (title.status === 'Ended' ? 'Finalizada' : 'En emisión') : 'Estado desconocido';
  }

  const contentTypeTag = contentType === 'movie' ? 'Película' : 'Serie';
  const contentTypeIcon = contentType === 'movie' ? '<i class="fas fa-film"></i>' : '<i class="fas fa-tv"></i>';
  const rating = title.vote_average ? (title.vote_average / 2).toFixed(1) : 'N/A';

  // Handle poster image with fallback for demo data
  let posterSrc;
  if (title.poster_path && title.poster_path.startsWith('/')) {
    // Real TMDB data
    posterSrc = `https://image.tmdb.org/t/p/w500${title.poster_path}`;
  } else if (title.poster_path && (title.poster_path.startsWith('http') || title.poster_path.startsWith('//'))) {
    // Already a full URL
    posterSrc = title.poster_path;
  } else {
    // Demo data or missing poster - use placeholder
    const safeTitle = titleName.replace(/[<>"'&]/g, ' ').substring(0, 20);
    const safeContentType = contentTypeTag.replace(/[<>"'&]/g, ' ');
    const safeDate = year.replace(/[<>"'&]/g, ' ').substring(0, 4);
    
    posterSrc = `data:image/svg+xml;base64,${btoa(`
      <svg width="300" height="450" viewBox="0 0 300 450" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#FF6B35;stop-opacity:0.8" />
            <stop offset="100%" style="stop-color:#1a1a1a;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="300" height="450" fill="url(#grad1)"/>
        <circle cx="150" cy="180" r="40" fill="rgba(255,255,255,0.1)"/>
        <path d="M130 165 L170 190 L130 215 Z" fill="rgba(255,255,255,0.3)"/>
        <text x="150" y="280" fill="#fff" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="bold">${safeTitle}</text>
        <text x="150" y="310" fill="#FFB366" text-anchor="middle" font-family="Arial, sans-serif" font-size="12">${safeContentType}</text>
        <text x="150" y="330" fill="rgba(255,255,255,0.7)" text-anchor="middle" font-family="Arial, sans-serif" font-size="11">${safeDate}</text>
      </svg>
    `)}`;
  }
  
  movieCard.innerHTML = `
    <div class="trending-card-image">
      <img src="${posterSrc}" alt="${titleName}" loading="lazy" onerror="this.src='data:image/svg+xml;base64,${btoa(`
        <svg width="300" height="450" viewBox="0 0 300 450" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="300" height="450" fill="#333"/>
          <text x="150" y="225" fill="#666" text-anchor="middle" font-family="Arial, sans-serif" font-size="14">Imagen no disponible</text>
        </svg>
      `)}'; this.onerror=null;">
      
      <!-- Content type indicator overlay -->
      <div class="content-type-indicator">
        ${contentTypeIcon}
        <span>${contentTypeTag}</span>
      </div>
      
      <!-- Hover overlay with additional information -->
      <div class="trending-hover-overlay">
        <div class="hover-content">
          <h4>${titleName}</h4>
          <div class="hover-details">
            <p><i class="fas fa-calendar"></i> ${year}</p>
            <p><i class="fas fa-star"></i> ${rating}/5</p>
            ${contentType === 'tv' && seasons !== 'N/A' ? `<p><i class="fas fa-list"></i> ${seasons}</p>` : ''}
            <p><i class="fas fa-tags"></i> ${movieGenres}</p>
          </div>
          ${title.overview ? `<p class="hover-overview">${title.overview.substring(0, 120)}...</p>` : ''}
        </div>
      </div>
    </div>
    
    <!-- Simple title and type below image -->
    <div class="trending-card-info">
      <h3 class="trending-title">${titleName}</h3>
      <div class="trending-meta">
        <span class="trending-type">${contentTypeIcon} ${contentTypeTag}</span>
        <span class="trending-year">${year}</span>
      </div>
    </div>
  `;

  // Add click event listener
  movieCard.addEventListener('click', () => {
    showDetails(title.id, contentType, movieCard);
  });

  return movieCard;
}

// Global function to create a movie element (reusable for regular grid)
function createMovieElement(title, defaultContentType = 'movie') {
  const movieCard = document.createElement('div');
  movieCard.id = `movie-card-${title.id}`;
  movieCard.classList.add('movie-card');
  
  const contentType = title.content_type || title.media_type || defaultContentType;
  movieCard.classList.add(`content-${contentType}`);
  movieCard.setAttribute('data-type', contentType);
  movieCard.setAttribute('data-id', title.id);

  // Handle movie genres - need to ensure genreMap is available
  let movieGenres = 'N/A';
  if (title.genre_ids && window.genreMap) {
    movieGenres = title.genre_ids.map(id => window.genreMap[id]).filter(Boolean).join(', ') || 'N/A';
  } else if (title.genres) {
    movieGenres = title.genres.map(genre => genre.name).join(', ') || 'N/A';
  }

  // Function to check for non-Latin characters  
  const containsNonLatinChars = (str) => {
    if (!str) return false;
    return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf\uac00-\ud7a3]/.test(str);
  };

  // Determine the best title to display
  let titleName;
  if (title.title && !containsNonLatinChars(title.title)) {
    titleName = title.title;
  } else if (title.name && !containsNonLatinChars(title.name)) {
    titleName = title.name;
  } else if (title.original_title && !containsNonLatinChars(title.original_title)) {
    titleName = title.original_title;
  } else if (title.original_name && !containsNonLatinChars(title.original_name)) {
    titleName = title.original_name;
  } else {
    titleName = title.title || title.name || title.original_title || title.original_name || 'Título desconocido';
  }

  const releaseDate = title.release_date || title.first_air_date || 'Fecha desconocida';

  // Handle TV show specific data
  let seasons = '';
  let status = '';
  if (contentType === 'tv') {
    // For demo data or when we can't fetch details, use placeholder
    seasons = title.number_of_seasons ? `${title.number_of_seasons} Temporadas` : 'N/A';
    status = title.status ? (title.status === 'Ended' ? 'Finalizada' : 'En emisión') : 'Estado desconocido';
  }

  const stars = renderStars(title.vote_average || 0);
  const contentTypeTag = contentType === 'movie' ? 'Película' : 'Serie';
  const contentTypeIcon = contentType === 'movie' ? '<i class="fas fa-film"></i>' : '<i class="fas fa-tv"></i>';
  
  // Build progress indicator for continue watching items
  let progressInfo = '';
  if (title.watch_progress) {
    const progressPercent = title.watch_progress.progress_percentage || 0;
    const resumeTime = formatTime(title.watch_progress.playback_position);
    const episodeInfo = title.watch_progress.season_number && title.watch_progress.episode_number 
      ? ` (T${title.watch_progress.season_number}E${title.watch_progress.episode_number})`
      : '';
    
    progressInfo = `
      <div class="progress-info" style="background: linear-gradient(135deg, #4CAF50, #45a049); color: white; padding: 8px; border-radius: 4px; margin: 8px 0; text-align: center;">
        <i class="fas fa-play-circle"></i> Continuar desde ${resumeTime}${episodeInfo}
        <div class="progress-bar" style="background: rgba(255,255,255,0.3); height: 4px; border-radius: 2px; margin-top: 4px;">
          <div class="progress-fill" style="background: white; height: 100%; width: ${Math.min(progressPercent, 100)}%; border-radius: 2px; transition: width 0.3s ease;"></div>
        </div>
      </div>
    `;
  }

  // Handle poster image with fallback for demo data
  let posterSrc;
  if (title.poster_path && title.poster_path.startsWith('/')) {
    // Real TMDB data
    posterSrc = `https://image.tmdb.org/t/p/w500${title.poster_path}`;
  } else if (title.poster_path && (title.poster_path.startsWith('http') || title.poster_path.startsWith('//'))) {
    // Already a full URL
    posterSrc = title.poster_path;
  } else {
    // Demo data or missing poster - use placeholder
    const safeTitle = titleName.replace(/[<>"'&]/g, ' ').substring(0, 20);
    const safeContentType = contentTypeTag.replace(/[<>"'&]/g, ' ');
    const safeDate = releaseDate.replace(/[<>"'&]/g, ' ').substring(0, 10);
    
    posterSrc = `data:image/svg+xml;base64,${btoa(`
      <svg width="500" height="750" viewBox="0 0 500 750" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="500" height="750" fill="#1a1a1a"/>
        <circle cx="250" cy="300" r="60" fill="#333"/>
        <path d="M220 280 L280 320 L220 360 Z" fill="#666"/>
        <text x="250" y="450" fill="#666" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="bold">${safeTitle}</text>
        <text x="250" y="490" fill="#555" text-anchor="middle" font-family="Arial, sans-serif" font-size="18">${safeContentType}</text>
        <text x="250" y="530" fill="#444" text-anchor="middle" font-family="Arial, sans-serif" font-size="16">${safeDate}</text>
      </svg>
    `)}`;
  }
  
  movieCard.innerHTML = `
    <img src="${posterSrc}" alt="${titleName}" loading="lazy" onerror="this.src='data:image/svg+xml;base64,${btoa(`
      <svg width="500" height="750" viewBox="0 0 500 750" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="500" height="750" fill="#333"/>
        <text x="250" y="375" fill="#666" text-anchor="middle" font-family="Arial, sans-serif" font-size="20">Imagen no disponible</text>
      </svg>
    `)}'; this.onerror=null;">
    <h3 class="title-with-icon ${contentType}">${contentTypeIcon}<span class="title-text">${titleName}</span></h3>
    ${progressInfo}
    <p><strong>Estreno:</strong> ${releaseDate}</p>
    <p><strong>Género:</strong> ${movieGenres}</p>
    ${seasons ? `<p><strong>Temporadas:</strong> ${seasons}</p>` : ''}
    ${status ? `<p><strong>Estado:</strong> ${status}</p>` : ''}
    <p><strong>Valoración:</strong> ${stars}</p>

    <!-- Contenedor para los íconos alineados a la derecha -->
    <div class="card-icons">
      <i id="heart-icon-${title.id}" 
         class="fas fa-heart" 
         style="cursor: pointer; color: black;" 
         onclick="toggleFavorite(${title.id}, '${contentType}', event)"></i>
      <i id="eye-icon-${title.id}" 
         class="fas fa-eye" 
         style="cursor: pointer; color: ${isWatched(title.id, contentType) ? 'blue' : 'black'};" 
         onclick="toggleWatched(${title.id}, '${contentType}', event)"></i>
    </div>
  `;

  // Add watched class if applicable
  if (isWatched(title.id, contentType)) {
    movieCard.classList.add('watched');
  } else {
    movieCard.classList.remove('watched');
  }

  // Add click event listener
  movieCard.addEventListener('click', () => {
    // Check if this is a "continue watching" item with progress data
    if (showingContinueWatching && title.watch_progress) {
      // Resume playback directly using the torrent hash (automatic mode)
      resumeFromProgress(title, true);
    } else {
      // Regular behavior: show details modal
      showDetails(title.id, contentType, movieCard);
    }
  });

  return movieCard;
}

async function getTitles(page = 1) {
  if (isLoading) return;
  isLoading = true;


  showSearchLoading(true);


  let type = document.getElementById('type').value;
  if (!type) {
    const selectedRadio = document.querySelector('input[name="type"]:checked');
    if (selectedRadio) {
      type = selectedRadio.value;

      document.getElementById('type').value = type;
    }
  }
  
  const genre = document.getElementById('genre').value;
  const platform = document.getElementById('platform').value;
  const adultFilter = document.getElementById('adult-filter').getAttribute('data-state');
  const sortBy = document.getElementById('sort').value;
  const searchQuery = document.getElementById('search-bar') ? document.getElementById('search-bar').value.trim() : '';

  if (page === 1) {
    elements.movieGrid.innerHTML = '';
  }

  let data;
  

  if (showingFavorites) {

    
    if (!currentUser) {

      elements.movieGrid.innerHTML = '<p>Debes iniciar sesión para ver tus favoritos.</p>';
      return;
    }

    try {

      const favoritesResult = await favorites.getFavorites(currentUser.id);
      

      
      if (!favoritesResult.success) {

        elements.movieGrid.innerHTML = '<p>Error al cargar favoritos: ' + (favoritesResult.error || 'Error desconocido') + '</p>';
        return;
      }

      let userFavorites = favoritesResult.data || [];



      if (type && type !== '') {

        const beforeFilter = userFavorites.length;
        userFavorites = userFavorites.filter(fav => fav.movie_data.type === type);

      }

      if (userFavorites.length === 0) {
        console.log('📭 No hay favoritos en esta categoría');
        elements.movieGrid.innerHTML = '<p>No tienes favoritos en esta categoría.</p>';
        showSearchLoading(false);
        isLoading = false;
        return;
      }

      console.log('🎬 Mostrando favoritos:', userFavorites.map(f => f.movie_title));


      data = { results: [] };

      for (let favorite of userFavorites) {
        const movieData = favorite.movie_data;
        console.log('🎯 Procesando favorito:', movieData);
        
        if (movieData && movieData.id) {

          const movie = {
            id: movieData.id,
            title: movieData.title || favorite.movie_title,
            name: movieData.name || favorite.movie_title,
            poster_path: movieData.image || movieData.poster_path,
            overview: movieData.overview || 'Sin descripción disponible',
            release_date: movieData.release_date,
            first_air_date: movieData.first_air_date,
            vote_average: movieData.vote_average || 0,
            content_type: movieData.type,
            genre_ids: movieData.genre_ids || [],

            ...movieData
          };
          
          console.log('✅ Película procesada:', movie.title || movie.name);
          data.results.push(movie);
        } else {
          console.warn('⚠️ Favorito sin datos válidos:', favorite);
        }
      }
      
      console.log(`🎉 Total favoritos procesados: ${data.results.length}`);
    } catch (error) {
      console.error('Error loading favorites:', error);
      elements.movieGrid.innerHTML = '<p>Error al cargar favoritos.</p>';
      showSearchLoading(false);
      isLoading = false;
      return;
    }
  } else if (showingContinueWatching) {
    // Show continue watching (recent progress) items
    if (!currentUser) {
      elements.movieGrid.innerHTML = '<p>Debes iniciar sesión para ver tu progreso de visualización.</p>';
      showSearchLoading(false);
      isLoading = false;
      return;
    }

    try {
      const token = await getAuthToken();
      if (!token) {
        elements.movieGrid.innerHTML = '<p>Error de autenticación. Por favor, inicia sesión nuevamente.</p>';
        showSearchLoading(false);
        isLoading = false;
        return;
      }

      // Fetch recent watch progress
      let url = `/api/watch-progress?limit=20`;
      if (type && type !== '') {
        url += `&content_type=${type}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar el progreso de visualización');
      }

      const watchProgress = await response.json();

      if (watchProgress.length === 0) {
        elements.movieGrid.innerHTML = '<p>No has visto ningún contenido aún. ¡Comienza a ver algo!</p>';
        showSearchLoading(false);
        isLoading = false;
        return;
      }

      // Convert watch progress to movie data format
      data = { results: [] };
      
      for (let progress of watchProgress) {
        try {
          // Fetch detailed info from TMDb for each item
          const detailsResponse = await fetch(`/api/titles/details?id=${progress.tmdb_id}&type=${progress.content_type}&language=en`);
          let movieDetails = null;
          
          if (detailsResponse.ok) {
            movieDetails = await detailsResponse.json();
          }

          const movie = {
            id: progress.tmdb_id,
            title: movieDetails?.title || progress.title,
            name: movieDetails?.name || progress.title,
            poster_path: movieDetails?.poster_path,
            overview: movieDetails?.overview || 'Sin descripción disponible',
            release_date: movieDetails?.release_date,
            first_air_date: movieDetails?.first_air_date,
            vote_average: movieDetails?.vote_average || 0,
            content_type: progress.content_type,
            genre_ids: movieDetails?.genre_ids || [],
            // Add progress information
            watch_progress: {
              playback_position: progress.playback_position,
              total_duration: progress.total_duration,
              progress_percentage: progress.progress_percentage,
              last_watched: progress.last_watched,
              season_number: progress.season_number,
              episode_number: progress.episode_number,
              torrent_hash: progress.torrent_hash,
              torrent_file_name: progress.torrent_file_name
            }
          };
          
          data.results.push(movie);
        } catch (itemError) {
          console.warn('⚠️ Error procesando elemento de progreso:', itemError);
        }
      }
      
      console.log(`🎉 Total elementos de progreso procesados: ${data.results.length}`);
    } catch (error) {
      console.error('Error loading watch progress:', error);
      elements.movieGrid.innerHTML = '<p>Error al cargar el progreso de visualización.</p>';
      showSearchLoading(false);
      isLoading = false;
      return;
    }
  } else if (searchQuery && searchQuery.length > 0) {

    const params = new URLSearchParams({
      searchQuery,
      type,
      genre,
      platform,
      adultFilter,
      sortBy,
      page
    }).toString();

    data = await fetchData('search-all', params);
  } else {


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
    

    if (data && data.results) {
      data.results = data.results.map(item => ({
        ...item,
        content_type: defaultType
      }));
    }
  }


  showSearchLoading(false);


  if (!data || !data.results || data.results.length === 0) {
    if (currentPage === 1) {
      elements.movieGrid.innerHTML = '<p>No se encontraron resultados.</p>';
      hideSearchResultsInfo();
    }
    isLoading = false;
    return;
  }


  if (searchQuery && searchQuery.length > 0) {
    showSearchResultsInfo(data);
  } else {
    hideSearchResultsInfo();
  }

  totalResults = data.total_results;


  const defaultContentType = type || 'movie';


  const genreData = await fetchData('genres');
  window.genreMap = {};
  genreData.genres.forEach(genre => {
    window.genreMap[genre.id] = genre.name;
  });

  // Use the global createMovieElement function for each title
  data.results.forEach(async (title) => {
    const movieCard = createMovieElement(title, defaultContentType);
    elements.movieGrid.appendChild(movieCard);
  });

  updateFavoriteColors(data.results, defaultContentType);

  isLoading = false;
}

// Function to resume playback from saved progress
async function resumeFromProgress(movie, autoResume = false) {
  try {
    console.log('🔄 Resumiendo reproducción desde progreso guardado:', movie);
    
    // Check if we have torrent hash to resume exact torrent
    if (movie.watch_progress.torrent_hash) {
      console.log(`🎬 Resumiendo torrent: ${movie.watch_progress.torrent_hash}`);
      
      // Try to find the exact torrent and resume
      const resumeTime = formatTime(movie.watch_progress.playback_position);
      
      // Skip confirmation if autoResume is true (from continue watching section)
      const shouldResume = autoResume || confirm(
        `¿Quieres continuar "${movie.title || movie.name}" desde donde lo dejaste? (${resumeTime})`
      );
      
      if (shouldResume) {
        // First, try to resume the exact torrent if it's still available
        try {
          console.log(`🔍 Verificando estado del torrent: ${movie.watch_progress.torrent_hash}`);
          
          // Check if the torrent is still active on the server with timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          const torrentStatusResponse = await fetch(`/api/torrent/status/${movie.watch_progress.torrent_hash}`, {
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (torrentStatusResponse.ok) {
            // Torrent is still active, we can resume directly
            console.log('✅ Torrent encontrado activo, resumiendo directamente');
            
            const torrentInfo = {
              infoHash: movie.watch_progress.torrent_hash,
              name: movie.watch_progress.torrent_file_name || movie.title,
              files: [{ name: movie.watch_progress.torrent_file_name }],
              videoFiles: [{ 
                index: 0, 
                name: movie.watch_progress.torrent_file_name,
                size: movie.watch_progress.torrent_file_size
              }],
              magnetURI: movie.watch_progress.torrent_magnet_uri // Incluir el magnet link
            };
            
            // Set up current content data for progress tracking with proper season/episode info
            currentContentData = {
              id: movie.id,
              title: movie.title || movie.name,
              content_type: movie.content_type,
              season_number: movie.watch_progress.season_number,
              episode_number: movie.watch_progress.episode_number
            };
            
            // Set up watch data with the resume progress information
            setupWatchData(
              movie.content_type,
              movie.id,
              movie.title || movie.name,
              movie.watch_progress.season_number,
              movie.watch_progress.episode_number,
              torrentInfo,
              0
            );
            
            // Set global torrent info and start playback
            currentTorrentInfo = torrentInfo;
            playVideoFileWithStats(0);
            
            // Initialize subtitle functionality for resumed content
            setTimeout(() => {
              clearSubtitles();
              loadTorrentSubtitles();
              setupSubtitleControls();
              console.log('✅ Subtítulos inicializados para contenido resumido');
            }, 500);
            
            // Set the video time to saved position once it loads with multiple fallbacks
            const videoPlayer = document.getElementById('video-player');
            const targetTime = movie.watch_progress.playback_position;
            
            if (videoPlayer) {
              const setVideoTime = () => {
                if (videoPlayer.readyState >= 2) { // HAVE_CURRENT_DATA or higher
                  videoPlayer.currentTime = targetTime;
                  console.log(`✅ Video tiempo establecido a: ${formatTime(targetTime)}`);
                  if (autoResume) {
                    showNotification(`▶️ Continuando automáticamente desde ${resumeTime}`, 'success', 3000);
                  } else {
                    showNotification(`Resumiendo desde ${resumeTime}`, 'info', 3000);
                  }
                  return true;
                }
                return false;
              };
              
              // Try to set time immediately if video is already loaded
              if (!setVideoTime()) {
                // If not loaded, wait for appropriate events
                const events = ['loadeddata', 'canplay', 'loadedmetadata'];
                let eventHandled = false;
                
                events.forEach(eventName => {
                  videoPlayer.addEventListener(eventName, () => {
                    if (!eventHandled && setVideoTime()) {
                      eventHandled = true;
                    }
                  }, { once: true });
                });
                
                // Fallback timeout
                setTimeout(() => {
                  if (!eventHandled) {
                    setVideoTime();
                  }
                }, 2000);
              }
            }
          } else {
            // Torrent not active, pero tenemos magnet link - recargar torrent
            console.log('🔄 Torrent no activo en servidor, recargando desde magnet link...');
            throw new Error('TORRENT_RELOAD_NEEDED');
          }
        } catch (torrentError) {
          console.warn('⚠️ No se pudo reanudar torrent exacto:', torrentError);
          
          // Si tenemos magnet link, intentar recargar el torrent
          if (torrentError.message === 'TORRENT_RELOAD_NEEDED' && movie.watch_progress.torrent_magnet_uri) {
            console.log('🚀 Recargando torrent desde magnet link guardado...');
            
            if (autoResume) {
              showNotification('🔄 Recargando torrent para continuar reproducción...', 'info', 3000);
            } else {
              showNotification(`Recargando torrent para reanudar desde ${resumeTime}...`, 'info', 3000);
            }
            
            // Usar el magnet link guardado para recargar el torrent
            await watchOnlineWithStats(movie.watch_progress.torrent_magnet_uri, movie.title || movie.name);
            
            // Una vez que se cargue el torrent, configurar el tiempo de reproducción
            setTimeout(() => {
              const videoPlayer = document.getElementById('video-player');
              if (videoPlayer && movie.watch_progress.playback_position > 30) {
                const targetTime = movie.watch_progress.playback_position;
                
                const setVideoTime = () => {
                  if (videoPlayer.readyState >= 2) {
                    videoPlayer.currentTime = targetTime;
                    console.log(`✅ Video tiempo establecido a: ${formatTime(targetTime)} (desde magnet recargado)`);
                    
                    // Actualizar los datos de seguimiento con el torrent recargado
                    if (currentTorrentInfo) {
                      setupWatchData(
                        movie.content_type,
                        movie.id,
                        movie.title || movie.name,
                        movie.watch_progress.season_number,
                        movie.watch_progress.episode_number,
                        currentTorrentInfo,
                        0
                      );
                    }
                    
                    if (autoResume) {
                      showNotification(`▶️ Continuando automáticamente desde ${resumeTime}`, 'success', 3000);
                    } else {
                      showNotification(`Resumiendo desde ${resumeTime}`, 'info', 3000);
                    }
                    return true;
                  }
                  return false;
                };
                
                // Intentar establecer el tiempo inmediatamente
                if (!setVideoTime()) {
                  // Si no está listo, esperar a los eventos apropiados
                  const events = ['loadeddata', 'canplay', 'loadedmetadata'];
                  let eventHandled = false;
                  
                  events.forEach(eventName => {
                    videoPlayer.addEventListener(eventName, () => {
                      if (!eventHandled && setVideoTime()) {
                        eventHandled = true;
                      }
                    }, { once: true });
                  });
                  
                  // Timeout de respaldo
                  setTimeout(() => {
                    if (!eventHandled) {
                      setVideoTime();
                    }
                  }, 5000);
                }
              }
            }, 3000); // Dar tiempo para que el torrent se cargue
            
            return; // Salir aquí ya que estamos manejando la recarga
          }
          
          // For auto-resume with movies, try automatic recovery first
          if (autoResume && movie.content_type === 'movie') {
            console.log('🤖 Intentando recuperación automática para película...');
            
            const recoverySuccessful = await attemptTorrentRecovery(movie, movie.watch_progress.torrent_hash);
            
            if (recoverySuccessful) {
              // Recovery was successful, no need to show details modal
              return;
            }
          }
          
          // Provide more specific error messages based on the error type
          let userMessage = '';
          let notificationType = 'warning';
          
          if (torrentError.name === 'AbortError') {
            if (autoResume) {
              userMessage = '⏱️ Verificación de torrent tardó demasiado. Buscando alternativas...';
            } else {
              userMessage = 'La verificación del torrent tardó demasiado. Abriendo opciones disponibles.';
            }
          } else if (torrentError.message.includes('404') || torrentError.message.includes('no está activo')) {
            if (autoResume) {
              userMessage = '🔄 El torrent original expiró. Abriendo opciones de torrents...';
            } else {
              userMessage = 'El torrent original ya no está disponible. Te ayudaremos a encontrar uno nuevo.';
            }
          } else if (torrentError.message.includes('500') || torrentError.message.includes('servidor')) {
            userMessage = '⚠️ Problema con el servidor. Reintentando con nuevos torrents...';
            notificationType = 'error';
          } else if (torrentError.name === 'TypeError' || torrentError.message.includes('fetch')) {
            userMessage = '🌐 Problema de conexión. Verificando torrents disponibles...';
          } else {
            if (autoResume) {
              userMessage = '🔍 Torrent original no disponible. Abriendo opciones de torrents...';
            } else {
              userMessage = 'El torrent original no está disponible. Abriendo opciones de torrents.';
            }
          }
          
          showNotification(userMessage, notificationType, 4000);
          
          // Try to find the movie card more reliably
          let movieCard = document.querySelector(`#movie-card-${movie.id}`);
          if (!movieCard) {
            // If we can't find the specific card, create a temporary one or open modal directly
            movieCard = null;
          }
          
          showDetails(movie.id, movie.content_type, movieCard);
        }
      }
    } else {
      // No torrent hash available, check if we have magnet link
      if (movie.watch_progress && movie.watch_progress.torrent_magnet_uri) {
        console.log('🔗 No hay hash de torrent, pero tenemos magnet link - recargando...');
        
        if (autoResume) {
          showNotification('🔄 Recargando torrent para continuar reproducción...', 'info', 3000);
        } else {
          const resumeTime = formatTime(movie.watch_progress.playback_position);
          const shouldResume = confirm(
            `¿Quieres continuar "${movie.title || movie.name}" desde donde lo dejaste? (${resumeTime})`
          );
          
          if (!shouldResume) {
            return;
          }
          
          showNotification(`Recargando torrent para reanudar desde ${resumeTime}...`, 'info', 3000);
        }
        
        // Usar el magnet link guardado para recargar el torrent
        await watchOnlineWithStats(movie.watch_progress.torrent_magnet_uri, movie.title || movie.name);
        
        // Una vez que se cargue el torrent, configurar el tiempo de reproducción
        setTimeout(() => {
          const videoPlayer = document.getElementById('video-player');
          if (videoPlayer && movie.watch_progress.playback_position > 30) {
            const targetTime = movie.watch_progress.playback_position;
            const resumeTime = formatTime(targetTime);
            
            const setVideoTime = () => {
              if (videoPlayer.readyState >= 2) {
                videoPlayer.currentTime = targetTime;
                console.log(`✅ Video tiempo establecido a: ${resumeTime} (desde magnet sin hash)`);
                
                // Actualizar los datos de seguimiento con el torrent recargado
                if (currentTorrentInfo) {
                  setupWatchData(
                    movie.content_type,
                    movie.id,
                    movie.title || movie.name,
                    movie.watch_progress.season_number,
                    movie.watch_progress.episode_number,
                    currentTorrentInfo,
                    0
                  );
                }
                
                if (autoResume) {
                  showNotification(`▶️ Continuando automáticamente desde ${resumeTime}`, 'success', 3000);
                } else {
                  showNotification(`Resumiendo desde ${resumeTime}`, 'info', 3000);
                }
                return true;
              }
              return false;
            };
            
            // Intentar establecer el tiempo inmediatamente
            if (!setVideoTime()) {
              // Si no está listo, esperar a los eventos apropiados
              const events = ['loadeddata', 'canplay', 'loadedmetadata'];
              let eventHandled = false;
              
              events.forEach(eventName => {
                videoPlayer.addEventListener(eventName, () => {
                  if (!eventHandled && setVideoTime()) {
                    eventHandled = true;
                  }
                }, { once: true });
              });
              
              // Timeout de respaldo
              setTimeout(() => {
                if (!eventHandled) {
                  setVideoTime();
                }
              }, 5000);
            }
          }
        }, 3000); // Dar tiempo para que el torrent se cargue
        
        return; // Salir aquí ya que estamos manejando la recarga
      }
      
      // No torrent hash or magnet link available, open details modal to select torrent
      if (autoResume) {
        showNotification('🔍 Buscando torrents para continuar reproducción...', 'info', 3000);
      } else {
        showNotification('No se encontró información de torrent. Abriendo detalles para seleccionar torrent.', 'info', 3000);
      }
      
      // Try to find the movie card more reliably
      let movieCard = document.querySelector(`#movie-card-${movie.id}`);
      if (!movieCard) {
        movieCard = null;
      }
      
      showDetails(movie.id, movie.content_type, movieCard);
    }
    
  } catch (error) {
    console.error('Error resumiendo reproducción:', error);
    
    // Provide more specific error messages based on error type
    let userMessage = '';
    let notificationType = 'error';
    
    if (error.message.includes('network') || error.message.includes('fetch')) {
      if (autoResume) {
        userMessage = '🌐 Problema de conexión al reanudar. Abriendo opciones disponibles.';
      } else {
        userMessage = 'Problema de conexión. Verifica tu internet e intenta nuevamente.';
      }
    } else if (error.message.includes('data') || error.message.includes('progress')) {
      if (autoResume) {
        userMessage = '📊 Datos de progreso corruptos. Abriendo opciones para ver desde el inicio.';
      } else {
        userMessage = 'Problema con los datos de progreso guardados. Abriendo detalles.';
      }
    } else {
      if (autoResume) {
        userMessage = '❌ Error al continuar automáticamente. Abriendo opciones manuales.';
      } else {
        userMessage = 'Error al reanudar reproducción. Abriendo detalles para seleccionar nueva fuente.';
      }
    }
    
    showNotification(userMessage, notificationType, 4000);
    
    // Try to find the movie card more reliably, or pass null if not found
    let movieCard = document.querySelector(`#movie-card-${movie.id}`);
    if (!movieCard) {
      movieCard = null;
    }
    
    showDetails(movie.id, movie.content_type, movieCard);
  }
}

// Function to clean up expired or invalid watch progress data
async function cleanupExpiredProgress(contentType, tmdbId, seasonNumber = null, episodeNumber = null) {
  try {
    if (!currentUser) return;
    
    console.log('🧹 Limpiando progreso de reproducción expirado...');
    
    const progressData = await loadWatchProgress(contentType, tmdbId, seasonNumber, episodeNumber);
    
    if (progressData && progressData.torrent_hash) {
      // Check if the torrent is still valid
      try {
        const response = await fetch(`/api/torrent/status/${progressData.torrent_hash}`);
        if (!response.ok) {
          // Torrent is no longer available, clear the progress data
          console.log('🗑️ Eliminando datos de progreso para torrent expirado:', progressData.torrent_hash);
          
          // You could implement a function to remove specific progress data here
          // For now, we'll just log it
          showNotification('Se eliminaron datos de progreso obsoletos', 'info', 2000);
        }
      } catch (error) {
        console.warn('Error verificando torrent para limpieza:', error);
      }
    }
  } catch (error) {
    console.error('Error limpiando progreso expirado:', error);
  }
}

// Function to attempt automatic torrent recovery when original is not available
async function attemptTorrentRecovery(movie, originalTorrentHash) {
  try {
    console.log('🔄 Intentando recuperación automática de torrent para:', movie.title || movie.name);
    
    const title = movie.title || movie.name;
    const contentType = movie.content_type || 'movie';
    
    // Show loading notification
    showNotification('🔍 Buscando torrent alternativo para continuar reproducción...', 'info', 4000);
    
    // For TV shows, include season and episode info if available
    let searchTitle = title;
    if (contentType === 'tv' && movie.watch_progress) {
      if (movie.watch_progress.season_number && movie.watch_progress.episode_number) {
        searchTitle += ` S${String(movie.watch_progress.season_number).padStart(2, '0')}E${String(movie.watch_progress.episode_number).padStart(2, '0')}`;
      }
    }
    
    // Try to fetch torrents for this content
    let torrents = [];
    if (contentType === 'tv') {
      // For TV shows, we'd need the full TV details to search properly
      console.log('🎬 Recuperación de TV shows requiere búsqueda manual');
      return false;
    } else {
      // For movies, try to fetch torrents using the same API as the app
      try {
        const response = await fetch(`/api/torrents?movieTitle=${encodeURIComponent(title)}`);
        if (response.ok) {
          const data = await response.json();
          torrents = data.results || data || [];
        } else {
          console.warn('❌ Error buscando torrents alternativos:', response.status);
          return false;
        }
      } catch (fetchError) {
        console.warn('❌ Error de red buscando torrents alternativos:', fetchError);
        return false;
      }
    }
    
    if (torrents.length > 0) {
      // Filter out the original failed torrent and find the best alternative
      const alternativeTorrents = torrents.filter(torrent => {
        // Handle different torrent object structures
        const magnetLink = torrent.magnet || torrent.magnetUrl || torrent.download;
        if (!magnetLink) return false;
        
        const torrentHash = magnetLink.match(/xt=urn:btih:([^&]+)/i)?.[1];
        return torrentHash && torrentHash.toLowerCase() !== originalTorrentHash.toLowerCase();
      });
      
      if (alternativeTorrents.length > 0) {
        // Sort by quality and seeds to find the best alternative
        alternativeTorrents.sort((a, b) => {
          const seedsA = parseInt(a.seeds) || parseInt(a.seeders) || 0;
          const seedsB = parseInt(b.seeds) || parseInt(b.seeders) || 0;
          return seedsB - seedsA; // Higher seeds first
        });
        
        const bestAlternative = alternativeTorrents[0];
        const magnetLink = bestAlternative.magnet || bestAlternative.magnetUrl || bestAlternative.download;
        
        showNotification(`✅ Torrent alternativo encontrado: ${bestAlternative.quality || bestAlternative.title || 'Calidad desconocida'}`, 'success', 3000);
        
        // Try to start the alternative torrent with saved progress
        setTimeout(() => {
          watchOnlineWithStats(magnetLink, title);
          
          // Try to set the saved time once video loads
          setTimeout(() => {
            const videoPlayer = document.getElementById('video-player');
            if (videoPlayer && movie.watch_progress.playback_position > 30) {
              const setTime = () => {
                if (videoPlayer.readyState >= 2) {
                  videoPlayer.currentTime = movie.watch_progress.playback_position;
                  const resumeTime = formatTime(movie.watch_progress.playback_position);
                  showNotification(`⏭️ Saltando automáticamente a ${resumeTime}`, 'info', 3000);
                }
              };
              
              if (videoPlayer.readyState >= 2) {
                setTime();
              } else {
                videoPlayer.addEventListener('loadeddata', setTime, { once: true });
              }
            }
          }, 3000);
        }, 1000);
        
        return true;
      } else {
        console.log('❌ No se encontraron torrents alternativos diferentes al original');
      }
    } else {
      console.log('❌ No se encontraron torrents para el título:', title);
    }
    
    console.log('❌ No se encontraron torrents alternativos');
    return false;
    
  } catch (error) {
    console.error('Error en recuperación automática de torrent:', error);
    return false;
  }
}

// Function to show a nice resume modal instead of ugly confirm()
function showResumeModal(resumeTime, playbackPosition, videoPlayer) {
  // Create modal HTML
  const modalHTML = `
    <div id="resume-modal" class="modal-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.8); z-index: 10000; display: flex; align-items: center; justify-content: center;">
      <div class="modal-content" style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); padding: 30px; border-radius: 15px; max-width: 500px; width: 90%; text-align: center; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);">
        <h3 style="color: white; margin-bottom: 20px; font-size: 1.5em;">
          <i class="fas fa-play-circle" style="color: #4CAF50; margin-right: 10px;"></i>
          Continuar Reproducción
        </h3>
        <p style="color: #e0e0e0; margin-bottom: 25px; font-size: 1.1em;">
          ¿Quieres continuar desde donde lo dejaste?
        </p>
        <div style="background: rgba(255, 255, 255, 0.1); padding: 15px; border-radius: 10px; margin-bottom: 25px;">
          <div style="color: #4CAF50; font-size: 1.3em; font-weight: bold;">
            <i class="fas fa-clock" style="margin-right: 8px;"></i>
            ${resumeTime}
          </div>
        </div>
        <div style="display: flex; gap: 15px; justify-content: center;">
          <button id="resume-yes" style="background: #4CAF50; color: white; border: none; padding: 12px 25px; border-radius: 8px; font-size: 1em; cursor: pointer; transition: all 0.3s ease;">
            <i class="fas fa-play" style="margin-right: 8px;"></i>
            Sí, continuar
          </button>
          <button id="resume-no" style="background: #f44336; color: white; border: none; padding: 12px 25px; border-radius: 8px; font-size: 1em; cursor: pointer; transition: all 0.3s ease;">
            <i class="fas fa-step-backward" style="margin-right: 8px;"></i>
            No, desde el inicio
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Add modal to body
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  const modal = document.getElementById('resume-modal');
  const yesBtn = document.getElementById('resume-yes');
  const noBtn = document.getElementById('resume-no');
  
  // Add hover effects
  yesBtn.addEventListener('mouseenter', () => yesBtn.style.transform = 'scale(1.05)');
  yesBtn.addEventListener('mouseleave', () => yesBtn.style.transform = 'scale(1)');
  noBtn.addEventListener('mouseenter', () => noBtn.style.transform = 'scale(1.05)');
  noBtn.addEventListener('mouseleave', () => noBtn.style.transform = 'scale(1)');
  
  // Handle yes button
  yesBtn.addEventListener('click', () => {
    modal.remove();
    
    const setVideoTime = () => {
      if (videoPlayer.readyState >= 2) {
        videoPlayer.currentTime = playbackPosition;
        showNotification(`▶️ Continuando desde ${resumeTime}`, 'success', 3000);
        return true;
      }
      return false;
    };
    
    // Try to set time immediately if video is already loaded
    if (!setVideoTime()) {
      // If not loaded, wait for appropriate events
      const events = ['loadeddata', 'canplay', 'loadedmetadata'];
      let eventHandled = false;
      
      events.forEach(eventName => {
        videoPlayer.addEventListener(eventName, () => {
          if (!eventHandled && setVideoTime()) {
            eventHandled = true;
          }
        }, { once: true });
      });
      
      // Fallback timeout
      setTimeout(() => {
        if (!eventHandled) {
          setVideoTime();
        }
      }, 2000);
    }
    
    // Start progress tracking
    startWatchProgressTracking();
  });
  
  // Handle no button
  noBtn.addEventListener('click', () => {
    modal.remove();
    showNotification('▶️ Reproduciendo desde el inicio', 'info', 2000);
    // Start progress tracking without setting time
    startWatchProgressTracking();
  });
  
  // Handle ESC key
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
      // Default to not resuming
      startWatchProgressTracking();
    }
  });
}


async function updateFavoriteColors(titles, contentType) {
  if (!currentUser) return;


  if (showingFavorites) {
    for (const title of titles) {
      const heartIcon = document.getElementById(`heart-icon-${title.id}`);
      if (heartIcon) {
        heartIcon.style.color = 'red';
      }
    }
    return;
  }


  for (const title of titles) {
    try {

      const movieTitle = title.title || title.name;
      const titleType = title.content_type || contentType || 'movie';


      const isFav = await isFavorite(title.id, titleType);
      const heartIcon = document.getElementById(`heart-icon-${title.id}`);

      if (heartIcon) {
        heartIcon.style.color = isFav ? 'red' : 'black';
      }
    } catch (error) {

      const heartIcon = document.getElementById(`heart-icon-${title.id}`);
      if (heartIcon) {
        heartIcon.style.color = 'black';
      }
    }
  }
}



async function updateFavoriteColors_OPTIMIZED(titles, contentType) {
  if (!currentUser) return;


  if (showingFavorites) {
    for (const title of titles) {
      const heartIcon = document.getElementById(`heart-icon-${title.id}`);
      if (heartIcon) {
        heartIcon.style.color = 'red';
      }
    }
    return;
  }

  try {

    const userFavorites = await favorites.getAllUserFavorites(currentUser.id);


    const favoritesTitles = new Set(userFavorites.map(fav => fav.movie_title));


    for (const title of titles) {
      const movieTitle = title.title || title.name;
      const heartIcon = document.getElementById(`heart-icon-${title.id}`);

      if (heartIcon) {
        const isFavorite = favoritesTitles.has(movieTitle);
        heartIcon.style.color = isFavorite ? 'red' : 'black';
      }
    }

  } catch (error) {

    for (const title of titles) {
      const heartIcon = document.getElementById(`heart-icon-${title.id}`);
      if (heartIcon) {
        heartIcon.style.color = 'black';
      }
    }
  }
}


updateFavoriteColors = updateFavoriteColors_OPTIMIZED;


function toggleWatched(movieId, type, event) {
  event.stopPropagation();

  if (!currentUser) {
    showNotification("Primero debes iniciar sesión", 'warning');
    return;
  }

  const watchedKey = `${currentUser.id}-watched`;
  let watched = JSON.parse(localStorage.getItem(watchedKey)) || [];
  const watchedIndex = watched.findIndex(item => item.id === movieId && item.type === type);
  
  const movieCard = document.querySelector(`#movie-card-${movieId}`);

  if (watchedIndex !== -1) {

    watched.splice(watchedIndex, 1);
    document.getElementById(`eye-icon-${movieId}`).style.color = 'black';
    movieCard.classList.remove('watched');
  } else {

    watched.push({ id: movieId, type: type });
    document.getElementById(`eye-icon-${movieId}`).style.color = 'blue';
    movieCard.classList.add('watched');
  }


  localStorage.setItem(watchedKey, JSON.stringify(watched));


}



function isWatched(movieId, type) {
  if (!currentUser) return false;
  
  const watchedKey = `${currentUser.id}-watched`;
  let watched = JSON.parse(localStorage.getItem(watchedKey)) || [];
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




let lastScrollTop = 0;

window.addEventListener('scroll', () => {
  // Handle back to top button visibility
  const backToTopBtn = document.getElementById('back-to-top');
  if (backToTopBtn) {
    if (window.scrollY > 300) { // Show button after scrolling down 300px
      backToTopBtn.classList.remove('hidden');
    } else {
      backToTopBtn.classList.add('hidden');
    }
  }
  
  // Handle infinite scroll for regular content (not favorites or continue watching)
  if (showingFavorites || showingContinueWatching) {
    // Don't load more content when showing favorites or continue watching
    return;
  }
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && !isLoading) {
    currentPage++;
    getTitles(currentPage);
  }
  
  lastScrollTop = window.scrollY;
});


async function isFavorite(movieId, type) {
  if (!currentUser) return false;
  
  try {

    let movieTitle = null;
    

    const movieCard = document.querySelector(`[data-id="${movieId}"]`);
    if (movieCard) {
      const titleElement = movieCard.querySelector('h3');
      if (titleElement) {
        movieTitle = titleElement.textContent.trim();
      }
    }
    

    if (!movieTitle) {
      const heartIcon = document.getElementById(`heart-icon-${movieId}`);
      if (heartIcon) {
        const parentCard = heartIcon.closest('.movie-card');
        if (parentCard) {
          const titleElement = parentCard.querySelector('h3');
          if (titleElement) {
            movieTitle = titleElement.textContent.trim();
          }
        }
      }
    }
    
    if (!movieTitle) {
      console.warn('❌ No se pudo obtener el título de la película:', movieId);
      return false;
    }
    

    const result = await favorites.isFavorite(currentUser.id, movieTitle);
    console.log(`🔍 Verificando favorito "${movieTitle}" (ID: ${movieId}):`, result);
    return result;
  } catch (error) {
    console.error('❌ Error checking favorite status:', error);
    return false;
  }
}


async function fetchTVDetails(tvId) {
  try {
    const response = await fetch(`/api/tv/details/${tvId}`);
    if (!response.ok) {
      throw new Error('Error al obtener los detalles de la serie de TV');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching TV details:', error);
    return null;
  }
}



async function loadEnhancedTrailer(id, type, title, dataOriginal) {

  if (type === 'tv' && dataOriginal && dataOriginal.number_of_seasons > 1) {
    await displayTVSeasonTrailers(id, type, title, dataOriginal);
  } else {

    await loadSingleTrailer(id, type, title, dataOriginal);
  }
}


async function loadSingleTrailer(id, type, title, dataOriginal, season = null) {

  elements.modalTrailer.innerHTML = '<div class="trailer-loading"><i class="fas fa-spinner fa-spin"></i> Buscando trailer...</div>';
  
  try {

    let year = null;
    if (dataOriginal) {
      if (type === 'movie') {
        year = dataOriginal.release_date ? new Date(dataOriginal.release_date).getFullYear() : null;
      } else if (type === 'tv') {
        year = dataOriginal.first_air_date ? new Date(dataOriginal.first_air_date).getFullYear() : null;
      }
    }


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

      await displayImageFallback(dataOriginal, title, season);
    }
  } catch (error) {
    console.error('Error loading enhanced trailer:', error);
    await displayImageFallback(dataOriginal, title, season);
  }
}


async function displayTVSeasonTrailers(id, type, title, dataOriginal) {
  const seasons = dataOriginal.seasons || [];
  const regularSeasons = seasons.filter(season => season.season_number > 0);
  
  if (regularSeasons.length === 0) {
    await loadSingleTrailer(id, type, title, dataOriginal);
    return;
  }
  

  let seasonSelector = `
    <div class="tv-trailer-selector">
      <div class="selector-header">
        <h4><i class="fas fa-tv"></i> Trailers</h4>
        <p>Selecciona una temporada:</p>
      </div>
      <div class="season-buttons">
  `;
  

  seasonSelector += `
    <button class="season-btn active" data-season="general" onclick="loadSeasonTrailer('${id}', '${type}', '${title}', null)">
      <i class="fas fa-film"></i>
      <span>General</span>
    </button>
  `;
  

  regularSeasons.slice(0, 8).forEach(season => {
    seasonSelector += `
      <button class="season-btn" data-season="${season.season_number}" onclick="loadSeasonTrailer('${id}', '${type}', '${title}', ${season.season_number})">
        <i class="fas fa-play-circle"></i>
        <span>T${season.season_number}</span>
        <small>${season.episode_count}ep</small>
      </button>
    `;
  });
  

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
  

  await loadSeasonTrailerContent(id, type, title, dataOriginal, null);
}


async function loadSeasonTrailerContent(id, type, title, dataOriginal, season) {
  const container = document.getElementById('selected-trailer-container');
  if (!container) return;
  

  container.innerHTML = '<div class="trailer-loading"><i class="fas fa-spinner fa-spin"></i> Buscando trailer...</div>';
  
  try {

    let year = null;
    if (dataOriginal && dataOriginal.first_air_date) {
      year = new Date(dataOriginal.first_air_date).getFullYear();
    }


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

      await displayImageFallbackInContainer(dataOriginal, title, season, container);
    }
  } catch (error) {
    console.error('Error loading season trailer:', error);
    await displayImageFallbackInContainer(dataOriginal, title, season, container);
  }
}


window.loadSeasonTrailer = async function(id, type, title, season) {

  document.querySelectorAll('.season-btn').forEach(btn => btn.classList.remove('active'));
  const clickedBtn = document.querySelector(`[data-season="${season || 'general'}"]`);
  if (clickedBtn) clickedBtn.classList.add('active');
  

  const dataOriginal = window.currentDataOriginal || null;
  
  await loadSeasonTrailerContent(id, type, title, dataOriginal, season);
}


function displayTrailer(trailerData) {
  const { videoId, source, title, official, fromTMDb, season } = trailerData;
  
  let embedUrl;
  let trailerInfo = '';
  

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
  

  if (official) {
    trailerInfo = '<div class="trailer-info official"><i class="fas fa-check-circle"></i> Trailer Oficial</div>';
  } else if (fromTMDb) {
    trailerInfo = '<div class="trailer-info tmdb"><i class="fas fa-star"></i> De TMDb</div>';
  } else {
    trailerInfo = '<div class="trailer-info external"><i class="fas fa-external-link-alt"></i> Fuente Externa</div>';
  }
  

  if (season) {
    trailerInfo += `<div class="season-info"><i class="fas fa-tv"></i> Temporada ${season}</div>`;
  }
  
  elements.modalTrailer.innerHTML = `
    ${trailerInfo}
    <iframe src="${embedUrl}" frameborder="0" allowfullscreen></iframe>
  `;
}


function displayTrailerInContainer(trailerData, container) {
  const { videoId, source, title, official, fromTMDb, season } = trailerData;
  
  let embedUrl;
  let trailerInfo = '';
  

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
  

  if (official) {
    trailerInfo = '<div class="trailer-info official"><i class="fas fa-check-circle"></i> Trailer Oficial</div>';
  } else if (fromTMDb) {
    trailerInfo = '<div class="trailer-info tmdb"><i class="fas fa-star"></i> De TMDb</div>';
  } else {
    trailerInfo = '<div class="trailer-info external"><i class="fas fa-external-link-alt"></i> Fuente Externa</div>';
  }
  

  if (season) {
    trailerInfo += `<div class="season-info"><i class="fas fa-tv"></i> Temporada ${season}</div>`;
  }
  
  container.innerHTML = `
    ${trailerInfo}
    <iframe src="${embedUrl}" frameborder="0" allowfullscreen></iframe>
  `;
}


async function displayImageFallback(dataOriginal, title, season = null) {
  await displayImageFallbackInContainer(dataOriginal, title, season, elements.modalTrailer);
}


async function displayImageFallbackInContainer(dataOriginal, title, season, container) {
  try {
    const images = [];
    

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


let currentImdbId = null;


function clearModalContent() {

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
  

  const existingSeasonSelect = document.querySelector('.season-episode-selector');
  if (existingSeasonSelect) {
    existingSeasonSelect.remove();
  }
  

  const existingMessages = document.querySelectorAll('.modal .additional-message');
  existingMessages.forEach(msg => msg.remove());
  

  elements.modalTitle.innerHTML = '';
  elements.modalDescription.innerHTML = '';
  elements.modalTrailer.innerHTML = '';
}


async function showDetails(id, type, movieCard) {

  document.getElementById('loading-screen').style.display = 'flex';
  const lottiePlayer = document.querySelector('lottie-player');
  lottiePlayer.stop();
  lottiePlayer.play();


  clearModalContent();


  movieCard.style.pointerEvents = 'none';
  movieCard.classList.add('disabled');

  try {

    const urlOriginal = `/api/titles/details?id=${id}&type=${type}&language=en`;
    const dataOriginal = await fetch(urlOriginal).then(response => response.json());


    currentImdbId = dataOriginal.imdb_id;


    const urlSpanish = `/api/titles/details?id=${id}&type=${type}&language=es`;
    const dataSpanish = await fetch(urlSpanish).then(response => response.json());


    const containsNonLatinChars = (str) => {
      if (!str) return false;

      return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf\uac00-\ud7a3]/.test(str);
    };


    if (dataOriginal.title && !containsNonLatinChars(dataOriginal.title)) {

      originalTitle = dataOriginal.title;
    } else if (dataOriginal.name && !containsNonLatinChars(dataOriginal.name)) {

      originalTitle = dataOriginal.name;
    } else if (dataOriginal.original_title && !containsNonLatinChars(dataOriginal.original_title)) {

      originalTitle = dataOriginal.original_title;
    } else if (dataOriginal.original_name && !containsNonLatinChars(dataOriginal.original_name)) {

      originalTitle = dataOriginal.original_name;
    } else {

      originalTitle = dataOriginal.title || dataOriginal.name || dataOriginal.original_title || dataOriginal.original_name || "No Title";
    }
    spanishTitle = dataSpanish.title || dataSpanish.name || originalTitle;
    originalDescription = dataOriginal.overview || "No description available in English.";
    spanishDescription = dataSpanish.overview || "No hay descripción disponible en español.";

    // Store current content data for streaming progress tracking
    currentContentData = {
      id: parseInt(id),
      title: originalTitle,
      content_type: type,
      season_number: null, // Will be set later if TV show episode is selected
      episode_number: null  // Will be set later if TV show episode is selected
    };
    console.log('📝 Stored content data for tracking:', currentContentData);


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


    elements.modalDescription.innerHTML = `<p id="description-text">${spanishDescription}</p>`;


    const genres = dataOriginal.genres ? dataOriginal.genres.map(genre => genre.name).join(', ') : 'Sin género';


    const providers = await fetchProvider(id, type);
    const providerNames = providers ? providers.join(', ') : 'No disponible';


    let seasons = '';
    let status = '';
    if (type === 'tv') {
      seasons = dataOriginal.number_of_seasons ? `${dataOriginal.number_of_seasons} Temporadas` : 'N/A';
      status = dataOriginal.status === 'Ended' ? 'Finalizada' : 'En emisión';
    }


    const stars = renderStars(dataOriginal.vote_average);


    const movieDetailsHTML = `
      <div class="movie-details">
        <p><strong>Género:</strong> ${genres}</p>
        ${type === 'tv' ? `<p><strong>Temporadas:</strong> ${seasons}</p>` : ''}
        ${type === 'tv' ? `<p><strong>Estado:</strong> ${status}</p>` : ''}
        <p><strong>Plataformas:</strong> ${providerNames}</p>
        <p><strong>Valoración:</strong> ${stars}</p>
      </div>
    `;
    

    elements.modalDescription.insertAdjacentHTML('afterend', movieDetailsHTML);



    window.currentDataOriginal = dataOriginal;
    await loadEnhancedTrailer(id, type, originalTitle, dataOriginal);


    if (type === "movie") {

      await fetchTorrents(originalTitle);
    } else if (type === "tv") {

      const tvDetails = await fetchTVDetails(id);
      if (tvDetails) {

        const containsNonLatinChars = (str) => {
          if (!str) return false;

          return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf\uac00-\ud7a3]/.test(str);
        };
        

        let tvTitle;
        if (dataOriginal.name && !containsNonLatinChars(dataOriginal.name)) {

          tvTitle = dataOriginal.name;
        } else if (dataOriginal.original_name && !containsNonLatinChars(dataOriginal.original_name)) {

          tvTitle = dataOriginal.original_name;
        } else {

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


    elements.modal.classList.remove('hidden');
    elements.modal.style.display = 'block';

  } catch (error) {
    console.error("Error mostrando detalles:", error);
  } finally {
    document.getElementById('loading-screen').style.display = 'none';

    movieCard.style.pointerEvents = 'auto';
    movieCard.classList.remove('disabled');
  }
}


async function fetchProvider(movieId, type) {
  try {
    const response = await fetch(`/api/${type}/${movieId}/watch/providers`);
    if (!response.ok) {
      throw new Error(`Error fetching providers: ${response.statusText}`);
    }

    const data = await response.json();


    const providersAR = data.results?.AR?.flatrate || [];

    if (providersAR.length > 0) {

      return providersAR.map(provider => `${provider.provider_name} (AR)`);
    } else {

      const availableRegions = Object.keys(data.results);
      let otherProviders = [];


      for (const region of availableRegions) {
        const providers = data.results[region]?.flatrate || [];
        if (providers.length > 0) {
          otherProviders = providers.map(provider => `${provider.provider_name} (${region})`);
          break;
        }
      }


      return otherProviders.length > 0 ? otherProviders : ['No disponible'];
    }
  } catch (error) {
    console.error('Error fetching providers:', error);
    return ['Error al obtener proveedores'];
  }
}


function switchLanguage(language) {
  const descriptionText = document.getElementById('description-text');
  const translatedTitle = document.getElementById('translated-title');
  const languageOptions = document.querySelectorAll('.language-option');
  const languageSlider = document.querySelector('.language-slider');
  

  languageOptions.forEach(option => option.classList.remove('active'));
  

  const selectedOption = document.querySelector(`[data-lang="${language}"]`);
  selectedOption.classList.add('active');
  

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


function toggleDescriptionLanguage() {
  const descriptionText = document.getElementById('description-text');
  const translatedTitle = document.getElementById('translated-title');
  const toggleLanguage = document.getElementById('toggle-language');

  if (!toggleLanguage.checked) {

    descriptionText.textContent = spanishDescription;
    translatedTitle.textContent = `(${spanishTitle})`;
  } else {

    descriptionText.textContent = originalDescription;
    translatedTitle.textContent = "";
  }
}




function renderStars(voteAverage) {
  const starCount = Math.round(voteAverage / 2);
  let stars = '';


  for (let i = 0; i < starCount; i++) {
    stars += '<i class="fas fa-star"></i>';
  }


  for (let i = starCount; i < 5; i++) {
    stars += '<i class="far fa-star"></i>';
  }

  return stars;
}


async function fetchTorrents(movieTitle) {
  try {
    const response = await fetch(`/api/torrents?movieTitle=${encodeURIComponent(movieTitle)}`);

    if (!response.ok) {

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

      let allTorrents = [];
      

      if (data[0] && data[0].title && data[0].magnet) {

        allTorrents = data.map(torrent => ({
          ...torrent,
          title: torrent.title || movieTitle
        }));
      } else {

        data.forEach(movie => {
          if (movie.torrents && movie.torrents.length > 0) {
            movie.torrents.forEach(torrent => {
              allTorrents.push({
                ...torrent,
                title: movie.title
              });
            });
          }
        });
      }

      if (allTorrents.length > 0) {

        const hasDemo = allTorrents.some(torrent => torrent.isDemo);
        
        allTorrents.sort((a, b) => {
          const qualityOrder = ["4K", "1080p", "720p", "DVDRip", "WEB-DL", "SD"];
          return qualityOrder.indexOf(a.quality) - qualityOrder.indexOf(b.quality);
        });
        
        let torrentButtons = `
          <div class="torrent-quote">
            <h3>Torrents disponibles</h3>`;
        

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


async function fetchTVTorrents(tvTitle, tvDetails) {
  try {

    const seasonSelect = createSeasonEpisodeSelector(tvDetails);
    
    elements.modalTrailer.insertAdjacentHTML("afterend", seasonSelect);
    

    const seasonSelector = document.getElementById('season-selector');
    const episodeSelector = document.getElementById('episode-selector');
    const searchTorrentsBtn = document.getElementById('search-torrents-btn');
    const torrentResultsContainer = document.getElementById('torrent-results');
    

    seasonSelector.addEventListener('change', function() {
      updateEpisodeSelector(tvDetails, this.value);
    });
    

    searchTorrentsBtn.addEventListener('click', async function() {
      const selectedSeason = seasonSelector.value;
      const selectedEpisode = episodeSelector.value;
      
      if (!selectedSeason) {
        alert('Por favor selecciona una temporada');
        return;
      }
      

      torrentResultsContainer.innerHTML = '<div class="loading-torrents">🔍 Buscando torrents...</div>';
      
      await searchTVTorrents(tvTitle, selectedSeason, selectedEpisode, torrentResultsContainer);
    });
    

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


function createSeasonEpisodeSelector(tvDetails) {
  const seasons = tvDetails.seasons || [];
  let seasonOptions = '<option value="">Selecciona una temporada</option>';
  
  seasons.forEach(season => {
    if (season.season_number > 0) {
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


function updateEpisodeSelector(tvDetails, seasonNumber) {
  const episodeSelector = document.getElementById('episode-selector');
  const selectedSeason = tvDetails.seasons.find(s => s.season_number == seasonNumber);
  
  if (!selectedSeason) {
    episodeSelector.innerHTML = '<option value="">Temporada no encontrada</option>';
    return;
  }
  
  let episodeOptions = '<option value="">Temporada completa</option>';
  

  for (let i = 1; i <= selectedSeason.episode_count; i++) {
    episodeOptions += `<option value="${i}">Episodio ${i}</option>`;
  }
  
  episodeSelector.innerHTML = episodeOptions;
}


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
      displayTVTorrents(torrents, resultsContainer, tvTitle, season, episode);
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


function displayTVTorrents(torrents, container, tvTitle, season, episode) {

  const hasDemo = torrents.some(torrent => torrent.isDemo);
  
  let torrentButtons = `
    <div class="torrent-quote">
      <h4>Torrents encontrados</h4>`;
  

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
          <button class="action-button watch-online" onclick="event.stopPropagation(); watchTVEpisodeOnline('${escapedMagnetLink}', '${escapedTorrentTitle}', ${season}, ${episode || 'null'})">
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


function checkCodecSupport() {
  const video = document.createElement('video');
  const codecSupport = {
    h264: video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '',
    h265: video.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"') !== '',
    vp9: video.canPlayType('video/webm; codecs="vp9"') !== '',
    av1: video.canPlayType('video/mp4; codecs="av01.0.05M.08"') !== '',

    aac: video.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== '',
    mp3: video.canPlayType('audio/mpeg') !== '',
    opus: video.canPlayType('audio/webm; codecs="opus"') !== '',
    vorbis: video.canPlayType('audio/webm; codecs="vorbis"') !== '',
    flac: video.canPlayType('audio/flac') !== '',
    dts: video.canPlayType('audio/mp4; codecs="dts"') === '',
    ac3: video.canPlayType('audio/mp4; codecs="ac-3"') === '',
  };
  
  console.log('Codec support:', codecSupport);
  return codecSupport;
}


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
  

  const playerContainer = document.getElementById('video-player-container');
  if (playerContainer) {

    const existingTroubleshooting = playerContainer.querySelector('.audio-troubleshooting');
    if (!existingTroubleshooting) {
      const troubleshootingDiv = document.createElement('div');
      troubleshootingDiv.className = 'audio-troubleshooting';
      troubleshootingDiv.innerHTML = troubleshootingMessage;
      playerContainer.appendChild(troubleshootingDiv);
    }
  }
}


function startPlayer(magnetLink, movieTitle) {
  const playerContainer = document.getElementById('video-player-container');
  const videoPlayer = document.getElementById('video-player');
  const torrentQuote = document.querySelector('.torrent-quote');
  const loadingIndicator = document.getElementById('player-loading-indicator');
  const torrentStatsDiv = document.getElementById('torrent-stats');
  const torrentPeersSpan = document.getElementById('torrent-peers');
  const torrentProgressSpan = document.getElementById('torrent-progress');
  const torrentDownloadSpeedSpan = document.getElementById('torrent-download-speed');
  const playerStatusMessage = document.getElementById('player-status-message');
  const playerLoadingIndicator = document.getElementById('player-loading-indicator');
  const localSubtitleUploadContainer = document.getElementById('local-subtitle-upload-container');
  const subtitleUploadInput = document.getElementById('subtitle-upload-input');


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


  const videoModal = document.getElementById('video-modal');
  if (videoModal) {
    videoModal.classList.remove('hidden');
    videoModal.style.display = 'block';
  } else {
    showNotification('Error: No se encontró el modal de video', 'error');
    console.error('video-modal element not found');
    return;
  }


  if (playerLoadingIndicator) {
    playerLoadingIndicator.textContent = 'Fetching torrent metadata...';
    playerLoadingIndicator.style.display = 'block';
  }
  if (playerStatusMessage) {
    playerStatusMessage.style.display = 'none';
  }
  if (localSubtitleUploadContainer) {
      localSubtitleUploadContainer.style.display = 'none';
  }
  if (torrentStatsDiv) {
    torrentStatsDiv.style.display = 'none';
  }

  if (torrentQuote) {
    torrentQuote.style.display = 'none';
  }
  

  const client = new WebTorrent();
  window.currentTorrentClient = client;


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
    

    torrent.on('error', (err) => {
      console.error('Torrent error:', err);
      showNotification('Error del torrent: ' + err.message, 'error');
      if (playerLoadingIndicator) playerLoadingIndicator.style.display = 'none';
      if (playerStatusMessage) {
        playerStatusMessage.textContent = 'Error del torrent';
        playerStatusMessage.style.display = 'block';
      }
    });

    if (playerLoadingIndicator) {
      playerLoadingIndicator.textContent = 'Video loading...';
    }    if (torrentStatsDiv) {
      torrentStatsDiv.style.display = 'block';
    }
    

    if (torrentPeersSpan) {
      torrentPeersSpan.textContent = `Peers: ${torrent.numPeers}`;
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

    const STALL_TIMEOUT_DURATION = 60000;
    if (stallTimeoutId) clearTimeout(stallTimeoutId);
    stallTimeoutId = setTimeout(() => {
        const currentVideoPlayer = document.getElementById('video-player');
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


    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv'];
    let videoFiles = torrent.files.filter(f => {
        return videoExtensions.some(ext => f.name.toLowerCase().endsWith(ext));
    });    if (videoFiles.length === 0) {
        clearTimeout(stallTimeoutId);
        if (playerLoadingIndicator) playerLoadingIndicator.style.display = 'none';
        if (playerStatusMessage) {
            playerStatusMessage.textContent = 'No video files found in this torrent.';
            playerStatusMessage.style.display = 'block';
        }
        if (torrentStatsDiv) torrentStatsDiv.style.display = 'none';
        showNotification('No se encontraron archivos de video en este torrent', 'error');
        return;
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





    }    if (!selectedFile) {
        clearTimeout(stallTimeoutId);
        if (playerLoadingIndicator) playerLoadingIndicator.style.display = 'none';
        if (playerStatusMessage) {
            playerStatusMessage.textContent = 'Could not select a video file.';
            playerStatusMessage.style.display = 'block';
        }
        if (torrentStatsDiv) torrentStatsDiv.style.display = 'none';
        showNotification('No se pudo seleccionar un archivo de video', 'error');
        return;
    }



    const oldSources = videoPlayer.getElementsByTagName('source');
    while (oldSources.length > 0) {
        videoPlayer.removeChild(oldSources[0]);
    }
    const oldTracks = videoPlayer.getElementsByTagName('track');
    while (oldTracks.length > 0) {
        videoPlayer.removeChild(oldTracks[0]);
    }
    videoPlayer.src = '';
    videoPlayer.load();


    const videoFileNameWithoutExt = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) || selectedFile.name;
    const subtitleExtensions = ['.srt', '.vtt'];

    torrent.files.forEach(torrentFile => {
        const fileExtension = torrentFile.name.substring(torrentFile.name.lastIndexOf('.')).toLowerCase();
        const fileNameWithoutExt = torrentFile.name.substring(0, torrentFile.name.lastIndexOf('.')) || torrentFile.name;

        if (subtitleExtensions.includes(fileExtension) && fileNameWithoutExt.toLowerCase().startsWith(videoFileNameWithoutExt.toLowerCase())) {

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


        videoPlayer.muted = false;
        videoPlayer.volume = 1.0;
        videoPlayer.autoplay = false;
        videoPlayer.preload = 'metadata';


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


        function detectAudioIssues() {

            const codecSupport = checkCodecSupport();
            

            setTimeout(() => {
                if (videoPlayer.audioTracks && videoPlayer.audioTracks.length === 0) {
                    console.warn('No audio tracks detected in video file');
                    showNotification('⚠️ No se detectaron pistas de audio en este archivo', 'warning', 5000);
                    showAudioTroubleshooting();
                }
                

                if (selectedFile.name.toLowerCase().endsWith('.mkv')) {
                    console.log('MKV file detected, checking audio compatibility...');
                    showNotification('📁 Archivo MKV detectado. Si no hay audio, podría ser un problema de códec.', 'info', 6000);
                    

                    setTimeout(() => {
                        if (videoPlayer.muted || videoPlayer.volume === 0) {
                            showAudioTroubleshooting();
                        }
                    }, 3000);
                    

                    try {

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
                

                setTimeout(() => {
                    if (videoPlayer.currentTime > 0 && !videoPlayer.paused && videoPlayer.volume > 0 && !videoPlayer.muted) {

                        console.log('Video playing, checking for actual audio output...');
                    }
                }, 5000);
            }, 1000);
        }

        videoPlayer.oncanplay = () => {
            if (playerLoadingIndicator) playerLoadingIndicator.style.display = 'none';
            if (playerStatusMessage) playerStatusMessage.style.display = 'none';
            if (localSubtitleUploadContainer) {
                localSubtitleUploadContainer.style.display = 'block';
            }
            

            ensureAudioEnabled();
            detectAudioIssues();
        };

        videoPlayer.onplaying = () => {
            clearTimeout(stallTimeoutId);
            if (playerLoadingIndicator) playerLoadingIndicator.style.display = 'none';
            if (playerStatusMessage) playerStatusMessage.style.display = 'none';
            

            ensureAudioEnabled();
        };


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


        videoPlayer.onvolumchange = () => {
            if (videoPlayer.muted) {
                console.log('Video was muted by user or system');

                setTimeout(() => {
                    if (videoPlayer.muted) {
                        showNotification('🔇 El audio está desactivado. Haz clic en el botón de volumen para activarlo.', 'info', 5000);
                    }
                }, 500);
            }
        };
    });

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
      torrentStatsDiv.style.display = 'none';
    }



  });

  if (subtitleUploadInput) {
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



async function closeModal() {
  elements.modal.classList.add('hidden');
  elements.modal.style.display = "none";
  elements.modalTrailer.innerHTML = "";

  // Clear current content data
  currentContentData = null;
  console.log('🧹 Cleared content data on modal close');

  if (stallTimeoutId) {
    clearTimeout(stallTimeoutId);
    stallTimeoutId = null;
  }


  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }


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


  currentTorrentInfo = null;
}


let searchTimeout;
document.getElementById("search-bar").addEventListener("input", (e) => {

  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  const searchQuery = e.target.value.trim();
  

  updateClearButtonVisibility();
  

  if (searchQuery === '') {
    hideSearchResultsInfo();
    
    // Show trending sections when search is cleared
    toggleTrendingSectionsVisibility(false);
    
    currentPage = 1;
    animateMovieGrid();
    getTitles(currentPage);
    return;
  }
  
  // Hide trending sections when searching
  toggleTrendingSectionsVisibility(true);

  searchTimeout = setTimeout(() => {
    currentPage = 1;
    animateMovieGrid();
    getTitles(currentPage);
  }, 300);
});


function applyFilters() {
  currentPage = 1;
  elements.movieGrid.innerHTML = '';
  updateClearButtonVisibility();
  getTitles(currentPage);
}


const btcButton = document.getElementById('btc-button');


btcButton.addEventListener('click', function () {

  const btcAddress = btcButton.getAttribute('data-btc-address');


  const tempInput = document.createElement('input');
  tempInput.value = btcAddress;
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand('copy');
  document.body.removeChild(tempInput);


  const originalText = btcButton.innerHTML;
  btcButton.innerHTML = '<i class="fab fa-bitcoin"></i> Address copied!';


  setTimeout(() => {
    btcButton.innerHTML = originalText;
  }, 2000);
});




function showLoginModal() {
  document.getElementById('modal-title').textContent = 'Iniciar Sesión';
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('switch-text').innerHTML = '¿No tienes cuenta? <a href="#" id="switch-to-register">Regístrate aquí</a>';
  document.getElementById('switch-to-register').addEventListener('click', switchToRegister);
  document.getElementById('auth-modal').classList.remove('hidden');
}


function showRegisterModal() {
  document.getElementById('modal-title').textContent = 'Registrarse';
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.remove('hidden');
  document.getElementById('switch-text').innerHTML = '¿Ya tienes cuenta? <a href="#" id="switch-to-login">Inicia sesión aquí</a>';
  document.getElementById('switch-to-login').addEventListener('click', switchToLogin);
  document.getElementById('auth-modal').classList.remove('hidden');
}


function switchToRegister(e) {
  e.preventDefault();
  showRegisterModal();
}


function switchToLogin(e) {
  e.preventDefault();
  showLoginModal();
}


function hideAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');

  document.getElementById('login-form').reset();
  document.getElementById('register-form').reset();
}


async function handleLogin(e) {
  e.preventDefault();
  
  if (!auth) {
    showNotification('Supabase no está configurado', 'error');
    return;
  }
  
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  if (!email || !password) {
    showNotification('Por favor completa todos los campos', 'error');
    return;
  }
  
  try {
    const result = await auth.signIn(email, password);
    
    if (result.success) {
      showNotification('¡Bienvenido! Has iniciado sesión correctamente', 'success');
      hideAuthModal();
      updateAuthUI(result.data.user);
    } else {
      showNotification(result.error || 'Error al iniciar sesión', 'error');
    }
  } catch (error) {
    showNotification('Error al iniciar sesión: ' + error.message, 'error');
  }
}


async function handleRegister(e) {
  e.preventDefault();
  
  if (!auth) {
    showNotification('Supabase no está configurado', 'error');
    return;
  }
  
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
    const result = await auth.signUp(email, password);
    
    if (result.success) {
      showNotification('¡Registro exitoso! Revisa tu email para confirmar tu cuenta', 'success');
      hideAuthModal();

      if (result.data.user && !result.data.user.email_confirmed_at) {
        showNotification('Por favor confirma tu email antes de continuar', 'warning');
      }
    } else {
      showNotification(result.error || 'Error al registrarse', 'error');
    }
  } catch (error) {
    showNotification('Error al registrarse: ' + error.message, 'error');
  }
}


async function handleLogout() {
  try {
    const result = await auth.signOut();
    
    if (result.success) {
      showNotification('Has cerrado sesión correctamente', 'success');
      updateAuthUI(null);
    } else {
      showNotification('Error al cerrar sesión', 'error');
    }
  } catch (error) {
    showNotification('Error al cerrar sesión: ' + error.message, 'error');
  }
}


function updateAuthUI(user) {
  currentUser = user;
  
  const authButtons = document.getElementById('auth-buttons');
  const loginBtn = document.getElementById('login-btn');
  const registerBtn = document.getElementById('register-btn');
  const userInfo = document.getElementById('user-info');
  const logoutBtn = document.getElementById('logout-btn');
  const userEmail = document.getElementById('user-email');
  const favoriteFilterGroup = document.getElementById('favorite-filter-group');
  
  if (user) {

    if (loginBtn) loginBtn.style.display = 'none';
    if (registerBtn) registerBtn.style.display = 'none';
    if (authButtons) authButtons.classList.add('hidden');
    if (userInfo) userInfo.classList.remove('hidden');
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
    if (userEmail) userEmail.textContent = user.email;
    

    if (favoriteFilterGroup) {
      favoriteFilterGroup.style.display = 'flex';
    }
    

    preloadUserFavorites();
    
    // Load continue watching section
    loadContinueWatchingSection();
    
    // Reset continue watching mode when user logs in
    showingContinueWatching = false;
    

    getTitles();
  } else {

    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (registerBtn) registerBtn.style.display = 'inline-flex';
    if (authButtons) authButtons.classList.remove('hidden');
    if (userInfo) userInfo.classList.add('hidden');
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (userEmail) userEmail.textContent = '';
    

    if (favoriteFilterGroup) {
      favoriteFilterGroup.style.display = 'none';
    }
    
    // Hide continue watching section
    hideContinueWatchingSection();
  }
}


async function initAuth() {

  await initSupabase();
  
  if (!auth) {
    console.warn('⚠️ Supabase no disponible, funcionando en modo limitado');
    updateAuthUI(null);
    return;
  }
  
  try {
    const user = await auth.getCurrentUser();
    updateAuthUI(user);
    

    auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        updateAuthUI(session.user);
      } else if (event === 'SIGNED_OUT') {
        updateAuthUI(null);
      }
    });
  } catch (error) {
    console.error('Error inicializando autenticación:', error);
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



let favoritesCache = new Map();
let lastFavoritesCacheUpdate = 0;
const FAVORITES_CACHE_DURATION = 30000;


let favoriteOperationsInProgress = new Set();
let lastFavoriteClickTime = 0;
const FAVORITE_CLICK_DEBOUNCE = 300;


async function toggleFavorite(movieId, type, event) {

  event.stopPropagation();


  const now = Date.now();
  if (now - lastFavoriteClickTime < FAVORITE_CLICK_DEBOUNCE) {
    return;
  }
  lastFavoriteClickTime = now;

  if (!currentUser) {
    showNotification("Primero debes iniciar sesión", 'warning');
    return;
  }


  const operationKey = `${movieId}-${type}`;
  if (favoriteOperationsInProgress.has(operationKey)) {
    return;
  }

  favoriteOperationsInProgress.add(operationKey);

  try {

    const heartIcon = document.getElementById(`heart-icon-${movieId}`);
    if (!heartIcon) {
      favoriteOperationsInProgress.delete(operationKey);
      return;
    }


    heartIcon.style.pointerEvents = 'none';
    heartIcon.style.opacity = '0.6';
    heartIcon.classList.add('fa-pulse');


    const movieCard = event.target.closest('.movie-card');
    const movieTitle = movieCard?.querySelector('h3')?.textContent || `Movie ${movieId}`;
    const movieImage = movieCard?.querySelector('img')?.src || '';
    
    const movieData = {
      id: movieId,
      title: movieTitle,
      type: type,
      image: movieImage
    };


    const currentIsFavorite = await isFavoriteOptimized(currentUser.id, movieTitle);
    
    let result;
    if (currentIsFavorite) {

      heartIcon.style.color = 'black';
      

      result = await favorites.removeFavorite(currentUser.id, movieTitle);
      
      if (result.success) {

        favoritesCache.delete(movieTitle);
        showNotification('Eliminado de favoritos', 'success');
      } else {

        heartIcon.style.color = 'red';
        throw new Error(result.error || 'Error al eliminar favorito');
      }
    } else {

      heartIcon.style.color = 'red';
      

      result = await favorites.addFavorite(currentUser.id, movieData);
      
      if (result.success) {

        favoritesCache.set(movieTitle, true);
        showNotification('Agregado a favoritos', 'success');
      } else {

        heartIcon.style.color = 'black';
        throw new Error(result.error || 'Error al agregar favorito');
      }
    }


    if (showingFavorites) {
      setTimeout(() => loadFavorites(), 500);
    }

  } catch (error) {
    console.error('Error toggleFavorite:', error);
    

    if (error.message && error.message.includes('autenticado')) {
      showNotification('Sesión expirada. Por favor, inicia sesión nuevamente', 'warning');
      updateAuthUI(null);
    } else {
      showNotification('Error al actualizar favoritos', 'error');
    }
  } finally {

    const heartIcon = document.getElementById(`heart-icon-${movieId}`);
    if (heartIcon) {
      heartIcon.style.pointerEvents = 'auto';
      heartIcon.style.opacity = '1';
      heartIcon.classList.remove('fa-pulse');
    }
    
    favoriteOperationsInProgress.delete(operationKey);
  }
}


async function isFavoriteOptimized(userId, movieTitle) {

  const now = Date.now();
  if (now - lastFavoritesCacheUpdate < FAVORITES_CACHE_DURATION && favoritesCache.has(movieTitle)) {
    return favoritesCache.get(movieTitle);
  }


  try {
    const result = await favorites.isFavorite(userId, movieTitle);
    favoritesCache.set(movieTitle, result);
    return result;
  } catch (error) {
    console.error('Error checking favorite status:', error);
    return false;
  }
}


async function preloadUserFavorites() {
  if (!currentUser) return;
  
  try {
    console.log('🚀 Precargando favoritos del usuario...');
    const result = await favorites.getFavorites(currentUser.id);
    
    if (result.success) {

      favoritesCache.clear();
      result.data.forEach(favorite => {
        favoritesCache.set(favorite.movie_title, true);
      });
      lastFavoritesCacheUpdate = Date.now();
      
      console.log(`✅ ${result.data.length} favoritos precargados en cache`);
    }
  } catch (error) {
    console.error('Error precargando favoritos:', error);
  }
}


async function loadFavorites() {
  if (!currentUser) return;

  try {
    const result = await favorites.getFavorites(currentUser.id);
    
    if (result.success) {
      const userFavorites = result.data;
      

      favoritesCache.clear();
      userFavorites.forEach(favorite => {
        favoritesCache.set(favorite.movie_title, true);
      });
      lastFavoritesCacheUpdate = Date.now();
      


      requestAnimationFrame(() => {
        userFavorites.forEach(favorite => {
          const heartIcon = document.getElementById(`heart-icon-${favorite.movie_data.id}`);
          if (heartIcon) {
            heartIcon.style.color = 'red';
          }
        });
      });
    }
  } catch (error) {
    console.error('Error loading favorites:', error);
  }
}


function toggleFavoritesFilter() {
  showingFavorites = !showingFavorites;
  
  // If enabling favorites, disable continue watching
  if (showingFavorites) {
    showingContinueWatching = false;
    updateContinueWatchingChip();
  }
  
  console.log(`🔄 Toggle favoritos: ${showingFavorites ? 'ACTIVADO' : 'DESACTIVADO'}`);
  updateFavoritesChip();
  updateClearButtonVisibility();
  getTitles();
}

function updateContinueWatchingChip() {
  const continueWatchingChip = document.querySelector('.continue-watching-chip');
  const continueWatchingCheckbox = document.getElementById('continue-watching-checkbox');
  
  if (continueWatchingChip && continueWatchingCheckbox) {
    if (continueWatchingCheckbox.checked) {
      continueWatchingChip.classList.add('active');
    } else {
      continueWatchingChip.classList.remove('active');
    }
  }
}

// ===== NUEVAS FUNCIONES PARA SECCIÓN CONTINUAR VIENDO =====

// Function to load and display continue watching section
async function loadContinueWatchingSection() {
  const continueWatchingSection = document.getElementById('continue-watching-section');
  const continueWatchingGrid = document.getElementById('continue-watching-grid');
  
  if (!continueWatchingSection || !continueWatchingGrid) {
    return;
  }

  // Check if user is logged in
  if (!currentUser) {
    continueWatchingSection.classList.add('hidden');
    return;
  }

  try {
    const token = await getAuthToken();
    if (!token) {
      continueWatchingSection.classList.add('hidden');
      return;
    }

    // Fetch recent watch progress
    const response = await fetch(`/api/watch-progress?limit=10`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Error al cargar el progreso de visualización');
    }

    const watchProgress = await response.json();

    if (watchProgress.length === 0) {
      continueWatchingSection.classList.add('hidden');
      return;
    }

    // Show section and populate grid
    continueWatchingSection.classList.remove('hidden');
    continueWatchingGrid.innerHTML = '';

    // Create items for continue watching
    for (let progress of watchProgress.slice(0, 10)) { // Limit to 10 items for horizontal scroll
      const item = await createContinueWatchingItem(progress);
      if (item) {
        continueWatchingGrid.appendChild(item);
      }
    }

    // Add event listeners
    setupContinueWatchingEvents();
    
    // Only update button state if we're not in the middle of a toggle operation
    // This prevents loadContinueWatchingSection from overriding button state during collapse
    const seeAllBtn = document.getElementById('continue-watching-see-all');
    if (seeAllBtn && !seeAllBtn.classList.contains('transitioning')) {
      if (showingContinueWatching) {
        seeAllBtn.innerHTML = `
          Mostrar menos
          <i class="fas fa-chevron-up"></i>
        `;
        seeAllBtn.classList.add('active');
      } else {
        seeAllBtn.innerHTML = `
          Ver todo
          <i class="fas fa-chevron-down"></i>
        `;
        seeAllBtn.classList.remove('active');
      }
    }

  } catch (error) {
    console.error('Error loading continue watching section:', error);
    continueWatchingSection.classList.add('hidden');
  }
}

// Function to create a continue watching item
async function createContinueWatchingItem(progressData) {
  try {
    // Fetch detailed info from TMDb for the item
    const detailsResponse = await fetch(`/api/titles/details?id=${progressData.tmdb_id}&type=${progressData.content_type}&language=en`);
    let movieDetails = null;
    
    if (detailsResponse.ok) {
      movieDetails = await detailsResponse.json();
    }

    const title = movieDetails?.title || movieDetails?.name || progressData.title;
    const posterPath = movieDetails?.poster_path;
    const progressPercent = progressData.progress_percentage || 0;
    const resumeTime = formatTime(progressData.playback_position);
    
    // Create episode info for TV shows
    let episodeInfo = '';
    if (progressData.content_type === 'tv' && progressData.season_number && progressData.episode_number) {
      episodeInfo = `T${progressData.season_number}:E${progressData.episode_number}`;
    }

    // Create the item element
    const item = document.createElement('div');
    item.className = 'continue-watching-item';
    item.setAttribute('data-id', progressData.tmdb_id);
    item.setAttribute('data-type', progressData.content_type);
    
    item.innerHTML = `
      <div class="poster-container">
        <img src="https://image.tmdb.org/t/p/w500${posterPath}" alt="${title}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDMwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDUwIiBmaWxsPSIjMzMzIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMjI1IiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiPkltYWdlbiBubyBkaXNwb25pYmxlPC90ZXh0Pgo8L3N2Zz4='">
        <div class="content-type-badge ${progressData.content_type}">
          ${progressData.content_type === 'movie' ? 'Película' : 'Serie'}
        </div>
        <div class="progress-overlay">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${Math.min(progressPercent, 100)}%"></div>
          </div>
          <div class="progress-text">
            <span>${Math.round(progressPercent)}%</span>
            <span>${resumeTime}</span>
          </div>
        </div>
      </div>
      <div class="content-info">
        <div class="title">${title}</div>
        ${episodeInfo ? `<div class="subtitle">${episodeInfo}</div>` : ''}
        <div class="resume-info">
          <i class="fas fa-play"></i>
          <span>Continuar viendo</span>
        </div>
      </div>
    `;

    // Add click event to resume playback
    item.addEventListener('click', () => {
      const movieData = {
        id: progressData.tmdb_id,
        title: title,
        content_type: progressData.content_type,
        watch_progress: {
          playback_position: progressData.playback_position,
          total_duration: progressData.total_duration,
          progress_percentage: progressData.progress_percentage,
          last_watched: progressData.last_watched,
          season_number: progressData.season_number,
          episode_number: progressData.episode_number,
          torrent_hash: progressData.torrent_hash,
          torrent_file_name: progressData.torrent_file_name,
          torrent_magnet_uri: progressData.torrent_magnet_uri
        }
      };
      
      // Resume playback automatically
      resumeFromProgress(movieData, true);
    });

    return item;

  } catch (error) {
    console.error('Error creando elemento de continuar viendo:', error);
    return null;
  }
}

// Function to setup events for continue watching section
function setupContinueWatchingEvents() {
  const seeAllBtn = document.getElementById('continue-watching-see-all');
  
  if (seeAllBtn) {
    // Remove any existing event listeners
    seeAllBtn.replaceWith(seeAllBtn.cloneNode(true));
    const newSeeAllBtn = document.getElementById('continue-watching-see-all');
    
    newSeeAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Prevent double clicks
      if (newSeeAllBtn.classList.contains('processing')) {
        return;
      }
      
      newSeeAllBtn.classList.add('processing');
      
      console.log('🔄 Toggle continue watching. Current state:', showingContinueWatching);
      
      // Show all continue watching items in expanded section
      showAllContinueWatching();
      
      // Remove processing class after a short delay
      setTimeout(() => {
        newSeeAllBtn.classList.remove('processing');
      }, 300);
    });
  }
}

// Function to show all continue watching items in expanded section below
function showAllContinueWatching() {
  const seeAllBtn = document.getElementById('continue-watching-see-all');
  
  console.log('🎬 showAllContinueWatching called. Current showingContinueWatching:', showingContinueWatching);
  
  if (showingContinueWatching) {
    console.log('📤 Collapsing expanded view...');
    // Currently expanded, so collapse back to horizontal view
    showingContinueWatching = false;
    
    // Add transitioning class to prevent state override
    if (seeAllBtn) {
      seeAllBtn.classList.add('transitioning');
    }
    
    // Remove expanded section and separator
    const expandedSection = document.getElementById('continue-watching-expanded');
    const separator = document.getElementById('content-separator');
    if (expandedSection) {
      expandedSection.remove();
      console.log('✅ Removed expanded section');
    }
    if (separator) {
      separator.remove();
      console.log('✅ Removed separator');
    }
    
    // Update button text and style
    if (seeAllBtn) {
      seeAllBtn.innerHTML = `
        Ver todo
        <i class="fas fa-chevron-down"></i>
      `;
      seeAllBtn.classList.remove('active');
      console.log('✅ Button updated to "Ver todo"');
      
      // Remove transitioning class after a short delay
      setTimeout(() => {
        seeAllBtn.classList.remove('transitioning');
      }, 100);
    }
    
  } else {
    console.log('📥 Expanding to show all...');
    // Currently in horizontal view, so expand below
    showingContinueWatching = true;
    
    // Update button text and style
    if (seeAllBtn) {
      seeAllBtn.innerHTML = `
        Mostrar menos
        <i class="fas fa-chevron-up"></i>
      `;
      seeAllBtn.classList.add('active');
      console.log('✅ Button updated to "Mostrar menos"');
    }
    
    // Create expanded section below
    createExpandedContinueWatchingSection();
  }
  
  console.log('🎬 showAllContinueWatching finished. New showingContinueWatching:', showingContinueWatching);
}

// Function to hide continue watching section
function hideContinueWatchingSection() {
  const continueWatchingSection = document.getElementById('continue-watching-section');
  if (continueWatchingSection) {
    continueWatchingSection.classList.add('hidden');
  }
}

// Function to create expanded continue watching section below the horizontal one
async function createExpandedContinueWatchingSection() {
  try {
    if (!currentUser) return;

    // Remove existing expanded section if it exists
    const existingExpanded = document.getElementById('continue-watching-expanded');
    const existingSeparator = document.getElementById('content-separator');
    if (existingExpanded) existingExpanded.remove();
    if (existingSeparator) existingSeparator.remove();

    // Get continue watching data
    const token = await getAuthToken();
    const response = await fetch('/api/watch-progress', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) return;

    const watchProgressData = await response.json();
    if (!watchProgressData || watchProgressData.length === 0) return;

    // Create content separator
    const continueWatchingSection = document.getElementById('continue-watching-section');
    const separator = document.createElement('div');
    separator.id = 'content-separator';
    separator.innerHTML = `
      <div class="separator-line"></div>
      <div class="separator-text">
        <i class="fas fa-grip-lines"></i>
        <span>Más contenido disponible</span>
        <i class="fas fa-grip-lines"></i>
      </div>
      <div class="separator-line"></div>
    `;
    
    // Insert separator after continue watching section
    continueWatchingSection.insertAdjacentElement('afterend', separator);

    // Create expanded section
    const expandedSection = document.createElement('div');
    expandedSection.id = 'continue-watching-expanded';
    expandedSection.innerHTML = `
      <div class="expanded-header">
        <h3><i class="fas fa-play-circle"></i> Todo tu contenido para continuar viendo</h3>
        <p>Selecciona cualquier título para continuar desde donde lo dejaste</p>
      </div>
      <div class="expanded-grid" id="expanded-continue-grid"></div>
    `;
    
    // Insert expanded section after separator
    separator.insertAdjacentElement('afterend', expandedSection);

    // Populate expanded grid with all continue watching items
    const expandedGrid = document.getElementById('expanded-continue-grid');
    
    for (const progressItem of watchProgressData) {
      const itemElement = await createExpandedContinueWatchingItem(progressItem);
      if (itemElement) {
        expandedGrid.appendChild(itemElement);
      }
    }

    // Smooth scroll to show the expanded section
    setTimeout(() => {
      separator.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }, 100);

  } catch (error) {
    console.error('Error creating expanded continue watching section:', error);
  }
}

// Function to create individual items for expanded continue watching section
async function createExpandedContinueWatchingItem(progressItem) {
  try {
    // Fetch movie/TV details
    const detailsResponse = await fetch(`/api/titles/details?id=${progressItem.tmdb_id}&type=${progressItem.content_type}&language=es`);
    if (!detailsResponse.ok) return null;
    
    const details = await detailsResponse.json();
    const title = details.title || details.name || 'Título desconocido';
    
    // Calculate progress percentage
    const progressPercent = progressItem.progress_percentage || 0;
    const resumeTime = formatTime(progressItem.playback_position);
    
    // Episode info for TV shows
    let episodeInfo = '';
    if (progressItem.content_type === 'tv' && progressItem.season_number && progressItem.episode_number) {
      episodeInfo = `T${progressItem.season_number}E${progressItem.episode_number}`;
    }
    
    // Create item element
    const itemElement = document.createElement('div');
    itemElement.className = 'expanded-continue-item';
    itemElement.setAttribute('data-id', progressItem.tmdb_id);
    itemElement.setAttribute('data-type', progressItem.content_type);
    
    itemElement.innerHTML = `
      <div class="expanded-item-poster">
        <img src="https://image.tmdb.org/t/p/w300${details.poster_path}" 
             alt="${title}" 
             onerror="this.src='/placeholder-poster.jpg'">
        <div class="expanded-progress-overlay">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${Math.min(progressPercent, 100)}%"></div>
          </div>
          <div class="progress-text">${Math.round(progressPercent)}%</div>
        </div>
      </div>
      <div class="expanded-item-info">
        <h4 class="expanded-item-title">${title}</h4>
        <div class="expanded-item-meta">
          <span class="content-type-badge ${progressItem.content_type}">
            <i class="fas fa-${progressItem.content_type === 'movie' ? 'film' : 'tv'}"></i>
            ${progressItem.content_type === 'movie' ? 'Película' : 'Serie'}
          </span>
          ${episodeInfo ? `<span class="episode-badge">${episodeInfo}</span>` : ''}
        </div>
        <div class="expanded-resume-info">
          <i class="fas fa-play-circle"></i>
          <span>Continuar desde ${resumeTime}</span>
        </div>
        <div class="expanded-item-description">
          ${(details.overview || 'Sin descripción disponible').substring(0, 150)}${details.overview && details.overview.length > 150 ? '...' : ''}
        </div>
      </div>
    `;
    
    // Add click handler to resume playback
    itemElement.addEventListener('click', () => {
      const movieData = {
        id: progressItem.tmdb_id,
        title: title,
        content_type: progressItem.content_type,
        watch_progress: progressItem
      };
      resumeFromProgress(movieData, true); // Auto-resume from progress
    });
    
    return itemElement;
    
  } catch (error) {
    console.error('Error creating expanded continue watching item:', error);
    return null;
  }
}

// Function to refresh continue watching section
async function refreshContinueWatchingSection() {
  if (currentUser) {
    await loadContinueWatchingSection();
  } else {
    hideContinueWatchingSection();
  }
}

// ===== TRENDING SECTIONS FUNCTIONALITY =====

// Function to load popular streaming providers and their trending content
async function loadTrendingSections() {
  const trendingSectionsContainer = document.getElementById('trending-sections');
  if (!trendingSectionsContainer) return;

  try {
    // Show loading skeleton
    showTrendingSkeletons(trendingSectionsContainer);

    // Fetch popular streaming providers
    const providersResponse = await fetch('/api/popular-providers');
    if (!providersResponse.ok) throw new Error('Failed to fetch providers');
    
    const providersData = await providersResponse.json();
    const providers = providersData.results.slice(0, 6); // Limit to 6 providers

    // Clear container
    trendingSectionsContainer.innerHTML = '';

    // Load content for each provider
    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      await loadProviderTrendingSection(provider, trendingSectionsContainer, i);
    }

    // Also load country trending section
    await loadCountryTrendingSection();

  } catch (error) {
    console.error('Error loading trending sections:', error);
    trendingSectionsContainer.innerHTML = '';
  }
}

// Function to load trending content for a specific provider
async function loadProviderTrendingSection(provider, container, index) {
  try {
    const sectionElement = document.createElement('div');
    sectionElement.className = 'trending-section section-loading';
    sectionElement.id = `trending-provider-${provider.provider_id}`;

    sectionElement.innerHTML = `
      <div class="section-header">
        <h2>
          <img src="https://image.tmdb.org/t/p/w92${provider.logo_path}" 
               alt="${provider.provider_name}" 
               class="provider-logo"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
          <i class="fas fa-play-circle" style="display: none;"></i>
          Popular en ${provider.provider_name}
        </h2>
      </div>
      <div class="trending-container">
        <div class="trending-grid" id="trending-grid-${provider.provider_id}">
          <!-- Loading content... -->
        </div>
      </div>
    `;

    container.appendChild(sectionElement);

    // Add staggered animation delay
    setTimeout(() => {
      sectionElement.classList.add('fade-in');
      sectionElement.classList.remove('section-loading');
    }, index * 200);

    // Fetch trending content for this provider
    const response = await fetch(`/api/trending/provider/${provider.provider_id}?type=movie&page=1`);
    if (!response.ok) throw new Error(`Failed to fetch trending for ${provider.provider_name}`);
    
    const data = await response.json();
    const grid = document.getElementById(`trending-grid-${provider.provider_id}`);
    
    if (data.results && data.results.length > 0) {
      grid.innerHTML = '';
      
      // Limit to 12 items for better performance
      const items = data.results.slice(0, 12);
      
      items.forEach((item, itemIndex) => {
        const trendingElement = createTrendingCard(item);
        trendingElement.style.animationDelay = `${itemIndex * 50}ms`;
        grid.appendChild(trendingElement);
      });

      // Mark section as loaded
      setTimeout(() => {
        sectionElement.classList.add('section-loaded');
      }, 300);
    } else {
      // If no content, hide the section
      sectionElement.style.display = 'none';
    }

  } catch (error) {
    console.error(`Error loading trending content for ${provider.provider_name}:`, error);
  }
}

// Function to load trending content by country
async function loadCountryTrendingSection() {
  const countrySection = document.getElementById('country-trending-section');
  const countryGrid = document.getElementById('country-trending-grid');
  
  if (!countrySection || !countryGrid) return;

  try {
    // Show loading state
    countrySection.classList.add('section-loading');
    countryGrid.innerHTML = createSkeletonItems(12);

    // Fetch trending content for user's region (default to US)
    const region = 'US'; // Could be dynamic based on user location
    const response = await fetch(`/api/trending/country/${region}?type=all&time_window=week&page=1`);
    
    if (!response.ok) throw new Error('Failed to fetch country trending');
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      countryGrid.innerHTML = '';
      
      // Limit to 12 items
      const items = data.results.slice(0, 12);
      
      items.forEach((item, index) => {
        const trendingElement = createTrendingCard(item);
        trendingElement.style.animationDelay = `${index * 50}ms`;
        countryGrid.appendChild(trendingElement);
      });

      // Show section with animation
      setTimeout(() => {
        countrySection.classList.remove('hidden', 'section-loading');
        countrySection.classList.add('fade-in', 'section-loaded');
      }, 300);
    } else {
      countrySection.classList.add('hidden');
    }

  } catch (error) {
    console.error('Error loading country trending section:', error);
    countrySection.classList.add('hidden');
  }
}

// Function to show skeleton loading for trending sections
function showTrendingSkeletons(container) {
  container.innerHTML = `
    <div class="trending-skeleton">
      ${createSkeletonItems(6)}
    </div>
  `;
}

// Function to create skeleton items
function createSkeletonItems(count) {
  let items = '';
  for (let i = 0; i < count; i++) {
    items += '<div class="skeleton-item"></div>';
  }
  return items;
}

// Function to toggle trending sections visibility during search
function toggleTrendingSectionsVisibility(isSearching) {
  const trendingSections = document.getElementById('trending-sections');
  const countryTrendingSection = document.getElementById('country-trending-section');
  const continueWatchingSection = document.getElementById('continue-watching-section');

  if (isSearching) {
    // Hide trending sections during search
    if (trendingSections) {
      trendingSections.classList.remove('search-visible');
      trendingSections.classList.add('search-hidden');
    }
    if (countryTrendingSection) {
      countryTrendingSection.classList.remove('search-visible');
      countryTrendingSection.classList.add('search-hidden');
    }
    if (continueWatchingSection) {
      continueWatchingSection.classList.remove('search-visible');
      continueWatchingSection.classList.add('search-hidden');
    }
  } else {
    // Show trending sections when not searching
    if (trendingSections) {
      trendingSections.classList.remove('search-hidden');
      trendingSections.classList.add('search-visible');
    }
    if (countryTrendingSection && !countryTrendingSection.classList.contains('hidden')) {
      countryTrendingSection.classList.remove('search-hidden');
      countryTrendingSection.classList.add('search-visible');
    }
    if (continueWatchingSection && !continueWatchingSection.classList.contains('hidden')) {
      continueWatchingSection.classList.remove('search-hidden');
      continueWatchingSection.classList.add('search-visible');
    }
  }
}

// Function to apply fade animation to movie grid
function animateMovieGrid() {
  const movieGrid = document.getElementById('movie-grid');
  if (movieGrid) {
    movieGrid.classList.remove('fade-in');
    movieGrid.classList.add('fade-out');
    
    setTimeout(() => {
      movieGrid.classList.remove('fade-out');
      movieGrid.classList.add('fade-in');
    }, 200);
  }
}



fetchGenres();
fetchProviders("movie");

window.onload = async function () {

  await initAuth();
  updateGenreSelect();
  
  // Load trending sections after authentication is initialized
  setTimeout(async () => {
    if (!document.getElementById('search-bar').value.trim()) {
      await loadTrendingSections();
    }
  }, 1000);
};


window.showTorrentOptions = function(magnetLink, movieTitle) {

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

    watchOnlineWithStats(magnetLink, movieTitle);
  };
  document.getElementById('descargar-torrent').onclick = function() {
    document.body.removeChild(modal);

  };
  document.getElementById('cerrar-torrent-modal').onclick = function() {
    document.body.removeChild(modal);
  };
  document.getElementById('close-torrent-x').onclick = function() {
    document.body.removeChild(modal);
  };
};


async function watchOnline(magnetURI, movieTitle) {

  const fileSelectionModal = document.getElementById('file-selection-modal');
  fileSelectionModal.classList.remove('hidden');
  fileSelectionModal.style.display = 'block';
  document.getElementById('torrent-loading').style.display = 'block';
  document.getElementById('file-list').style.display = 'none';

  try {

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


    document.getElementById('torrent-loading').style.display = 'none';
    document.getElementById('file-list').style.display = 'block';


    const torrentInfoHtml = `
      <div class="torrent-info">
        <h4>Información del Torrent:</h4>
        <p><strong>Nombre:</strong> ${torrentInfo.name}</p>
        <p><strong>Tamaño:</strong> ${formatBytes(torrentInfo.length)}</p>
        <p><strong>Peers:</strong> ${torrentInfo.numPeers}</p>
        <p><strong>Progreso:</strong> ${(torrentInfo.progress * 100).toFixed(1)}%</p>
      </div>
    `;


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

// Function to watch TV episode with season and episode information
async function watchTVEpisodeOnline(magnetURI, episodeTitle, seasonNumber, episodeNumber) {
  // Update current content data with season and episode information
  if (currentContentData && currentContentData.content_type === 'tv') {
    currentContentData.season_number = seasonNumber;
    currentContentData.episode_number = episodeNumber;
    console.log('📺 Updated TV episode data for tracking:', currentContentData);
  }
  
  // Call the regular watch function
  await watchOnlineWithStats(magnetURI, episodeTitle);
}


async function watchOnlineWithStats(magnetURI, movieTitle) {

  const torrentHash = magnetURI.match(/xt=urn:btih:([^&]+)/i)?.[1] || magnetURI;
  

  if (pendingTorrentRequests.has(torrentHash)) {
    showNotification('Ya hay una solicitud en proceso para este torrent. Espera a que termine.', 'warning', 3000);
    return;
  }
  

  pendingTorrentRequests.set(torrentHash, true);
  

  const fileSelectionModal = document.getElementById('file-selection-modal');
  fileSelectionModal.classList.remove('hidden');
  fileSelectionModal.style.display = 'block';
  document.getElementById('torrent-loading').style.display = 'block';
  document.getElementById('file-list').style.display = 'none';

  let retryCount = 0;
  const maxRetries = 3;
  let currentTimeout = 5000;

  const attemptExplore = async () => {
    try {

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
      const timeoutId = setTimeout(() => controller.abort(), 30000);

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
        

        if (response.status === 503 && retryCount < maxRetries) {
          retryCount++;
          currentTimeout = Math.min(currentTimeout * 1.2, 8000);
          
          document.getElementById('loading-status').textContent = 
            `⏳ El torrent está cargando, reintentando en ${Math.ceil(currentTimeout/1000)} segundos... (${retryCount}/${maxRetries + 1})`;
          
          setTimeout(attemptExplore, currentTimeout);
          return;
        }
        

        if (response.status === 408) {
          throw new Error('⏰ El torrent está tardando demasiado en responder. Puede ser un torrent lento o sin peers activos. Intenta con otra calidad.');
        }
        
        throw new Error(errorData.message || 'Error explorando el torrent');
      }

      const torrentInfo = await response.json();
      // Añadir el magnet link al torrent info para poder guardarlo y reutilizarlo
      torrentInfo.magnetURI = magnetURI;
      currentTorrentInfo = torrentInfo;


      if (torrentInfo.videoFiles.length === 1) {

        pendingTorrentRequests.delete(torrentHash);
        closeFileSelectionModal();
        playVideoFileWithStats(torrentInfo.videoFiles[0].index);
        return;
      }


      document.getElementById('torrent-loading').style.display = 'none';
      document.getElementById('file-list').style.display = 'block';


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


  attemptExplore();
}


function formatSpeed(bytesPerSecond) {
  if (!bytesPerSecond || bytesPerSecond === 0) return '0 B/s';
  
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
  
  return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


function playVideoFileWithStats(fileIndex) {
  if (!currentTorrentInfo) {
    alert('Error: Información del torrent no disponible');
    return;
  }


  closeFileSelectionModal();


  const videoModalEl = document.getElementById('video-modal');
  videoModalEl.classList.remove('hidden');
  videoModalEl.style.display = 'block';
  
  const videoPlayer = document.getElementById('video-player');
  currentVideoPlayer = videoPlayer;


  const streamUrl = `/api/torrent/stream/${currentTorrentInfo.infoHash}/${fileIndex}`;
  videoPlayer.src = streamUrl;


  const torrentStatsDiv = document.getElementById('torrent-stats');
  if (torrentStatsDiv) {
    torrentStatsDiv.style.display = 'block';
  }


  updateTorrentStats(currentTorrentInfo);


  if (statsInterval) {
    clearInterval(statsInterval);
  }


  statsInterval = setInterval(() => {
    updateTorrentStatsFromServer(currentTorrentInfo.infoHash);
  }, 2000);


  const videoModal = document.getElementById('video-modal');
  const originalCloseFunction = window.closeVideoModal;
  window.closeVideoModal = function() {
    if (statsInterval) {
      clearInterval(statsInterval);
      statsInterval = null;
    }
    
    // Stop watch progress tracking
    stopWatchProgressTracking();
    
    if (originalCloseFunction) originalCloseFunction();
    window.closeVideoModal = originalCloseFunction;
  };


  clearSubtitles();


  loadTorrentSubtitles();


  setupSubtitleControls();

  setupVideoPlayerEvents();

  // Set up watch progress tracking
  const currentMovie = getCurrentMovieData();
  if (currentMovie) {
    setupWatchData(
      currentMovie.content_type || 'movie',
      currentMovie.id,
      currentMovie.title || currentMovie.name,
      currentMovie.season_number || null,
      currentMovie.episode_number || null,
      currentTorrentInfo,
      fileIndex
    );

    // Load existing progress and set video time if available
    loadWatchProgress(
      currentWatchData.content_type,
      currentWatchData.tmdb_id,
      currentWatchData.season_number,
      currentWatchData.episode_number
    ).then(progressData => {
      if (progressData && progressData.playback_position > 30) {
        // Ask user if they want to resume from saved position with a nice modal
        const resumeTime = formatTime(progressData.playback_position);
        showResumeModal(resumeTime, progressData.playback_position, videoPlayer);
      } else {
        // Start progress tracking immediately if no saved progress
        startWatchProgressTracking();
      }
    });
  } else {
    // Only show notification, don't start progress tracking without valid watch data
    console.log('⚠️ No se puede rastrear progreso: información de contenido no disponible');
  }

  showNotification('Iniciando reproducción con seguimiento de progreso', 'info', 3000);
}

// Helper function to get current movie/show data from modal
function getCurrentMovieData() {
  // First, try to use stored content data
  if (currentContentData) {
    return currentContentData;
  }
  
  // Fallback: Try to extract data from the current modal
  const modal = document.getElementById('movie-modal');
  if (!modal || modal.style.display === 'none') {
    return null;
  }

  // Check if we have stored movie data in global variables or data attributes
  const modalContent = modal.querySelector('.modal-content');
  if (modalContent) {
    const titleElement = modalContent.querySelector('h2, .movie-title');
    const tmdbId = modalContent.dataset.tmdbId || modalContent.dataset.movieId;
    const contentType = modalContent.dataset.contentType || modalContent.dataset.type || 'movie';
    
    return {
      id: tmdbId ? parseInt(tmdbId) : null,
      title: titleElement ? titleElement.textContent.trim() : 'Unknown',
      content_type: contentType,
      season_number: modalContent.dataset.seasonNumber ? parseInt(modalContent.dataset.seasonNumber) : null,
      episode_number: modalContent.dataset.episodeNumber ? parseInt(modalContent.dataset.episodeNumber) : null
    };
  }
  
  return null;
}


function startProgressTracking() {
  if (!currentTorrentInfo) return;

  const progressInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/torrent/progress/${currentTorrentInfo.infoHash}`);
      if (response.ok) {
        const progressData = await response.json();
        

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


    if (document.getElementById('video-modal').style.display === 'none') {
      clearInterval(progressInterval);
    }
  }, 2000);
}


function clearSubtitles() {
  const videoPlayer = document.getElementById('video-player');
  const tracks = videoPlayer.querySelectorAll('track');
  tracks.forEach(track => track.remove());


  document.getElementById('torrent-subtitle-select').innerHTML = '<option value="">Sin subtítulos</option>';
  document.getElementById('online-subtitle-select').innerHTML = '<option value="">Sin subtítulos online</option>';
  document.getElementById('uploaded-subtitle-select').innerHTML = '<option value="">Sin subtítulos subidos</option>';
}


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


function setupSubtitleControls() {

  document.getElementById('search-subtitles-btn').onclick = async function() {
    const language = document.getElementById('language-select').value;
    await searchOnlineSubtitles(language);
  };


  document.getElementById('select-file-btn').onclick = function() {
    const fileInput = document.getElementById('subtitle-file');
    fileInput.click();
  };

  document.getElementById('subtitle-file').onchange = function(event) {
    const file = event.target.files[0];
    if (file) {

      const selectBtn = document.getElementById('select-file-btn');
      selectBtn.innerHTML = `<span class="btn-icon">📄</span>${file.name}`;
      

      const uploadBtn = document.getElementById('upload-subtitle-btn');
      uploadBtn.disabled = false;
      

      uploadBtn.onclick = function() {
        uploadSubtitle(file);
      };
    }
  };


  document.getElementById('torrent-subtitle-select').onchange = function() {
    if (this.value) {
      loadTorrentSubtitle(this.value);
    }
  };


  document.getElementById('online-subtitle-select').onchange = function() {
    if (this.value) {
      loadOnlineSubtitle(this.value);
    }
  };


  document.getElementById('uploaded-subtitle-select').onchange = function() {
    if (this.value) {
      loadUploadedSubtitle(this.value);
    }
  };
}


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


async function searchOnlineSubtitles(language) {
  const searchBtn = document.getElementById('search-subtitles-btn');
  const originalText = searchBtn.textContent;
  
  try {

    searchBtn.textContent = 'Buscando...';
    searchBtn.disabled = true;
    showNotification('Buscando subtítulos online...', 'info', 2000);
    

    const movieTitle = originalTitle || 'Unknown Movie';
    const imdbId = currentImdbId || null;
    

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

    searchBtn.textContent = originalText;
    searchBtn.disabled = false;
  }
}


async function loadOnlineSubtitle(subtitleUrl) {
  try {
    showNotification('Cargando subtítulo online...', 'info', 2000);
    

    if (!subtitleUrl || subtitleUrl.includes('undefined')) {
      throw new Error('URL de subtítulo inválida. Por favor, selecciona otro subtítulo.');
    }
    
    console.log('Loading subtitle from URL:', subtitleUrl);
    

    let finalUrl;
    if (subtitleUrl.startsWith('/api/subtitles/opensubtitles-download/')) {

      finalUrl = subtitleUrl;
    } else {

      finalUrl = `/api/subtitles/proxy?url=${encodeURIComponent(subtitleUrl)}`;
    }
    
    console.log('Final URL for subtitle loading:', finalUrl);
    

    const response = await fetch(finalUrl);
    
    if (!response.ok) {
      let errorMessage = `Error del servidor: ${response.status}`;
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {

        errorMessage = response.statusText || errorMessage;
      }
      

      if (response.status === 404) {
        errorMessage = 'Subtítulo no encontrado. Es posible que la URL haya expirado o que el subtítulo ya no esté disponible.';
      } else if (response.status === 403) {
        errorMessage = 'Acceso denegado al subtítulo. El servidor de subtítulos no permite el acceso.';
      } else if (response.status >= 500) {
        errorMessage = 'Error del servidor de subtítulos. Intenta más tarde.';
      }
      
      throw new Error(errorMessage);
    }
    

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {

      const jsonResponse = await response.json();
      throw new Error(jsonResponse.message || 'Respuesta inesperada del servidor');
    }
    

    addSubtitleTrack(finalUrl, 'Online Subtitle', 'es');
    showNotification('Subtítulo online cargado exitosamente', 'success');
    
  } catch (error) {
    console.error('Error loading online subtitle:', error);
    

    let suggestion = '';
    if (error.message.includes('404') || error.message.includes('no encontrado')) {
      suggestion = ' Prueba subiendo tu propio archivo de subtítulos o busca en otro idioma.';
    } else if (error.message.includes('integración')) {
      suggestion = ' Esta aplicación necesita configuración adicional para acceder a fuentes de subtítulos reales.';
    }
    
    showNotification(`Error al cargar subtítulo: ${error.message}${suggestion}`, 'error', 8000);
  }
}


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


function loadUploadedSubtitle(subtitlePath) {
  addSubtitleTrack(subtitlePath, 'Uploaded Subtitle', 'es');
  showNotification('Subtítulo subido cargado', 'success');
}


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

    const existingTracks = videoPlayer.querySelectorAll('track');
    existingTracks.forEach(track => track.remove());


    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.src = src;
    track.srclang = language;
    track.label = label;
    track.default = true;


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
      

      console.log('Verificando accesibilidad del subtítulo...');
      fetch(src, {method: 'HEAD'})
        .then(response => {
          console.log('Respuesta del servidor para subtítulo:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
          });
          

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
    

    setTimeout(() => {
      if (videoPlayer.textTracks.length > 0) {

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


async function closeVideoModal() {
  const videoModal = document.getElementById('video-modal');
  videoModal.classList.add('hidden');
  videoModal.style.display = 'none';
  

  const videoPlayer = document.getElementById('video-player');
  if (videoPlayer) {
    videoPlayer.pause();
    videoPlayer.src = '';
    videoPlayer.load();
    

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
  

  if (window.localSubtitleBlobUrls) {
    window.localSubtitleBlobUrls.forEach(url => {
      URL.revokeObjectURL(url);
    });
    window.localSubtitleBlobUrls = [];
  }
  

  if (window.currentTorrentClient) {
    window.currentTorrentClient.destroy();
    window.currentTorrentClient = null;
  }
  

  const troubleshootingDiv = document.querySelector('.audio-troubleshooting');
  if (troubleshootingDiv) {
    troubleshootingDiv.remove();
  }
  

  if (stallTimeoutId) {
    clearTimeout(stallTimeoutId);
    stallTimeoutId = null;
  }
  

  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  

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
  

  if (window.currentTorrentClient) {
    try {
      window.currentTorrentClient.destroy();
      window.currentTorrentClient = null;
    } catch (error) {
      console.error('Error cleaning up WebTorrent client on unload:', error);
    }
  }
  

  if (window.localSubtitleBlobUrls && window.localSubtitleBlobUrls.length > 0) {
    window.localSubtitleBlobUrls.forEach(url => URL.revokeObjectURL(url));
    window.localSubtitleBlobUrls = [];
    console.log('URLs de subtítulos locales limpiadas');
  }
  

  currentTorrentInfo = null;
  

  const torrentStatsDiv = document.getElementById('torrent-stats');
  if (torrentStatsDiv) {
    torrentStatsDiv.style.display = 'none';

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


function closeFileSelectionModal() {
  const fileSelectionModal = document.getElementById('file-selection-modal');
  fileSelectionModal.classList.add('hidden');
  fileSelectionModal.style.display = 'none';

  pendingTorrentRequests.clear();
}


function updateTorrentStats(torrentInfo) {

  const seedsElement = document.getElementById('torrent-seeds');
  const leechersElement = document.getElementById('torrent-leechers');
  const peersElement = document.getElementById('torrent-peers');
  
  if (seedsElement) seedsElement.textContent = `Seeds: ${torrentInfo.seeds || 0}`;
  if (leechersElement) leechersElement.textContent = `Leechers: ${torrentInfo.leechers || 0}`;
  if (peersElement) peersElement.textContent = `Peers: ${torrentInfo.numPeers || 0}`;


  const progressElement = document.getElementById('torrent-progress');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const progressPercentage = document.getElementById('progress-percentage');
  
  const progress = (torrentInfo.progress * 100).toFixed(1);
  if (progressElement) progressElement.textContent = `Progress: ${progress}%`;
  if (progressBarFill) progressBarFill.style.width = `${progress}%`;
  if (progressPercentage) progressPercentage.textContent = `${progress}%`;


  const downloadSpeedElement = document.getElementById('torrent-download-speed');
  const uploadSpeedElement = document.getElementById('torrent-upload-speed');
  
  if (downloadSpeedElement) downloadSpeedElement.textContent = `↓ ${formatSpeed(torrentInfo.downloadSpeed)}`;
  if (uploadSpeedElement) uploadSpeedElement.textContent = `↑ ${formatSpeed(torrentInfo.uploadSpeed)}`;


  const downloadedElement = document.getElementById('torrent-downloaded');
  const uploadedElement = document.getElementById('torrent-uploaded');
  const timeRemainingElement = document.getElementById('torrent-time-remaining');
  
  if (downloadedElement) downloadedElement.textContent = `Downloaded: ${formatBytes(torrentInfo.downloaded || 0)}`;
  if (uploadedElement) uploadedElement.textContent = `Uploaded: ${formatBytes(torrentInfo.uploaded || 0)}`;
  if (timeRemainingElement) {
    const eta = torrentInfo.timeRemaining ? formatTime(torrentInfo.timeRemaining) : '--:--';
    timeRemainingElement.textContent = `ETA: ${eta}`;
  }


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


function setupVideoPlayerEvents() {
  const videoPlayer = document.getElementById('video-player');
  const playerLoadingIndicator = document.getElementById('player-loading-indicator');
  const playerStatusMessage = document.getElementById('player-status-message');
  
  if (!videoPlayer) return;


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


window.testVideoStreamingFeatures = testVideoStreamingFeatures;


async function testServerAPIs() {
  console.log('Testing Server APIs...');
  showNotification('Testing server APIs...', 'info');
  
  try {

    const subtitleResponse = await fetch('/api/subtitles/search?movieTitle=Test Movie&language=es');
    if (subtitleResponse.ok) {
      const subtitles = await subtitleResponse.json();
      console.log('Subtitle search API working:', subtitles);
      showNotification('Subtitle search API working', 'success');
    } else {
      throw new Error('Subtitle search API failed');
    }
    

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


window.testServerAPIs = testServerAPIs;


window.addEventListener('beforeunload', () => {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  

  pendingTorrentRequests.clear();
  

  if (window.localSubtitleBlobUrls) {
    window.localSubtitleBlobUrls.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {

      }
    });
    window.localSubtitleBlobUrls = [];
  }
});

// Global function for TV episode watching with season/episode info
window.watchTVEpisodeOnline = watchTVEpisodeOnline;

window.toggleTorrentActions = function(button) {
  const torrentItem = button.closest('.torrent-item');
  const actionsDiv = torrentItem.querySelector('.torrent-actions');
  const allActions = document.querySelectorAll('.torrent-actions');
  const allButtons = document.querySelectorAll('.torrent-button');
  

  allActions.forEach(actions => {
    if (actions !== actionsDiv && actions.classList.contains('active')) {
      actions.classList.remove('active');
      actions.style.maxHeight = '0px';
      setTimeout(() => {
        actions.style.display = 'none';
      }, 300);
    }
  });
  

  allButtons.forEach(btn => {
    if (btn !== button) {
      btn.classList.remove('active');
    }
  });
  

  if (actionsDiv.classList.contains('active')) {

    button.classList.remove('active');
    actionsDiv.classList.remove('active');
    actionsDiv.style.maxHeight = '0px';
    setTimeout(() => {
      actionsDiv.style.display = 'none';
    }, 300);
  } else {

    button.classList.add('active');
    actionsDiv.style.display = 'flex';
    actionsDiv.classList.add('active');

    setTimeout(() => {
      actionsDiv.style.maxHeight = '80px';
    }, 10);
  }
};


document.addEventListener('click', function(event) {

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


document.addEventListener('DOMContentLoaded', async function() {

  await initAuth();
  

  console.log('Aplicación inicializada con autenticación Supabase');
});
