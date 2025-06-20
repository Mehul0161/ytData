require('dotenv').config();

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

module.exports = (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  res.json({ 
    message: 'YouTube Analytics Pro API',
    version: '1.0.0',
    status: 'OK',
    apiKeyConfigured: !!YOUTUBE_API_KEY,
    endpoints: {
      health: '/api/health',
      channelSearch: '/api/channels/search',
      channelData: '/api/channel'
    },
    documentation: {
      search: 'GET /api/channels/search?q=channelname&strategy=smart',
      analyze: 'POST /api/channel with { channelId, options }'
    }
  });
}; 