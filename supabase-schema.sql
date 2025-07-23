-- SQL to create the required tables in Supabase
-- Run these commands in your Supabase SQL editor

-- Create favorites table
CREATE TABLE IF NOT EXISTS favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id INTEGER NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('movie', 'tv')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, movie_id, type)
);

-- Create watched_items table
CREATE TABLE IF NOT EXISTS watched_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id INTEGER NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('movie', 'tv')),
  watched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, movie_id, type)
);

-- Enable Row Level Security (RLS)
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE watched_items ENABLE ROW LEVEL SECURITY;

-- Create policies for favorites table
CREATE POLICY "Users can only access their own favorites" ON favorites
  FOR ALL USING (auth.uid() = user_id);

-- Create policies for watched_items table  
CREATE POLICY "Users can only access their own watched items" ON watched_items
  FOR ALL USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_movie_id ON favorites(movie_id);
CREATE INDEX IF NOT EXISTS idx_watched_items_user_id ON watched_items(user_id);
CREATE INDEX IF NOT EXISTS idx_watched_items_movie_id ON watched_items(movie_id);