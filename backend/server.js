const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

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

// Route to get channel details with selected options
app.post('/api/channel', async (req, res) => {
  try {
    const { channelInput, options } = req.body;
    
    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({ 
        error: 'YouTube API key not configured. Please set YOUTUBE_API_KEY in your environment variables.' 
      });
    }

    if (!channelInput || !options || options.length === 0) {
      return res.status(400).json({ error: 'Channel input and options are required' });
    }

    let channelId = extractChannelId(channelInput);
    
    // If it's not a direct channel ID, try to find it by username or handle
    if (!channelId.match(/^UC[a-zA-Z0-9_-]{22}$/)) {
      const searchResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/search`, {
        params: {
          key: YOUTUBE_API_KEY,
          q: channelInput,
          type: 'channel',
          part: 'snippet',
          maxResults: 1
        }
      });

      if (searchResponse.data.items && searchResponse.data.items.length > 0) {
        channelId = searchResponse.data.items[0].snippet.channelId;
      } else {
        return res.status(404).json({ error: 'Channel not found' });
      }
    }

    const channelData = {};

    // Determine which parts to fetch based on selected options
    const parts = [];
    if (options.includes('basicInfo') || options.includes('thumbnails')) {
      parts.push('snippet');
    }
    if (options.includes('statistics')) {
      parts.push('statistics');
    }
    if (options.includes('branding')) {
      parts.push('brandingSettings');
    }
    if (options.includes('contentDetails')) {
      parts.push('contentDetails');
    }
    if (options.includes('topicDetails')) {
      parts.push('topicDetails');
    }
    if (options.includes('localizations')) {
      parts.push('localizations');
    }

    // Get basic channel details if any core options are selected
    if (parts.length > 0) {
      const channelResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/channels`, {
        params: {
          key: YOUTUBE_API_KEY,
          id: channelId,
          part: parts.join(',')
        }
      });

      if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
        return res.status(404).json({ error: 'Channel not found' });
      }

      const channel = channelResponse.data.items[0];

      // Basic Info
      if (options.includes('basicInfo')) {
        channelData.basicInfo = {
          id: channel.id,
          title: channel.snippet?.title,
          description: channel.snippet?.description,
          customUrl: channel.snippet?.customUrl,
          publishedAt: channel.snippet?.publishedAt,
          country: channel.snippet?.country,
          defaultLanguage: channel.snippet?.defaultLanguage
        };
      }

      // Thumbnails
      if (options.includes('thumbnails')) {
        channelData.thumbnails = channel.snippet?.thumbnails;
      }

      // Statistics
      if (options.includes('statistics')) {
        channelData.statistics = {
          viewCount: channel.statistics?.viewCount,
          subscriberCount: channel.statistics?.subscriberCount,
          videoCount: channel.statistics?.videoCount,
          hiddenSubscriberCount: channel.statistics?.hiddenSubscriberCount
        };
      }

      // Branding
      if (options.includes('branding')) {
        channelData.branding = {
          bannerImageUrl: channel.brandingSettings?.image?.bannerExternalUrl,
          bannerMobileImageUrl: channel.brandingSettings?.image?.bannerMobileExtraHdImageUrl,
          keywords: channel.brandingSettings?.channel?.keywords,
          unsubscribedTrailer: channel.brandingSettings?.channel?.unsubscribedTrailer,
          defaultTab: channel.brandingSettings?.channel?.defaultTab
        };
      }

      // Content Details
      if (options.includes('contentDetails')) {
        channelData.contentDetails = {
          uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads,
          likesPlaylistId: channel.contentDetails?.relatedPlaylists?.likes,
          favoritesPlaylistId: channel.contentDetails?.relatedPlaylists?.favorites
        };
      }

      // Topic Details
      if (options.includes('topicDetails')) {
        channelData.topicDetails = {
          topicIds: channel.topicDetails?.topicIds,
          topicCategories: channel.topicDetails?.topicCategories
        };
      }

      // Localizations
      if (options.includes('localizations')) {
        channelData.localizations = channel.localizations;
      }
    }

    // Get recent videos if requested
    if (options.includes('recentVideos')) {
      try {
        const videosResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/search`, {
          params: {
            key: YOUTUBE_API_KEY,
            channelId: channelId,
            part: 'snippet',
            order: 'date',
            maxResults: 10,
            type: 'video'
          }
        });

        // Get detailed information for recent videos
        const videoIds = videosResponse.data.items.map(video => video.id.videoId);
        console.log(`Found ${videoIds.length} recent video IDs`);
        
        if (videoIds.length > 0) {
          const detailsResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/videos`, {
            params: {
              key: YOUTUBE_API_KEY,
              id: videoIds.join(','),
              part: 'snippet,statistics,contentDetails,status'
            }
          });

          console.log(`Retrieved details for ${detailsResponse.data.items.length} recent videos`);

          channelData.recentVideos = detailsResponse.data.items.map(video => {
            // Debug first recent video
            if (video === detailsResponse.data.items[0]) {
              console.log('Sample recent video data:', {
                id: video.id,
                title: video.snippet?.title,
                hasDescription: !!video.snippet?.description,
                descriptionLength: video.snippet?.description?.length || 0,
                tagCount: video.snippet?.tags?.length || 0
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
            viewCount: video.statistics?.viewCount || '0',
            likeCount: video.statistics?.likeCount || '0',
            commentCount: video.statistics?.commentCount || '0',
            duration: parseDuration(video.contentDetails?.duration),
            definition: video.contentDetails?.definition,
            caption: video.contentDetails?.caption
            };
          });
        } else {
          channelData.recentVideos = [];
        }
      } catch (error) {
        console.error('Error fetching recent videos:', error.message);
        channelData.recentVideos = [];
      }
    }

    // Get all videos with detailed information if requested
    if (options.includes('allVideos')) {
      try {
        console.log('Starting to fetch all videos for channel:', channelId);
        
        // First, get the uploads playlist ID
        let uploadsPlaylistId = null;
        
        if (channelData.contentDetails?.uploadsPlaylistId) {
          uploadsPlaylistId = channelData.contentDetails.uploadsPlaylistId;
          console.log('Found uploads playlist ID from existing data:', uploadsPlaylistId);
        } else {
          // Get the uploads playlist ID from channel details
          console.log('Fetching uploads playlist ID from channel details...');
          const channelForUploads = await axios.get(`${YOUTUBE_API_BASE_URL}/channels`, {
            params: {
              key: YOUTUBE_API_KEY,
              id: channelId,
              part: 'contentDetails'
            }
          });
          uploadsPlaylistId = channelForUploads.data.items[0]?.contentDetails?.relatedPlaylists?.uploads;
          console.log('Retrieved uploads playlist ID:', uploadsPlaylistId);
        }

        if (uploadsPlaylistId) {
          const allVideoIds = [];
          let nextPageToken = '';
          let pageCount = 0;
          
          console.log('Fetching video IDs from uploads playlist...');
          
          // Get all video IDs from the uploads playlist (pagination)
          do {
            pageCount++;
            console.log(`Fetching page ${pageCount}, current total videos: ${allVideoIds.length}`);
            
            const playlistParams = {
              key: YOUTUBE_API_KEY,
              playlistId: uploadsPlaylistId,
              part: 'contentDetails',
              maxResults: 50
            };
            
            if (nextPageToken) {
              playlistParams.pageToken = nextPageToken;
            }
            
            const playlistResponse = await axios.get(`${YOUTUBE_API_BASE_URL}/playlistItems`, {
              params: playlistParams
            });

            console.log(`Page ${pageCount} returned ${playlistResponse.data.items.length} videos`);
            
            const videoIds = playlistResponse.data.items.map(item => item.contentDetails.videoId);
            allVideoIds.push(...videoIds);
            nextPageToken = playlistResponse.data.nextPageToken;
            
            console.log(`Next page token: ${nextPageToken ? 'Present' : 'None'}`);

            // Limit to reasonable number of videos to avoid timeout
            if (allVideoIds.length >= 500) {
              console.log(`Limiting to first 500 videos out of potentially more`);
              break;
            }
            
            // Add delay between requests to respect rate limits
            if (nextPageToken) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } while (nextPageToken);
          
          console.log(`Total video IDs collected: ${allVideoIds.length}`);

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
app.get('/api/health', (req, res) => {
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
      health: '/api/health',
      channel: '/api/channel/:channelInput'
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`YouTube API Key configured: ${!!YOUTUBE_API_KEY}`);
}); 