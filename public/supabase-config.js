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
  
  // Configurar opciones adicionales para resolver errores 406
  const options = {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    },
    global: {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    }
  };
  
  supabaseClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, options);
  console.log('✅ Supabase inicializado correctamente con configuración mejorada');
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
      
      // Verificar autenticación actual
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !user) {
        console.error('Usuario no autenticado:', authError);
        return { success: false, error: 'Usuario no autenticado' };
      }
      
      // Verificar que el userId coincida con el usuario autenticado
      if (user.id !== userId) {
        console.error('Mismatch entre usuario autenticado y userId solicitado');
        return { success: false, error: 'No autorizado' };
      }
      
      // Intentar obtener favoritos directamente sin verificaciones adicionales
      console.log('🔍 Obteniendo favoritos para usuario:', user.id);
      const { data, error } = await supabaseClient
        .from('favorites')
        .select('*')
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error RLS en getFavorites:', error);
        // Si es un error de RLS, mostrar información útil
        if (error.code === '42501') {
          console.error('🚨 ERROR RLS: La tabla favorites no tiene las políticas correctas.');
          console.error('🔧 Ejecuta el script supabase-rls-fix.sql en tu proyecto Supabase.');
          console.error('📋 O ejecuta: debugSupabaseRLS() en la consola para ver el SQL necesario.');
        }
        throw error;
      }
      
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
      
      // Verificar autenticación actual
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !user) {
        console.error('Usuario no autenticado:', authError);
        return { success: false, error: 'Usuario no autenticado' };
      }
      
      // Verificar que el userId coincida con el usuario autenticado
      if (user.id !== userId) {
        console.error('Mismatch entre usuario autenticado y userId solicitado');
        return { success: false, error: 'No autorizado' };
      }
      
      console.log('➕ Agregando favorito para usuario:', user.id, 'película:', movieData.title);
      const { data, error } = await supabaseClient
        .from('favorites')
        .insert([{
          user_id: userId,
          movie_title: movieData.title,
          movie_data: movieData,
          created_at: new Date().toISOString()
        }]);
      
      if (error) {
        console.error('Error RLS en addFavorite:', error);
        // Si es un error de RLS, mostrar información útil
        if (error.code === '42501') {
          console.error('🚨 ERROR RLS: La tabla favorites no tiene las políticas correctas.');
          console.error('🔧 Ejecuta el script supabase-rls-fix.sql en tu proyecto Supabase.');
          console.error('📋 O ejecuta: debugSupabaseRLS() en la consola para ver el SQL necesario.');
        }
        throw error;
      }
      
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
      
      // Verificar autenticación actual
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !user) {
        console.error('Usuario no autenticado:', authError);
        return { success: false, error: 'Usuario no autenticado' };
      }
      
      // Verificar que el userId coincida con el usuario autenticado
      if (user.id !== userId) {
        console.error('Mismatch entre usuario autenticado y userId solicitado');
        return { success: false, error: 'No autorizado' };
      }
      
      console.log('🗑️ Eliminando favorito para usuario:', user.id, 'película:', movieTitle);
      const { data, error } = await supabaseClient
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('movie_title', movieTitle);
      
      if (error) {
        console.error('Error RLS en removeFavorite:', error);
        if (error.code === '42501') {
          console.error('🚨 ERROR RLS: La tabla favorites no tiene las políticas correctas.');
          console.error('🔧 Ejecuta el script supabase-rls-fix.sql en tu proyecto Supabase.');
        }
        throw error;
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('Error eliminando favorito:', error);
      return { success: false, error: error.message };
    }
  },

  // Obtener todos los favoritos de un usuario (OPTIMIZADO)
  async getAllUserFavorites(userId) {
    try {
      if (!supabaseClient) await initializeSupabase();
      
      // Verificar autenticación actual
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !user) {
        console.warn('Usuario no autenticado para obtener favoritos');
        return [];
      }
      
      // Verificar que el userId coincida con el usuario autenticado
      if (user.id !== userId) {
        console.warn('Mismatch entre usuario autenticado y userId solicitado');
        return [];
      }
      
      console.log('📋 Obteniendo todos los favoritos para usuario:', user.id);
      const { data, error } = await supabaseClient
        .from('favorites')
        .select('movie_title, movie_data')
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error obteniendo favoritos:', error);
        if (error.code === '42501') {
          console.error('🚨 ERROR RLS: La tabla favorites no tiene las políticas correctas.');
          console.error('🔧 Ejecuta el script supabase-rls-fix.sql en tu proyecto Supabase.');
        }
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error obteniendo todos los favoritos:', error);
      return [];
    }
  },

  // Verificar si una película es favorita
  async isFavorite(userId, movieTitle) {
    try {
      if (!supabaseClient) await initializeSupabase();
      
      // Verificar autenticación actual
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !user) {
        console.warn('Usuario no autenticado para verificar favorito');
        return false;
      }
      
      // Verificar que el userId coincida con el usuario autenticado
      if (user.id !== userId) {
        console.warn('Mismatch entre usuario autenticado y userId solicitado');
        return false;
      }
      
      console.log('🔍 Verificando favorito para usuario:', user.id, 'película:', movieTitle);
      const { data, error } = await supabaseClient
        .from('favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('movie_title', movieTitle)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error RLS en isFavorite:', error);
        if (error.code === '42501') {
          console.error('🚨 ERROR RLS: La tabla favorites no tiene las políticas correctas.');
          console.error('🔧 Ejecuta el script supabase-rls-fix.sql en tu proyecto Supabase.');
        }
        throw error;
      }
      
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

// Función de debugging completa para verificar estado de autenticación
window.debugSupabaseAuth = async function() {
  console.log('🔍 === DEBUG COMPLETO DE SUPABASE ===');
  
  try {
    // 1. Verificar configuración del servidor
    console.log('1️⃣ Verificando configuración del servidor...');
    const configResponse = await fetch('/api/config');
    const config = await configResponse.json();
    console.log('📡 Configuración del servidor:', {
      hasUrl: !!config.SUPABASE_URL,
      urlStart: config.SUPABASE_URL?.substring(0, 20) + '...',
      hasKey: !!config.SUPABASE_ANON_KEY,
      keyStart: config.SUPABASE_ANON_KEY?.substring(0, 20) + '...'
    });
    
    // 2. Verificar inicialización del cliente
    console.log('2️⃣ Verificando cliente Supabase...');
    if (!supabaseClient) {
      console.log('❌ Cliente de Supabase no inicializado, intentando inicializar...');
      await initializeSupabase();
    }
    
    if (supabaseClient) {
      console.log('✅ Cliente de Supabase inicializado');
    } else {
      console.log('❌ No se pudo inicializar cliente de Supabase');
      return;
    }
    
    // 3. Verificar usuario actual
    console.log('3️⃣ Verificando autenticación...');
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    
    if (error) {
      console.log('❌ Error obteniendo usuario:', error);
      return;
    }
    
    if (user) {
      console.log('✅ Usuario autenticado:', {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at
      });
      
      // 4. Verificar acceso a tabla favorites (sin RLS)
      console.log('4️⃣ Verificando acceso a tabla favorites...');
      const { data, error: favError } = await supabaseClient
        .from('favorites')
        .select('count')
        .limit(1);
        
      if (favError) {
        console.log('❌ Error accediendo a tabla favorites:', favError);
        console.log('🔧 Esto indica que las políticas RLS están activas y bloquean el acceso');
        console.log('💡 Solución: Ejecuta el script simple-rls-fix.sql para desactivar RLS');
      } else {
        console.log('✅ Acceso a tabla favorites exitoso');
      }
      
      // 5. Intentar inserción de prueba
      console.log('5️⃣ Probando inserción de prueba...');
      const testTitle = 'TEST_MOVIE_' + Date.now();
      const { data: testData, error: testError } = await supabaseClient
        .from('favorites')
        .insert([{
          user_id: user.id,
          movie_title: testTitle,
          movie_data: { test: true },
          created_at: new Date().toISOString()
        }]);
        
      if (testError) {
        console.log('❌ Error en inserción de prueba:', testError);
        if (testError.code === '42501') {
          console.log('🚨 ERROR RLS: Ejecuta este comando en Supabase:');
          console.log('   ALTER TABLE public.favorites DISABLE ROW LEVEL SECURITY;');
        }
      } else {
        console.log('✅ Inserción de prueba exitosa');
        // Limpiar el registro de prueba
        await supabaseClient
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('movie_title', testTitle);
        console.log('🧹 Registro de prueba eliminado');
      }
    } else {
      console.log('❌ No hay usuario autenticado');
      console.log('💡 Para probar, inicia sesión primero');
    }
    
    console.log('🏁 === FIN DEBUG ===');
  } catch (error) {
    console.log('❌ Error en debug:', error);
  }
};

// Función para verificar y recrear políticas RLS
window.debugSupabaseRLS = async function() {
  console.log('🔧 Para solucionar el problema, ejecuta este SQL en el editor de Supabase:');
  console.log(`
-- 1. Primero, eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view own favorites" ON favorites;
DROP POLICY IF EXISTS "Users can insert own favorites" ON favorites;
DROP POLICY IF EXISTS "Users can update own favorites" ON favorites;
DROP POLICY IF EXISTS "Users can delete own favorites" ON favorites;

-- 2. Verificar que RLS esté habilitado
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- 3. Crear políticas corregidas
CREATE POLICY "Users can view own favorites" ON favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites" ON favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own favorites" ON favorites
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites" ON favorites
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Verificar que la tabla existe con la estructura correcta
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'favorites';
  `);
};
