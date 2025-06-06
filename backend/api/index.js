const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// YouTube API configuration
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Function to parse ISO 8601 duration format (PT3M3S) to readable format
const parseDuration = (duration) => {
  if (!duration) return 'Unknown';
  
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return duration;
  
  const hours = parseInt(match[1]) || 0;
  const minutes = parseInt(match[2]) || 0;
  const seconds = parseInt(match[3]) || 0;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
};

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

// Route to search for channels
app.get('/channels/search', async (req, res) => {
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
});

// Route to get channel data with selected options
app.post('/channel', async (req, res) => {
  try {
    const { channelId, options } = req.body;
    
    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({ 
        error: 'YouTube API key not configured. Please set YOUTUBE_API_KEY in your environment variables.' 
      });
    }

    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }

    if (!options || options.length === 0) {
      return res.status(400).json({ error: 'At least one data option must be selected' });
    }

    console.log(`Fetching channel data for ID: ${channelId} with options:`, options);

    // Determine which parts to fetch based on selected options
    const parts = [];
    if (options.includes('basicInfo') || options.includes('thumbnails')) parts.push('snippet');
    if (options.includes('statistics')) parts.push('statistics');
    if (options.includes('branding')) parts.push('brandingSettings');
    if (options.includes('contentDetails')) parts.push('contentDetails');
    if (options.includes('topicDetails')) parts.push('topicDetails');
    if (options.includes('localizations')) parts.push('localizations');
    
    // Remove duplicates
    const uniqueParts = [...new Set(parts)];
    
    if (uniqueParts.length === 0) {
      uniqueParts.push('snippet'); // Always include snippet as fallback
    }

    console.log(`Fetching parts: ${uniqueParts.join(', ')}`);

    // Get main channel data
    const channelResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/channels`, {
      params: {
        key: YOUTUBE_API_KEY,
        id: channelId,
        part: uniqueParts.join(',')
      }
    });

    if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const channel = channelResponse.data.items[0];
    const channelData = {};

    // Process basic info
    if (options.includes('basicInfo')) {
      channelData.basicInfo = {
        title: channel.snippet?.title,
        description: channel.snippet?.description,
        customUrl: channel.snippet?.customUrl,
        publishedAt: channel.snippet?.publishedAt,
        country: channel.snippet?.country,
        defaultLanguage: channel.snippet?.defaultLanguage
      };
    }

    // Process statistics
    if (options.includes('statistics')) {
      channelData.statistics = {
        subscriberCount: channel.statistics?.subscriberCount,
        videoCount: channel.statistics?.videoCount,
        viewCount: channel.statistics?.viewCount,
        hiddenSubscriberCount: channel.statistics?.hiddenSubscriberCount
      };
    }

    // Process thumbnails
    if (options.includes('thumbnails')) {
      channelData.thumbnails = channel.snippet?.thumbnails;
    }

    // Process branding
    if (options.includes('branding')) {
      channelData.branding = {
        image: channel.brandingSettings?.image,
        channel: channel.brandingSettings?.channel,
        keywords: channel.brandingSettings?.channel?.keywords,
        unsubscribedTrailer: channel.brandingSettings?.channel?.unsubscribedTrailer,
        featuredChannelsTitle: channel.brandingSettings?.channel?.featuredChannelsTitle,
        featuredChannelsUrls: channel.brandingSettings?.channel?.featuredChannelsUrls
      };
    }

    // Process content details
    if (options.includes('contentDetails')) {
      channelData.contentDetails = channel.contentDetails;
    }

    // Process topic details
    if (options.includes('topicDetails')) {
      channelData.topicDetails = channel.topicDetails;
    }

    // Process localizations
    if (options.includes('localizations')) {
      channelData.localizations = channel.localizations;
    }

    // Get recent videos if requested
    if (options.includes('recentVideos')) {
      try {
        const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
        if (uploadsPlaylistId) {
          const recentVideosResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/playlistItems`, {
            params: {
              key: YOUTUBE_API_KEY,
              playlistId: uploadsPlaylistId,
              part: 'snippet,contentDetails',
              maxResults: 10
            }
          });

          const videoIds = recentVideosResponse.data.items.map(item => item.contentDetails.videoId);
          
          if (videoIds.length > 0) {
            const videoDetailsResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/videos`, {
              params: {
                key: YOUTUBE_API_KEY,
                id: videoIds.join(','),
                part: 'snippet,statistics,contentDetails'
              }
            });

            channelData.recentVideos = videoDetailsResponse.data.items.map(video => ({
              id: video.id,
              title: video.snippet?.title,
              description: video.snippet?.description,
              publishedAt: video.snippet?.publishedAt,
              thumbnails: video.snippet?.thumbnails,
              duration: parseDuration(video.contentDetails?.duration),
              viewCount: video.statistics?.viewCount,
              likeCount: video.statistics?.likeCount,
              commentCount: video.statistics?.commentCount
            }));
          }
        }
      } catch (error) {
        console.error('Error fetching recent videos:', error.message);
        channelData.recentVideos = [];
      }
    }

    // Get all videos with detailed information if requested
    if (options.includes('allVideos')) {
      try {
        const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
        console.log(`Uploads playlist ID: ${uploadsPlaylistId}`);
        
        if (uploadsPlaylistId) {
          // Get all video IDs from the uploads playlist
          let allVideoIds = [];
          let nextPageToken = '';
          let pageCount = 0;
          const maxPages = 10; // Limit to prevent infinite loops (10 pages = ~500 videos)

          console.log('Starting to fetch all video IDs...');
          
          do {
            try {
              const playlistResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/playlistItems`, {
                params: {
                  key: YOUTUBE_API_KEY,
                  playlistId: uploadsPlaylistId,
                  part: 'contentDetails',
                  maxResults: 50,
                  pageToken: nextPageToken
                }
              });

              console.log(`Page ${pageCount + 1}: Found ${playlistResponse.data.items.length} videos`);
              
              const pageVideoIds = playlistResponse.data.items.map(item => item.contentDetails.videoId);
              allVideoIds.push(...pageVideoIds);
              
              nextPageToken = playlistResponse.data.nextPageToken;
              pageCount++;
              
              console.log(`Total videos collected so far: ${allVideoIds.length}`);
              
            } catch (pageError) {
              console.error(`Error fetching page ${pageCount + 1}:`, pageError.message);
              break;
            }
          } while (nextPageToken && pageCount < maxPages);

          console.log(`Finished collecting video IDs. Total: ${allVideoIds.length} videos`);

          // Get detailed video information in batches of 50 (API limit)
          const allVideosData = [];
          const batchSize = 50;
          
          console.log(`Fetching detailed video information in batches...`);
          
          for (let i = 0; i < allVideoIds.length; i += batchSize) {
            const batchIds = allVideoIds.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(allVideoIds.length / batchSize);
            
            console.log(`Processing batch ${batchNumber}/${totalBatches} (${batchIds.length} videos)`);
            
            try {
              const videoDetailsResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/videos`, {
                params: {
                  key: YOUTUBE_API_KEY,
                  id: batchIds.join(','),
                  part: 'snippet,statistics,contentDetails,status'
                }
              });

              console.log(`Batch ${batchNumber} returned ${videoDetailsResponse.data.items.length} video details`);

              const batchVideos = videoDetailsResponse.data.items.map(video => {
                // Debug first video in first batch
                if (i === 0 && video === videoDetailsResponse.data.items[0]) {
                  console.log('Sample video data structure:', {
                    id: video.id,
                    title: video.snippet?.title,
                    hasDescription: !!video.snippet?.description,
                    descriptionLength: video.snippet?.description?.length || 0,
                    tagCount: video.snippet?.tags?.length || 0,
                    tags: video.snippet?.tags?.slice(0, 3) || [],
                    duration: video.contentDetails?.duration
                  });
                }
                
                return {
                id: video.id,
                title: video.snippet?.title,
                description: video.snippet?.description,
                publishedAt: video.snippet?.publishedAt,
                thumbnails: video.snippet?.thumbnails,
                channelTitle: video.snippet?.channelTitle,
                tags: video.snippet?.tags || [],
                categoryId: video.snippet?.categoryId,
                defaultLanguage: video.snippet?.defaultLanguage,
                defaultAudioLanguage: video.snippet?.defaultAudioLanguage,
                liveBroadcastContent: video.snippet?.liveBroadcastContent,
                // Statistics
                viewCount: video.statistics?.viewCount || '0',
                likeCount: video.statistics?.likeCount || '0',
                dislikeCount: video.statistics?.dislikeCount || '0',
                favoriteCount: video.statistics?.favoriteCount || '0',
                commentCount: video.statistics?.commentCount || '0',
                // Content Details
                duration: parseDuration(video.contentDetails?.duration),
                rawDuration: video.contentDetails?.duration,
                definition: video.contentDetails?.definition,
                caption: video.contentDetails?.caption,
                licensedContent: video.contentDetails?.licensedContent,
                projection: video.contentDetails?.projection,
                // Status
                uploadStatus: video.status?.uploadStatus,
                privacyStatus: video.status?.privacyStatus,
                license: video.status?.license,
                embeddable: video.status?.embeddable,
                publicStatsViewable: video.status?.publicStatsViewable,
                madeForKids: video.status?.madeForKids,
                selfDeclaredMadeForKids: video.status?.selfDeclaredMadeForKids
                };
              });

              allVideosData.push(...batchVideos);
              console.log(`Batch ${batchNumber} processed successfully. Total videos so far: ${allVideosData.length}`);
            } catch (batchError) {
              console.error(`Error fetching video batch ${i}-${i + batchSize}:`, batchError.message);
            }

            // Add small delay between batches to respect rate limits
            if (i + batchSize < allVideoIds.length) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

          // Sort by publish date (newest first)
          channelData.allVideos = allVideosData.sort((a, b) => 
            new Date(b.publishedAt) - new Date(a.publishedAt)
          );

          console.log(`Fetched detailed data for ${channelData.allVideos.length} videos`);
        } else {
          console.error('Could not find uploads playlist ID');
          channelData.allVideos = [];
        }
      } catch (error) {
        console.error('Error fetching all videos:', error.message);
        channelData.allVideos = [];
      }
    }

    // Get channel playlists if requested
    if (options.includes('playlists')) {
      try {
        const playlistsResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/playlists`, {
          params: {
            key: YOUTUBE_API_KEY,
            channelId: channelId,
            part: 'snippet,contentDetails',
            maxResults: 50
          }
        });

        channelData.playlists = playlistsResponse.data.items.map(playlist => ({
          id: playlist.id,
          title: playlist.snippet?.title,
          description: playlist.snippet?.description,
          publishedAt: playlist.snippet?.publishedAt,
          thumbnails: playlist.snippet?.thumbnails,
          videoCount: playlist.contentDetails?.itemCount,
          privacy: playlist.snippet?.defaultLanguage
        }));
      } catch (error) {
        console.error('Error fetching playlists:', error.message);
        channelData.playlists = [];
      }
    }

    // Get channel sections if requested
    if (options.includes('channelSections')) {
      try {
        const sectionsResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/channelSections`, {
          params: {
            key: YOUTUBE_API_KEY,
            channelId: channelId,
            part: 'snippet,contentDetails'
          }
        });

        channelData.channelSections = sectionsResponse.data.items.map(section => ({
          id: section.id,
          type: section.snippet?.type,
          style: section.snippet?.style,
          title: section.snippet?.title,
          position: section.snippet?.position,
          playlistIds: section.contentDetails?.playlists,
          channelIds: section.contentDetails?.channels
        }));
      } catch (error) {
        console.error('Error fetching channel sections:', error.message);
        channelData.channelSections = [];
      }
    }

    res.json(channelData);

  } catch (error) {
    console.error('Error fetching channel data:', error.response?.data || error.message);
    
    if (error.response?.status === 403) {
      res.status(403).json({ 
        error: 'YouTube API quota exceeded or invalid API key' 
      });
    } else if (error.response?.status === 404) {
      res.status(404).json({ error: 'Channel not found' });
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch channel data',
        details: error.response?.data?.error?.message || error.message
      });
    }
  }
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'YouTube Channel Fetcher API is running',
    apiKeyConfigured: !!YOUTUBE_API_KEY
  });
});

// Default route
app.get('/', (req, res) => {
  res.json({ 
    message: 'YouTube Channel Fetcher API',
    endpoints: {
      health: '/health',
      channelSearch: '/channels/search',
      channelData: '/channel'
    }
  });
});

// Export the Express app for Vercel
module.exports = app; 