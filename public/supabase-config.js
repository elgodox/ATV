// Supabase configuration
import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2';

// Supabase configuration - these should be replaced with your actual values
// For production, these values should come from environment variables
const SUPABASE_URL = window.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'your-anon-key';

// Show warning if using placeholder values
if (SUPABASE_URL === 'https://your-project.supabase.co' || SUPABASE_ANON_KEY === 'your-anon-key') {
  console.warn('⚠️ Using placeholder Supabase configuration. Please update SUPABASE_URL and SUPABASE_ANON_KEY with your actual Supabase project values.');
}

// Create Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    const { data: { session }, error } = await supabase.auth.getSession();
    
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
    const { data, error } = await supabase.auth.signUp({
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
    const { data, error } = await supabase.auth.signInWithPassword({
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
    const { error } = await supabase.auth.signOut();
    
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
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      currentUser = session.user;
    } else {
      currentUser = null;
    }
    callback(event, session);
  });
}