# YouTube Channel Fetcher

A full-stack application that fetches detailed information about YouTube channels using the YouTube Data API v3. Built with Node.js/Express backend and React/Vite frontend.

## Features

- 🔍 Search channels by URL, username, or handle
- ✅ **Customizable Data Selection**: Choose exactly what data to fetch with checkboxes:
  - Basic Info (Title, Description, Custom URL)
  - Statistics (Subscribers, Videos, Views)
  - Channel Avatar/Thumbnails
  - Channel Branding (Banner, Keywords)
  - Content Details (Playlists structure)
  - Topic Categories
  - Localizations
  - Recent Videos (Latest 10)
  - Channel Sections
  - Channel Playlists
- 📊 Display comprehensive channel statistics
- 📥 **Excel Export**: Download all fetched data as organized Excel sheets
- 🎬 Show recent videos, playlists, and channel structure
- 🖼️ Display channel banner and avatar
- 📱 Responsive, modern UI design
- ⚡ Efficient API calls (only fetch what you need)

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- YouTube Data API v3 key from Google Cloud Console

## Getting YouTube API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the YouTube Data API v3
4. Create credentials (API Key)
5. Copy the API key for use in the application

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd youtube-channel-fetcher
```

2. Install dependencies for all packages:
```bash
npm run install-deps
```

3. Create environment file for backend:
```bash
cd backend
echo "YOUTUBE_API_KEY=your_api_key_here" > .env
echo "PORT=5000" >> .env
```

Replace `your_api_key_here` with your actual YouTube API key.

## Usage

### Development Mode

Run both frontend and backend simultaneously:
```bash
npm run dev
```

This will start:
- Backend server on http://localhost:5000
- Frontend development server on http://localhost:5173

### Individual Services

Run backend only:
```bash
npm run server
```

Run frontend only:
```bash
npm run client
```

### Production Build

Build the frontend for production:
```bash
cd frontend
npm run build
```

## API Endpoints

### Backend API

- `GET /api/health` - Health check endpoint
- `POST /api/channel` - Fetch selected channel details

#### Request Body for /api/channel
```json
{
  "channelInput": "channel_url_or_name",
  "options": ["basicInfo", "statistics", "recentVideos"]
}
```

#### Channel Input Formats

The API accepts various input formats:
- Channel URL: `https://youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw`
- Custom URL: `https://youtube.com/@google`
- Username: `google`
- Handle: `@google`
- Channel ID: `UC_x5XG1OV2P6uZZ5FSM9Ttw`

#### Response Format

```json
{
  "basicInfo": {
    "id": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    "title": "Google",
    "description": "Welcome to the official Google channel...",
    "customUrl": "@google",
    "publishedAt": "2005-09-18T21:13:43Z",
    "country": "US"
  },
  "thumbnails": {
    "default": { "url": "...", "width": 88, "height": 88 },
    "medium": { "url": "...", "width": 240, "height": 240 },
    "high": { "url": "...", "width": 800, "height": 800 }
  },
  "statistics": {
    "viewCount": "123456789",
    "subscriberCount": "12345678",
    "videoCount": "1234"
  },
  "branding": {
    "bannerImageUrl": "...",
    "keywords": "..."
  },
  "recentVideos": [
    {
      "id": "video_id",
      "title": "Video Title",
      "description": "Video description...",
      "publishedAt": "2023-01-01T00:00:00Z",
      "thumbnails": { ... }
    }
  ],
  "playlists": [
    {
      "id": "playlist_id",
      "title": "Playlist Title",
      "description": "Playlist description...",
      "videoCount": 25
    }
  ]
}
```

## Project Structure

```
youtube-channel-fetcher/
├── backend/
│   ├── package.json
│   ├── server.js
│   └── .env (create this)
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── package.json
│   └── public/
├── package.json
└── README.md
```

## Technologies Used

### Backend
- Node.js
- Express.js
- Axios for HTTP requests
- CORS for cross-origin requests
- dotenv for environment variables

### Frontend
- React 19
- Vite for build tooling
- Axios for API calls
- React Icons for UI icons
- XLSX.js for Excel export functionality
- Modern CSS with Flexbox and Grid

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.

## Troubleshooting

### Common Issues

1. **API Key Issues**
   - Make sure your YouTube API key is valid
   - Check that the YouTube Data API v3 is enabled in Google Cloud Console
   - Verify the API key is correctly set in the `.env` file

2. **CORS Issues**
   - The backend includes CORS middleware to allow frontend requests
   - Make sure the backend is running on port 5000

3. **Channel Not Found**
   - Try different input formats (URL, username, handle)
   - Some channels might have restricted API access

4. **Rate Limiting**
   - YouTube API has quotas and rate limits
   - If you exceed limits, wait for the quota to reset

### Development Tips

- Use the browser's developer tools to debug API requests
- Check the backend console for detailed error messages
- The `/api/health` endpoint can help verify the backend is running correctly 