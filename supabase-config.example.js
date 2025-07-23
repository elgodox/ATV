// supabase-config.example.js
// INSTRUCCIONES:
// 1. Renombra este archivo a 'supabase-config.js'
// 2. Reemplaza los valores con los de tu proyecto Supabase
// 3. Ve a SUPABASE_SETUP.md para instrucciones completas

// IMPORTANTE: Reemplaza estos valores con los de tu proyecto Supabase
// Los encuentras en: Supabase Dashboard > Settings > API
const SUPABASE_URL = 'https://tu-proyecto.supabase.co'; // Tu Project URL
const SUPABASE_ANON_KEY = 'tu-anon-key-aqui'; // Tu anon/public key

// Crear cliente de Supabase (usando CDN cargado en index.html)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Funciones de autenticación
window.supabaseAuth = {
  // Registrar nuevo usuario
  async signUp(email, password, userData = {}) {
    try {
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
  onAuthStateChange(callback) {
    return supabaseClient.auth.onAuthStateChange(callback);
  }
};

// Funciones para gestión de favoritos
window.supabaseFavorites = {
  // Obtener favoritos del usuario
  async getFavorites(userId) {
    try {
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

// Ya no es necesario asignar a window nuevamente ya que se hizo arriba directamente
