# ATV Video Streaming Features Documentation

## Overview
This document describes the complete online video streaming solution implemented for the ATV movie/TV app, including torrent exploration, video streaming, and comprehensive subtitle support.

## Features Implemented

### 1. Torrent Exploration & Video Streaming
- **Torrent Analysis**: Automatically explores torrent files to identify video content
- **Smart File Selection**: Intelligently selects the best video file (largest, non-sample file)
- **HTTP Range Streaming**: Supports progressive download and seeking
- **Real-time Progress**: Shows download progress, peer count, and speed
- **Error Handling**: Comprehensive error handling for network issues and invalid torrents

### 2. Comprehensive Subtitle Support

#### A. Torrent-Embedded Subtitles
- Automatically detects subtitle files within torrents (.srt, .vtt)
- Matches subtitle files with video files by name
- Provides dropdown selection for available torrent subtitles
- Real-time loading of subtitle tracks

#### B. Online Subtitle Search
- Search subtitles by movie title and language
- Supports multiple languages (Spanish, English, French, German, Italian, Portuguese)
- Shows subtitle ratings and source information
- Enhanced search with loading indicators and user feedback

#### C. Manual Subtitle Upload
- Upload custom subtitle files (.srt, .vtt, .ass, .ssa, .sub)
- Local storage of uploaded subtitles
- Integration with video player

#### D. Subtitle Controls (VLC-like functionality)
- Enable/Disable subtitles toggle
- Automatic subtitle activation when loaded
- Multiple subtitle track support
- Real-time subtitle switching

### 3. Enhanced User Experience

#### A. Notification System
- Success, error, warning, and info notifications
- Auto-dismiss with manual close option
- Contextual feedback for all operations
- Beautiful gradient styling

#### B. Loading States & Progress
- Detailed loading indicators for all operations
- Real-time torrent download progress
- Buffering status for video playback
- Connection status with peer information

#### C. Error Handling
- Comprehensive error catching and user-friendly messages
- Network timeout handling
- Invalid torrent link detection
- Subtitle loading error recovery

## Server API Endpoints

### Torrent APIs
- `GET /api/torrent/explore` - Explore torrent contents
- `GET /api/torrent/stream/:infoHash/:fileIndex` - Stream video file
- `GET /api/torrent/subtitle/:infoHash/:fileIndex` - Serve subtitle file
- `GET /api/torrent/progress/:infoHash` - Get torrent progress

### Subtitle APIs
- `GET /api/subtitles/search` - Search online subtitles
- `POST /api/subtitles/upload` - Upload subtitle file

## Technical Implementation

### Client-Side Technologies
- **WebTorrent**: P2P torrent streaming in the browser
- **HTML5 Video**: Native video playback with subtitle support
- **Fetch API**: Modern HTTP requests for server communication
- **CSS3**: Modern styling with gradients and animations

### Server-Side Technologies
- **Node.js**: Server runtime
- **Express.js**: Web server framework
- **WebTorrent**: Server-side torrent handling
- **Multer**: File upload handling

### File Structure
```
ATV/
├── server.js                 # Main server file (ES modules)
├── package.json             # Dependencies and module configuration
├── public/
│   ├── app.js              # Enhanced client application
│   ├── index.html          # Updated UI with subtitle controls
│   └── styles.css          # Enhanced styling with notifications
└── uploads/
    └── subtitles/          # Uploaded subtitle storage
```

## Usage Instructions

### For Users
1. **Search Movies**: Use the search functionality to find movies/TV shows
2. **Start Streaming**: Click "Ver online" on any torrent link
3. **Select Video**: System automatically selects the best video file
4. **Manage Subtitles**:
   - Use torrent subtitles if available (automatic detection)
   - Search online subtitles by language
   - Upload your own subtitle files
   - Enable/disable subtitles as needed

### For Developers
1. **Test Functions**: Use browser console commands:
   ```javascript
   testVideoStreamingFeatures(); // Test UI components
   testServerAPIs();            // Test server endpoints
   ```

2. **Debug Mode**: Check browser console for detailed logging
3. **Server Logs**: Monitor server terminal for backend operations

## Browser Compatibility
- **Chrome/Chromium**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: Limited WebTorrent support
- **Edge**: Full support

## Performance Considerations
- **Memory Usage**: WebTorrent stores video chunks in memory
- **Network**: P2P connections may be blocked by some firewalls
- **Storage**: Temporary torrent data cleared on close

## Security Features
- **File Validation**: Subtitle files validated before upload
- **CORS Headers**: Proper cross-origin request handling
- **Input Sanitization**: All user inputs are sanitized
- **Error Boundaries**: Graceful handling of all error scenarios

## Future Enhancements
- [ ] Video quality selection
- [ ] Subtitle synchronization controls
- [ ] Advanced subtitle styling options
- [ ] Playlist support for TV series
- [ ] Chromecast/AirPlay support
- [ ] Offline subtitle caching

## Troubleshooting

### Common Issues
1. **No video files found**: Torrent may not contain video content
2. **Slow loading**: Check internet connection and peer availability
3. **Subtitles not loading**: Verify file format and encoding
4. **Playback issues**: Try refreshing the page or different browser

### Debug Commands
```javascript
// Test notification system
showNotification('Test message', 'success');

// Check current torrent info
console.log(currentTorrentInfo);

// Test subtitle functionality
testVideoStreamingFeatures();
```

## Version History
- **v2.0**: Complete subtitle system with online search and upload
- **v1.5**: Enhanced error handling and notifications
- **v1.0**: Basic torrent streaming functionality

---
*Last updated: June 3, 2025*
