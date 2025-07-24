# Watch Progress Tracking Implementation

## Overview
This implementation adds comprehensive watch progress tracking to the ATV streaming application, allowing users to save their viewing progress and resume from where they left off, including torrent information for seamless resuming.

## Database Schema

### Table: `watch_progress`
The application uses a PostgreSQL table to store viewing progress:

```sql
CREATE TABLE watch_progress (
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
    current_time DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_duration DECIMAL(10,2) NULL,
    progress_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN total_duration > 0 THEN (current_time / total_duration * 100)
            ELSE 0 
        END
    ) STORED,
    
    -- Torrent information for resuming
    torrent_magnet_uri TEXT NULL,
    torrent_hash VARCHAR(40) NULL,
    torrent_file_index INTEGER NULL,
    torrent_file_name VARCHAR(500) NULL,
    torrent_file_size BIGINT NULL,
    torrent_quality VARCHAR(20) NULL,
    
    -- Metadata
    last_watched TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, content_type, tmdb_id, season_number, episode_number)
);
```

## API Endpoints

### 1. Save/Update Watch Progress
**POST** `/api/watch-progress`

Save or update viewing progress for a user.

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "content_type": "movie", // or "tv"
  "tmdb_id": 123456,
  "title": "Movie Title",
  "season_number": 1, // Optional, for TV shows
  "episode_number": 1, // Optional, for TV shows
  "current_time": 300.5, // Current playback position in seconds
  "total_duration": 7200, // Total duration in seconds (optional)
  "torrent_magnet_uri": "magnet:?xt=urn:btih:...", // Optional
  "torrent_hash": "abc123...", // Optional
  "torrent_file_index": 0, // Optional
  "torrent_file_name": "movie.mp4", // Optional
  "torrent_file_size": 1073741824, // Optional, in bytes
  "torrent_quality": "1080p" // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Watch progress saved successfully",
  "data": {
    "id": 1,
    "user_id": "user-uuid",
    "content_type": "movie",
    "tmdb_id": 123456,
    "title": "Movie Title",
    "current_time": 300.5,
    "progress_percentage": 4.17,
    // ... other fields
  }
}
```

### 2. Get Watch Progress for Specific Content
**GET** `/api/watch-progress/{content_type}/{tmdb_id}`

Get viewing progress for a specific movie or TV episode.

**Parameters:**
- `content_type`: "movie" or "tv"
- `tmdb_id`: TMDb ID of the content

**Query Parameters (for TV shows):**
- `season_number`: Season number
- `episode_number`: Episode number

**Response:**
```json
{
  "id": 1,
  "user_id": "user-uuid",
  "content_type": "tv",
  "tmdb_id": 123456,
  "title": "Series Title",
  "season_number": 1,
  "episode_number": 5,
  "current_time": 1200.0,
  "total_duration": 2700.0,
  "progress_percentage": 44.44,
  "torrent_hash": "abc123...",
  "last_watched": "2024-01-15T10:30:00Z"
}
```

### 3. Get Recent Watch Progress
**GET** `/api/watch-progress`

Get recent viewing progress for the authenticated user.

**Query Parameters:**
- `limit`: Number of items to return (default: 20, max: 100)
- `content_type`: Filter by "movie" or "tv" (optional)

**Response:**
```json
[
  {
    "id": 1,
    "content_type": "movie",
    "tmdb_id": 123456,
    "title": "Movie Title",
    "current_time": 300.5,
    "progress_percentage": 4.17,
    "last_watched": "2024-01-15T10:30:00Z"
  },
  // ... more items
]
```

### 4. Delete Watch Progress
**DELETE** `/api/watch-progress/{content_type}/{tmdb_id}`

Remove viewing progress for specific content.

### 5. Get Progress by Torrent Hash
**GET** `/api/watch-progress/by-torrent/{torrent_hash}`

Get viewing progress associated with a specific torrent.

## Frontend Implementation

### Progress Tracking
The frontend automatically tracks viewing progress:

1. **Automatic Saving**: Progress is saved every 10 seconds while playing
2. **Resume Dialog**: When starting a video with existing progress, users are prompted to resume
3. **Continue Watching Filter**: New filter option to show recently watched content

### Key Functions

#### `saveWatchProgress(currentTime, totalDuration)`
Saves current viewing progress to the server.

#### `loadWatchProgress(content_type, tmdb_id, season, episode)`
Loads existing progress for content.

#### `startWatchProgressTracking()`
Begins automatic progress tracking during video playback.

#### `stopWatchProgressTracking()`
Stops progress tracking and saves final position.

### UI Components

1. **Continue Watching Filter**: Toggle button to view recently watched content
2. **Resume Dialog**: Confirmation dialog to continue from saved position
3. **Progress Indicators**: Visual indicators showing viewing progress on content cards

## Setup Instructions

### 1. Database Setup
Execute the SQL schema in your Supabase project:
```bash
# Run the database-schema.sql file in your Supabase SQL editor
```

### 2. Environment Variables
Configure the following environment variables:
```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. Row Level Security (RLS)
The schema includes RLS policies that ensure users can only access their own progress data.

## Features

### ✅ Completed Features
- Automatic progress saving during video playback
- Resume functionality with user confirmation
- Continue watching filter in UI
- Torrent information storage for seamless resuming
- Cross-session persistence
- Progress percentage calculation
- TV show episode tracking
- Recent viewing history

### 🔄 Graceful Degradation
The application gracefully handles missing database configuration:
- API endpoints return appropriate error messages
- Frontend continues to work without progress tracking
- No crashes or broken functionality

## Security Considerations

1. **Authentication Required**: All endpoints require valid user authentication
2. **User Isolation**: RLS policies prevent access to other users' data
3. **Input Validation**: Server validates all input parameters
4. **SQL Injection Prevention**: Uses parameterized queries through Supabase client

## Performance Optimizations

1. **Batch Updates**: Progress is saved at intervals, not continuously
2. **Efficient Queries**: Optimized database queries with proper indexing
3. **Minimal Data Transfer**: Only essential progress data is transmitted
4. **Caching**: Client-side caching reduces database calls

## Error Handling

The implementation includes comprehensive error handling:
- Database connection failures
- Authentication errors
- Invalid input validation
- Network timeouts
- Graceful degradation when services are unavailable