// supabase-config.js
// Importar Supabase desde CDN (ya cargado en index.html)
// const { createClient } = supabase (se accede globalmente)

// Función para obtener configuración de Supabase desde el servidor
async function getSupabaseConfig() {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    return config;
  } catch (error) {
    console.error('Error obteniendo configuración de Supabase:', error);
    return {
      SUPABASE_URL: 'TU_SUPABASE_URL',
      SUPABASE_ANON_KEY: 'TU_SUPABASE_ANON_KEY'
    };
  }
}

// Inicializar Supabase de forma asíncrona
let supabaseClient = null;

async function initializeSupabase() {
  const config = await getSupabaseConfig();
  supabaseClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  console.log('✅ Supabase inicializado correctamente');
  return supabaseClient;
}

// Funciones de autenticación
window.supabaseAuth = {
  // Registrar nuevo usuario
  async signUp(email, password, userData = {}) {
    try {
      if (!supabaseClient) await initializeSupabase();
      
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: userData
        }
      });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error en registro:', error);
      return { success: false, error: error.message };
    }
  },

  // Iniciar sesión
  async signIn(email, password) {
    try {
      if (!supabaseClient) await initializeSupabase();
      
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error en login:', error);
      return { success: false, error: error.message };
    }
  },

  // Cerrar sesión
  async signOut() {
    try {
      if (!supabaseClient) await initializeSupabase();
      
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      return { success: false, error: error.message };
    }
  },

  // Obtener usuario actual
  async getCurrentUser() {
    try {
      if (!supabaseClient) await initializeSupabase();
      
      const { data: { user }, error } = await supabaseClient.auth.getUser();
      if (error) {
        // Si es solo un error de sesión faltante, no lo reportamos como error
        if (error.message && error.message.includes('Auth session missing')) {
          return null; // Usuario no logueado (estado normal)
        }
        throw error;
      }
      return user;
    } catch (error) {
      // Solo registrar errores que no sean de sesión faltante
      if (!error.message || !error.message.includes('Auth session missing')) {
        console.error('Error obteniendo usuario:', error);
      }
      return null;
    }
  },

  // Escuchar cambios en la autenticación
  async onAuthStateChange(callback) {
    if (!supabaseClient) await initializeSupabase();
    return supabaseClient.auth.onAuthStateChange(callback);
  }
};

// Funciones para gestión de favoritos
window.supabaseFavorites = {
  // Obtener favoritos del usuario
  async getFavorites(userId) {
    try {
      if (!supabaseClient) await initializeSupabase();
      
      const { data, error } = await supabaseClient
        .from('favorites')
        .select('*')
        .eq('user_id', userId);
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error obteniendo favoritos:', error);
      return { success: false, error: error.message };
    }
  },

  // Agregar favorito
  async addFavorite(userId, movieData) {
    try {
      if (!supabaseClient) await initializeSupabase();
      
      const { data, error } = await supabaseClient
        .from('favorites')
        .insert([{
          user_id: userId,
          movie_title: movieData.title,
          movie_data: movieData,
          created_at: new Date().toISOString()
        }]);
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error agregando favorito:', error);
      return { success: false, error: error.message };
    }
  },

  // Eliminar favorito
  async removeFavorite(userId, movieTitle) {
    try {
      if (!supabaseClient) await initializeSupabase();
      
      const { data, error } = await supabaseClient
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('movie_title', movieTitle);
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error eliminando favorito:', error);
      return { success: false, error: error.message };
    }
  },

  // Verificar si una película es favorita
  async isFavorite(userId, movieTitle) {
    try {
      if (!supabaseClient) await initializeSupabase();
      
      const { data, error } = await supabaseClient
        .from('favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('movie_title', movieTitle)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return !!data;
    } catch (error) {
      console.error('Error verificando favorito:', error);
      return false;
    }
  }
};

// Inicializar Supabase cuando se carga el archivo
// Esto permite que esté listo para cuando se necesite
initializeSupabase().catch(error => {
  console.error('Error inicializando Supabase:', error);
});
