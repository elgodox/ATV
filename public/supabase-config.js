// Supabase configuration
// Supabase is now loaded globally from /lib/supabase.js
const { createClient } = supabase;

// Variables para almacenar la configuración de Supabase
let SUPABASE_URL = 'https://your-project.supabase.co';
let SUPABASE_ANON_KEY = 'your-anon-key';
let supabaseClient = null;

// Función para inicializar la configuración de Supabase
export async function initializeSupabaseConfig() {
  try {
    const response = await fetch('/api/supabase-config');
    const config = await response.json();
    
    if (config.configured && config.url && config.anonKey) {
      SUPABASE_URL = config.url;
      SUPABASE_ANON_KEY = config.anonKey;
      supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('✅ Supabase configurado correctamente');
      return true;
    } else {
      console.warn('⚠️ Supabase no está configurado en el servidor');
      showSupabaseWarning();
      return false;
    }
  } catch (error) {
    console.error('Error al obtener configuración de Supabase:', error);
    showSupabaseWarning();
    return false;
  }
}

// Función para mostrar advertencia de configuración
function showSupabaseWarning() {
  console.warn('⚠️ Using placeholder Supabase configuration. Please update SUPABASE_URL and SUPABASE_ANON_KEY with your actual Supabase project values.');
  console.warn('📋 Instructions:');
  console.warn('1. Create a new project at https://supabase.com');
  console.warn('2. Get your project URL and anon key from Settings > API');
  console.warn('3. Create a .env file in the root directory with SUPABASE_URL and SUPABASE_ANON_KEY');
  console.warn('4. Run the SQL schema found in supabase-schema.sql in your Supabase SQL editor');
}

// Crear cliente de Supabase (se inicializará después de cargar la configuración)
export const supabase = {
  get client() {
    if (!supabaseClient) {
      throw new Error('Supabase no está inicializado. Llama a initializeSupabaseConfig() primero.');
    }
    return supabaseClient;
  }
};

// Auth state management
let currentUser = null;

// Get current user
export function getCurrentUser() {
  return currentUser;
}

// Set current user
export function setCurrentUser(user) {
  currentUser = user;
}

// Check if user is authenticated
export function isAuthenticated() {
  return currentUser !== null;
}

// Initialize auth state
export async function initializeAuth() {
  try {
    // Primero inicializar la configuración de Supabase
    const configLoaded = await initializeSupabaseConfig();
    if (!configLoaded) {
      return false;
    }
    
    const { data: { session }, error } = await supabase.client.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      return false;
    }
    
    if (session?.user) {
      currentUser = session.user;
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error initializing auth:', error);
    return false;
  }
}

// Sign up new user
export async function signUp(email, password) {
  try {
    const { data, error } = await supabase.client.auth.signUp({
      email: email,
      password: password,
    });
    
    if (error) {
      throw error;
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Error signing up:', error);
    return { success: false, error: error.message };
  }
}

// Sign in user
export async function signIn(email, password) {
  try {
    const { data, error } = await supabase.client.auth.signInWithPassword({
      email: email,
      password: password,
    });
    
    if (error) {
      throw error;
    }
    
    currentUser = data.user;
    return { success: true, user: data.user };
  } catch (error) {
    console.error('Error signing in:', error);
    return { success: false, error: error.message };
  }
}

// Sign out user
export async function signOut() {
  try {
    const { error } = await supabase.client.auth.signOut();
    
    if (error) {
      throw error;
    }
    
    currentUser = null;
    return { success: true };
  } catch (error) {
    console.error('Error signing out:', error);
    return { success: false, error: error.message };
  }
}

// Listen to auth state changes
export function onAuthStateChange(callback) {
  if (!supabaseClient) {
    console.error('Supabase no está inicializado');
    return;
  }
  
  supabase.client.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      currentUser = session.user;
    } else {
      currentUser = null;
    }
    callback(event, session);
  });
}