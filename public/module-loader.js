// module-loader.js
// Este archivo actúa como un wrapper para cargar módulos de manera segura

async function loadSupabaseConfig() {
  try {
    // Esperar a que el script de supabase-config.js se cargue
    let attempts = 0;
    while (!window.supabaseAuth && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (window.supabaseAuth && window.supabaseFavorites) {
      return {
        auth: window.supabaseAuth,
        favorites: window.supabaseFavorites
      };
    } else {
      throw new Error('Supabase no configurado correctamente');
    }
  } catch (error) {
    console.error('Error loading Supabase config:', error);
    // Fallback para desarrollo sin Supabase
    return {
      auth: {
        signUp: async () => ({ success: false, error: 'Supabase no configurado' }),
        signIn: async () => ({ success: false, error: 'Supabase no configurado' }),
        signOut: async () => ({ success: false, error: 'Supabase no configurado' }),
        getCurrentUser: async () => null,
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
      },
      favorites: {
        getFavorites: async () => ({ success: true, data: [] }),
        addFavorite: async () => ({ success: false, error: 'Supabase no configurado' }),
        removeFavorite: async () => ({ success: false, error: 'Supabase no configurado' }),
        isFavorite: async () => false
      }
    };
  }
}

// Hacer disponible globalmente
window.loadSupabaseConfig = loadSupabaseConfig;
