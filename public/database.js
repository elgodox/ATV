// Database functions for user data management
import { supabase, getCurrentUser, isAuthenticated } from './supabase-config.js';

// Favorites management
export async function getFavorites() {
  if (!isAuthenticated()) {
    return [];
  }
  
  try {
    const user = getCurrentUser();
    const { data, error } = await supabase.client
      .from('favorites')
      .select('*')
      .eq('user_id', user.id);
    
    if (error) {
      console.error('Error fetching favorites:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error getting favorites:', error);
    return [];
  }
}

export async function addFavorite(movieId, type) {
  if (!isAuthenticated()) {
    throw new Error('User not authenticated');
  }
  
  try {
    const user = getCurrentUser();
    const { data, error } = await supabase.client
      .from('favorites')
      .insert([
        {
          user_id: user.id,
          movie_id: movieId,
          type: type,
          created_at: new Date().toISOString()
        }
      ]);
    
    if (error) {
      throw error;
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Error adding favorite:', error);
    throw error;
  }
}

export async function removeFavorite(movieId, type) {
  if (!isAuthenticated()) {
    throw new Error('User not authenticated');
  }
  
  try {
    const user = getCurrentUser();
    const { error } = await supabase.client
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('movie_id', movieId)
      .eq('type', type);
    
    if (error) {
      throw error;
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error removing favorite:', error);
    throw error;
  }
}

export async function isFavorite(movieId, type) {
  if (!isAuthenticated()) {
    return false;
  }
  
  try {
    const user = getCurrentUser();
    const { data, error } = await supabase.client
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('movie_id', movieId)
      .eq('type', type)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows returned
      console.error('Error checking favorite:', error);
      return false;
    }
    
    return data !== null;
  } catch (error) {
    console.error('Error checking favorite:', error);
    return false;
  }
}

// Watched items management
export async function getWatchedItems() {
  if (!isAuthenticated()) {
    return [];
  }
  
  try {
    const user = getCurrentUser();
    const { data, error } = await supabase.client
      .from('watched_items')
      .select('*')
      .eq('user_id', user.id);
    
    if (error) {
      console.error('Error fetching watched items:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error getting watched items:', error);
    return [];
  }
}

export async function addWatchedItem(movieId, type) {
  if (!isAuthenticated()) {
    throw new Error('User not authenticated');
  }
  
  try {
    const user = getCurrentUser();
    const { data, error } = await supabase.client
      .from('watched_items')
      .insert([
        {
          user_id: user.id,
          movie_id: movieId,
          type: type,
          watched_at: new Date().toISOString()
        }
      ]);
    
    if (error) {
      throw error;
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Error adding watched item:', error);
    throw error;
  }
}

export async function removeWatchedItem(movieId, type) {
  if (!isAuthenticated()) {
    throw new Error('User not authenticated');
  }
  
  try {
    const user = getCurrentUser();
    const { error } = await supabase.client
      .from('watched_items')
      .delete()
      .eq('user_id', user.id)
      .eq('movie_id', movieId)
      .eq('type', type);
    
    if (error) {
      throw error;
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error removing watched item:', error);
    throw error;
  }
}

export async function isWatched(movieId, type) {
  if (!isAuthenticated()) {
    return false;
  }
  
  try {
    const user = getCurrentUser();
    const { data, error } = await supabase.client
      .from('watched_items')
      .select('id')
      .eq('user_id', user.id)
      .eq('movie_id', movieId)
      .eq('type', type)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows returned
      console.error('Error checking watched item:', error);
      return false;
    }
    
    return data !== null;
  } catch (error) {
    console.error('Error checking watched item:', error);
    return false;
  }
}
