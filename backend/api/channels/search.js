const axios = require('axios');
require('dotenv').config();

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Helper function to extract channel ID from various YouTube URL formats
const extractChannelId = (input) => {
  // If it's already a channel ID
  if (input.match(/^UC[a-zA-Z0-9_-]{22}$/)) {
    return input;
  }
  
  // Extract from various URL formats
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/@([a-zA-Z0-9_-]+)/
  ];
  
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return input; // Return as-is if no pattern matches
};

// Enhanced helper function to calculate relevance score
const calculateRelevanceScore = (channel, query) => {
  const title = (channel.title || '').toLowerCase();
  const customUrl = (channel.customUrl || '').toLowerCase();
  const description = (channel.description || '').toLowerCase();
  const queryLower = query.toLowerCase();
  
  let score = 0;
  
  // Exact title match (highest priority)
  if (title === queryLower) score += 100;
  else if (title.includes(queryLower)) score += 50;
  
  // Custom URL match (very high priority)
  if (customUrl === queryLower || customUrl === queryLower.replace('@', '')) score += 90;
  else if (customUrl.includes(queryLower.replace('@', ''))) score += 40;
  
  // Handle/username variations
  if (queryLower.startsWith('@')) {
    const handle = queryLower.substring(1);
    if (customUrl === handle) score += 95;
    if (title.toLowerCase() === handle) score += 85;
  }
  
  // Description match (lower priority)
  if (description.includes(queryLower)) score += 10;
  
  // Subscriber count boost (popular channels)
  const subscribers = parseInt(channel.subscriberCount) || 0;
  if (subscribers > 1000000) score += 20; // 1M+
  else if (subscribers > 100000) score += 10; // 100K+
  else if (subscribers > 10000) score += 5; // 10K+
  
  return score;
};

// Enhanced channel search with multiple strategies
const searchChannelsByStrategy = async (query, strategy = 'general') => {
  const searchQueries = [];
  
  switch (strategy) {
    case 'exact':
      // Try exact matches first
      searchQueries.push(`"${query}"`);
      if (query.startsWith('@')) {
        searchQueries.push(`"${query.substring(1)}"`);
      }
      break;
      
    case 'handle':
      // Handle-based searches
      if (query.startsWith('@')) {
        searchQueries.push(query.substring(1));
      } else {
        searchQueries.push(`@${query}`);
      }
      break;
      
    case 'general':
    default:
      searchQueries.push(query);
      break;
  }
  
  const allChannels = [];
  
  for (const searchQuery of searchQueries) {
    try {
      const searchResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/search`, {
        params: {
          key: YOUTUBE_API_KEY,
          q: searchQuery,
          type: 'channel',
          part: 'snippet',
          maxResults: 25,
          order: 'relevance'
        }
      });
      
      if (searchResponse.data.items && searchResponse.data.items.length > 0) {
        const channelIds = searchResponse.data.items.map(item => item.snippet.channelId);
        const channelsResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/channels`, {
          params: {
            key: YOUTUBE_API_KEY,
            id: channelIds.join(','),
            part: 'snippet,statistics'
          }
        });
        
        if (channelsResponse.data.items) {
          allChannels.push(...channelsResponse.data.items);
        }
      }
    } catch (error) {
      console.error(`Search strategy ${strategy} with query "${searchQuery}" failed:`, error.message);
    }
  }
  
  return allChannels;
};

module.exports = async (req, res) => {
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

  try {
    const { q, strategy = 'smart' } = req.query;
    
    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({ 
        error: 'YouTube API key not configured. Please set YOUTUBE_API_KEY in your environment variables.' 
      });
    }

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    console.log(`Searching for channels with query: "${q}", strategy: ${strategy}`);

    // First try to extract if it's a direct URL or channel ID
    let channelId = extractChannelId(q);
    
    // If it's a direct channel ID or URL, get that specific channel
    if (channelId.match(/^UC[a-zA-Z0-9_-]{22}$/)) {
      console.log(`Direct channel ID detected: ${channelId}`);
      const channelResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/channels`, {
        params: {
          key: YOUTUBE_API_KEY,
          id: channelId,
          part: 'snippet,statistics'
        }
      });

      if (channelResponse.data.items && channelResponse.data.items.length > 0) {
        const channel = channelResponse.data.items[0];
        return res.json({
          channels: [{
            id: channel.id,
            title: channel.snippet.title,
            description: channel.snippet.description,
            customUrl: channel.snippet.customUrl,
            thumbnails: channel.snippet.thumbnails,
            subscriberCount: channel.statistics.subscriberCount,
            videoCount: channel.statistics.videoCount,
            viewCount: channel.statistics.viewCount,
            relevanceScore: 100,
            matchType: 'Direct URL/ID'
          }],
          searchTips: {
            isDirectMatch: true,
            originalQuery: q
          }
        });
      }
    }

    // Multi-strategy search approach
    let allChannels = [];
    
    if (strategy === 'smart') {
      // Try multiple strategies in order of preference
      const strategies = ['exact', 'handle', 'general'];
      
      for (const strat of strategies) {
        const channels = await searchChannelsByStrategy(q, strat);
        allChannels.push(...channels);
        
        // If we get good results early, we can break
        if (channels.length > 0) break;
      }
    } else {
      allChannels = await searchChannelsByStrategy(q, strategy);
    }

    // Remove duplicates and calculate relevance scores
    const uniqueChannels = [];
    const seenIds = new Set();
    
    for (const channel of allChannels) {
      if (!seenIds.has(channel.id)) {
        seenIds.add(channel.id);
        
        const relevanceScore = calculateRelevanceScore({
          title: channel.snippet.title,
          customUrl: channel.snippet.customUrl,
          description: channel.snippet.description,
          subscriberCount: channel.statistics?.subscriberCount
        }, q);
        
        uniqueChannels.push({
          id: channel.id,
          title: channel.snippet.title,
          description: channel.snippet.description,
          customUrl: channel.snippet.customUrl,
          thumbnails: channel.snippet.thumbnails,
          subscriberCount: channel.statistics?.subscriberCount || '0',
          videoCount: channel.statistics?.videoCount || '0',
          viewCount: channel.statistics?.viewCount || '0',
          relevanceScore,
          matchType: relevanceScore >= 80 ? 'Best Match' : relevanceScore >= 40 ? 'Good Match' : 'Possible Match'
        });
      }
    }

    // Sort by relevance score
    uniqueChannels.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Limit to top 10 results
    const topChannels = uniqueChannels.slice(0, 10);

    const searchTips = {
      isDirectMatch: false,
      originalQuery: q,
      totalFound: topChannels.length,
      strategies: strategy === 'smart' ? ['exact', 'handle', 'general'] : [strategy],
      suggestions: topChannels.length === 0 ? [
        'Try using the exact channel name',
        'Use @ symbol for handles (e.g., @channelname)',
        'Try a partial match or broader terms',
        'Check if the channel URL/ID is correct'
      ] : []
    };

    res.json({
      channels: topChannels,
      searchTips
    });

  } catch (error) {
    console.error('Error searching channels:', error.response?.data || error.message);
    
    if (error.response?.status === 403) {
      res.status(403).json({ 
        error: 'YouTube API quota exceeded or invalid API key' 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to search channels',
        details: error.response?.data?.error?.message || error.message
      });
    }
  }
}; 