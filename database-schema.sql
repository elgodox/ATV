-- Watch Progress Table Schema for ATV Application
-- This table stores viewing progress for movies and TV shows along with torrent information

-- Create the watch_progress table
CREATE TABLE IF NOT EXISTS public.watch_progress (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Content identification
    content_type VARCHAR(10) NOT NULL CHECK (content_type IN ('movie', 'tv')),
    tmdb_id INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    
    -- TV series specific fields
    season_number INTEGER NULL,
    episode_number INTEGER NULL,
    
    -- Progress tracking
    current_time DECIMAL(10,2) NOT NULL DEFAULT 0, -- Current playback position in seconds
    total_duration DECIMAL(10,2) NULL, -- Total duration in seconds
    progress_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN total_duration > 0 THEN (current_time / total_duration * 100)
            ELSE 0 
        END
    ) STORED,
    
    -- Torrent information for resuming
    torrent_magnet_uri TEXT NULL, -- Magnet URI of the torrent
    torrent_hash VARCHAR(40) NULL, -- Info hash of the torrent
    torrent_file_index INTEGER NULL, -- Index of the video file in the torrent
    torrent_file_name VARCHAR(500) NULL, -- Name of the video file
    torrent_file_size BIGINT NULL, -- Size of the video file in bytes
    torrent_quality VARCHAR(20) NULL, -- Quality (1080p, 720p, etc.)
    
    -- Additional metadata
    last_watched TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure unique progress per user per content item
    UNIQUE(user_id, content_type, tmdb_id, season_number, episode_number)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_watch_progress_user_id ON public.watch_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_progress_content ON public.watch_progress(content_type, tmdb_id);
CREATE INDEX IF NOT EXISTS idx_watch_progress_last_watched ON public.watch_progress(last_watched DESC);
CREATE INDEX IF NOT EXISTS idx_watch_progress_torrent_hash ON public.watch_progress(torrent_hash) WHERE torrent_hash IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.watch_progress ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own watch progress" ON public.watch_progress
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watch progress" ON public.watch_progress
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watch progress" ON public.watch_progress
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own watch progress" ON public.watch_progress
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_watch_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic updated_at updates
CREATE TRIGGER update_watch_progress_updated_at_trigger
    BEFORE UPDATE ON public.watch_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_watch_progress_updated_at();

-- Grant necessary permissions
GRANT ALL ON public.watch_progress TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.watch_progress_id_seq TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.watch_progress IS 'Stores viewing progress and torrent information for movies and TV shows';
COMMENT ON COLUMN public.watch_progress.current_time IS 'Current playback position in seconds';
COMMENT ON COLUMN public.watch_progress.total_duration IS 'Total duration of the video in seconds';
COMMENT ON COLUMN public.watch_progress.progress_percentage IS 'Calculated progress percentage (auto-generated)';
COMMENT ON COLUMN public.watch_progress.torrent_magnet_uri IS 'Magnet URI to resume the same torrent';
COMMENT ON COLUMN public.watch_progress.torrent_hash IS 'Torrent info hash for identification';
COMMENT ON COLUMN public.watch_progress.torrent_file_index IS 'Index of the video file within the torrent';