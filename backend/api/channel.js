const axios = require('axios');
require('dotenv').config();

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

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

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
}; 