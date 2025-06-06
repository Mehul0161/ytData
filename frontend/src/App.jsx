import React, { useState } from 'react'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { 
  FaSearch, 
  FaUsers, 
  FaVideo, 
  FaEye, 
  FaCalendarAlt, 
  FaExternalLinkAlt, 
  FaExclamationCircle,
  FaDownload,
  FaCheckSquare,
  FaSquare,
  FaYoutube,
  FaChartLine,
  FaFilter,
  FaInfoCircle
} from 'react-icons/fa'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { BiSelectMultiple } from 'react-icons/bi'
import { MdClear } from 'react-icons/md'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (
  import.meta.env.MODE === 'production' 
    ? '/api' // Use relative path in production
    : 'http://localhost:5000/api' // Use localhost only in development
)

// Available data options that users can select
const DATA_OPTIONS = [
  { id: 'basicInfo', label: 'Basic Info (Title, Description)', description: 'Channel name, description, custom URL' },
  { id: 'statistics', label: 'Statistics', description: 'Subscriber count, video count, view count' },
  { id: 'thumbnails', label: 'Channel Avatar', description: 'Profile picture/avatar images' },
  { id: 'branding', label: 'Channel Branding', description: 'Banner image, keywords, trailer video' },
  { id: 'contentDetails', label: 'Content Details', description: 'Uploads playlist, content guidelines' },
  { id: 'topicDetails', label: 'Topic Categories', description: 'Channel topic categories and keywords' },
  { id: 'localizations', label: 'Localizations', description: 'Channel name/description in different languages' },
  { id: 'recentVideos', label: 'Recent Videos', description: 'Latest 10 videos from the channel' },
  { id: 'allVideos', label: 'All Videos (Detailed)', description: 'Complete list with titles, IDs, URLs, views, descriptions, publish dates' },
  { id: 'channelSections', label: 'Channel Sections', description: 'Channel homepage sections and playlists' },
  { id: 'playlists', label: 'Channel Playlists', description: 'All public playlists created by the channel' }
]

function App() {
  const [channelInput, setChannelInput] = useState('')
  const [selectedOptions, setSelectedOptions] = useState(['basicInfo', 'statistics'])
  const [channelData, setChannelData] = useState(null)
  const [searchResults, setSearchResults] = useState([])
  const [selectedChannel, setSelectedChannel] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [error, setError] = useState('')
  const [loadingProgress, setLoadingProgress] = useState('')
  const [showOptionsHelp, setShowOptionsHelp] = useState(false)
  const [expandedSections, setExpandedSections] = useState({})
  const [searchHistory, setSearchHistory] = useState([])
  const [filterOptions, setFilterOptions] = useState({
    showBasic: true,
    showAnalytics: true,
    showContent: true
  })
  const [currentStep, setCurrentStep] = useState('search') // 'search', 'select', 'analyze'
  const [searchStrategy, setSearchStrategy] = useState('smart')
  const [searchTips, setSearchTips] = useState(null)

  const formatNumber = (num) => {
    if (!num) return '0'
    const number = parseInt(num)
    if (number >= 1000000000) {
      return (number / 1000000000).toFixed(1) + 'B'
    } else if (number >= 1000000) {
      return (number / 1000000).toFixed(1) + 'M'
    } else if (number >= 1000) {
      return (number / 1000).toFixed(1) + 'K'
    }
    return number.toLocaleString()
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const handleOptionChange = (optionId) => {
    setSelectedOptions(prev => {
      if (prev.includes(optionId)) {
        return prev.filter(id => id !== optionId)
      } else {
        return [...prev, optionId]
      }
    })
  }

  const selectAll = () => {
    setSelectedOptions(DATA_OPTIONS.map(option => option.id))
  }

  const selectNone = () => {
    setSelectedOptions([])
  }

  const selectByCategory = (category) => {
    const basicOptions = ['basicInfo', 'thumbnails', 'statistics']
    const analyticsOptions = ['statistics', 'recentVideos', 'allVideos']
    const contentOptions = ['branding', 'contentDetails', 'topicDetails', 'localizations', 'channelSections', 'playlists']
    
    let categoryOptions = []
    switch(category) {
      case 'basic': categoryOptions = basicOptions; break;
      case 'analytics': categoryOptions = analyticsOptions; break;
      case 'content': categoryOptions = contentOptions; break;
    }
    
    setSelectedOptions(prev => {
      const newOptions = [...new Set([...prev, ...categoryOptions])]
      return newOptions
    })
  }

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }))
  }

  const handleChannelSearch = async (e) => {
    e.preventDefault()
    if (!channelInput.trim()) return

    setSearchLoading(true)
    setError('')
    setSearchResults([])

    // Add to search history
    const newSearch = channelInput.trim()
    if (newSearch && !searchHistory.includes(newSearch)) {
      setSearchHistory(prev => [newSearch, ...prev].slice(0, 5))
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/channels/search`, {
        params: { 
          q: newSearch,
          strategy: searchStrategy
        }
      })
      
      setSearchResults(response.data.channels)
      setSearchTips(response.data.searchTips)
      setCurrentStep(response.data.channels.length > 1 ? 'select' : 'analyze')
      
      // If only one channel found, auto-select it
      if (response.data.channels.length === 1) {
        setSelectedChannel(response.data.channels[0])
      } else if (response.data.channels.length === 0) {
        setError(response.data.message || 'No channels found')
      }
      
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to search channels')
    } finally {
      setSearchLoading(false)
    }
  }

  const handleChannelSelect = (channel) => {
    setSelectedChannel(channel)
    setCurrentStep('analyze')
  }

  const handleAnalyzeChannel = async () => {
    if (!selectedChannel || selectedOptions.length === 0) return

    setLoading(true)
    setError('')
    setChannelData(null)
    setLoadingProgress('Initializing analysis...')

    try {
      setLoadingProgress('Fetching channel data...')
      const response = await axios.post(`${API_BASE_URL}/channel`, {
        channelId: selectedChannel.id,
        options: selectedOptions
      })
      
      setLoadingProgress('Processing data...')
      setTimeout(() => {
        setChannelData(response.data)
        setLoadingProgress('')
        // Auto-expand first section
        if (response.data.basicInfo) {
          setExpandedSections({ basicInfo: true })
        }
      }, 500)
      
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch channel data')
      setLoadingProgress('')
    } finally {
      setTimeout(() => setLoading(false), 500)
    }
  }

  const resetSearch = () => {
    setCurrentStep('search')
    setSearchResults([])
    setSelectedChannel(null)
    setChannelData(null)
    setError('')
    setChannelInput('')
  }

  const exportToExcel = () => {
    if (!channelData) return

    // Prepare data for Excel export
    const workbook = XLSX.utils.book_new()
    
    // Basic Info Sheet
    if (channelData.basicInfo) {
      const basicInfoData = [
        ['Field', 'Value'],
        ['Channel ID', channelData.basicInfo.id || ''],
        ['Title', channelData.basicInfo.title || ''],
        ['Description', channelData.basicInfo.description || ''],
        ['Custom URL', channelData.basicInfo.customUrl || ''],
        ['Published Date', channelData.basicInfo.publishedAt || ''],
        ['Country', channelData.basicInfo.country || ''],
        ['Default Language', channelData.basicInfo.defaultLanguage || '']
      ]
      const basicInfoSheet = XLSX.utils.aoa_to_sheet(basicInfoData)
      XLSX.utils.book_append_sheet(workbook, basicInfoSheet, 'Basic Info')
    }

    // Statistics Sheet
    if (channelData.statistics) {
      const statsData = [
        ['Metric', 'Value', 'Formatted'],
        ['Subscribers', channelData.statistics.subscriberCount || '0', formatNumber(channelData.statistics.subscriberCount)],
        ['Videos', channelData.statistics.videoCount || '0', formatNumber(channelData.statistics.videoCount)],
        ['Total Views', channelData.statistics.viewCount || '0', formatNumber(channelData.statistics.viewCount)],
        ['Hidden Subscriber Count', channelData.statistics.hiddenSubscriberCount ? 'Yes' : 'No', '']
      ]
      const statsSheet = XLSX.utils.aoa_to_sheet(statsData)
      XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistics')
    }

    // Recent Videos Sheet
    if (channelData.recentVideos && channelData.recentVideos.length > 0) {
      const videoData = [
        ['Video ID', 'Title', 'Description', 'Published Date', 'View Count', 'Like Count', 'Comment Count', 'Duration', 'Tags', 'Category ID', 'Definition', 'Caption', 'Video URL', 'Thumbnail URL']
      ]
      channelData.recentVideos.forEach(video => {
        videoData.push([
          video.id || '',
          video.title || '',
          video.description || '',
          video.publishedAt || '',
          video.viewCount || '0',
          video.likeCount || '0',
          video.commentCount || '0',
          video.duration || '',
          video.tags ? video.tags.join(', ') : '',
          video.categoryId || '',
          video.definition || '',
          video.caption || '',
          `https://youtube.com/watch?v=${video.id}`,
          video.thumbnails?.medium?.url || ''
        ])
      })
      const videosSheet = XLSX.utils.aoa_to_sheet(videoData)
      XLSX.utils.book_append_sheet(workbook, videosSheet, 'Recent Videos')
    }

    // All Videos Sheet (Detailed)
    if (channelData.allVideos && channelData.allVideos.length > 0) {
      const allVideoData = [
        ['Video ID', 'Title', 'Description', 'Published Date', 'View Count', 'Like Count', 'Dislike Count', 'Comment Count', 'Favorite Count', 'Duration', 'Raw Duration (ISO)', 'Tags', 'Category ID', 'Default Language', 'Audio Language', 'Live Content', 'Definition', 'Caption', 'Licensed Content', 'Projection', 'Upload Status', 'Privacy Status', 'License', 'Embeddable', 'Public Stats', 'Made For Kids', 'Video URL', 'Thumbnail URL']
      ]
      channelData.allVideos.forEach(video => {
        allVideoData.push([
          video.id || '',
          video.title || '',
          video.description || '',
          video.publishedAt || '',
          video.viewCount || '0',
          video.likeCount || '0',
          video.dislikeCount || '0',
          video.commentCount || '0',
          video.favoriteCount || '0',
          video.duration || '',
          video.rawDuration || '',
          video.tags ? video.tags.join(', ') : '',
          video.categoryId || '',
          video.defaultLanguage || '',
          video.defaultAudioLanguage || '',
          video.liveBroadcastContent || '',
          video.definition || '',
          video.caption || '',
          video.licensedContent ? 'Yes' : 'No',
          video.projection || '',
          video.uploadStatus || '',
          video.privacyStatus || '',
          video.license || '',
          video.embeddable ? 'Yes' : 'No',
          video.publicStatsViewable ? 'Yes' : 'No',
          video.madeForKids ? 'Yes' : 'No',
          `https://youtube.com/watch?v=${video.id}`,
          video.thumbnails?.medium?.url || ''
        ])
      })
      const allVideosSheet = XLSX.utils.aoa_to_sheet(allVideoData)
      XLSX.utils.book_append_sheet(workbook, allVideosSheet, 'All Videos')
    }

    // Playlists Sheet
    if (channelData.playlists && channelData.playlists.length > 0) {
      const playlistData = [
        ['Playlist ID', 'Title', 'Description', 'Published Date', 'Video Count']
      ]
      channelData.playlists.forEach(playlist => {
        playlistData.push([
          playlist.id || '',
          playlist.title || '',
          playlist.description || '',
          playlist.publishedAt || '',
          playlist.videoCount || '0'
        ])
      })
      const playlistsSheet = XLSX.utils.aoa_to_sheet(playlistData)
      XLSX.utils.book_append_sheet(workbook, playlistsSheet, 'Playlists')
    }

    // Channel Sections Sheet
    if (channelData.channelSections && channelData.channelSections.length > 0) {
      const sectionsData = [
        ['Section ID', 'Type', 'Style', 'Title', 'Position']
      ]
      channelData.channelSections.forEach(section => {
        sectionsData.push([
          section.id || '',
          section.type || '',
          section.style || '',
          section.title || '',
          section.position || ''
        ])
      })
      const sectionsSheet = XLSX.utils.aoa_to_sheet(sectionsData)
      XLSX.utils.book_append_sheet(workbook, sectionsSheet, 'Channel Sections')
    }

    // Export the workbook
    const fileName = `${channelData.basicInfo?.title || 'Channel'}_Data_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(workbook, fileName)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-600/20 via-transparent to-transparent"></div>
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10"></div>
      
      {/* Floating particles - hidden on mobile for performance */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none hidden lg:block">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-purple-400 rounded-full animate-float opacity-30"></div>
        <div className="absolute top-3/4 right-1/4 w-1 h-1 bg-indigo-400 rounded-full animate-float opacity-40 animation-delay-1000"></div>
        <div className="absolute top-1/2 left-3/4 w-3 h-3 bg-pink-400 rounded-full animate-float opacity-20 animation-delay-2000"></div>
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8">
        <header className="mb-8 lg:mb-12">
          <div className="bg-white/5 backdrop-blur-2xl rounded-2xl lg:rounded-3xl p-6 lg:p-8 border border-white/10 shadow-2xl shadow-purple-500/10 relative overflow-hidden group">
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            
            <div className="relative z-10 flex flex-col xl:flex-row items-center justify-between gap-6 lg:gap-8">
              <div className="flex flex-col sm:flex-row items-center gap-6 lg:gap-8 w-full xl:w-auto">
                <div className="relative flex-shrink-0">
                  <FaYoutube className="text-red-500 text-5xl lg:text-6xl animate-glow drop-shadow-2xl" />
                  <div className="absolute inset-0 text-red-500 text-5xl lg:text-6xl animate-pulse opacity-50">
                    <FaYoutube />
                  </div>
                </div>
                <div className="text-center sm:text-left w-full sm:w-auto">
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-3 lg:mb-4 tracking-tight leading-tight">
                    YouTube Analytics Pro
                  </h1>
                  <p className="text-gray-300 text-lg lg:text-xl font-medium tracking-wide mb-2">
                    Advanced channel data extraction and analysis
                  </p>
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-green-400 text-sm font-medium">Live API Integration</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 lg:gap-4 w-full xl:w-auto xl:flex-shrink-0">
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl lg:rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                  <div className="relative flex items-center justify-center gap-2 lg:gap-3 px-4 lg:px-6 py-3 lg:py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl lg:rounded-2xl font-bold shadow-lg transform transition-all duration-300 group-hover:scale-105 text-sm lg:text-base">
                    <FaChartLine size={18} />
                    <span>Professional Analytics</span>
                  </div>
                </div>
                
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl lg:rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                  <div className="relative flex items-center justify-center gap-2 lg:gap-3 px-4 lg:px-6 py-3 lg:py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl lg:rounded-2xl font-bold shadow-lg transform transition-all duration-300 group-hover:scale-105 text-sm lg:text-base">
                    <FaDownload size={18} />
                    <span>Excel Export</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="bg-white/5 backdrop-blur-2xl rounded-2xl lg:rounded-3xl p-6 lg:p-8 mb-8 lg:mb-12 border border-white/10 shadow-2xl shadow-indigo-500/10 relative overflow-hidden group">
          {/* Animated border */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
          
          <form onSubmit={handleChannelSearch} className="space-y-6 lg:space-y-8 relative z-10">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 lg:gap-6 mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:gap-6 w-full xl:w-auto">
                <div className="p-3 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-xl lg:rounded-2xl backdrop-blur-sm border border-white/10 flex-shrink-0">
                  <FaSearch className="text-indigo-400" size={28} />
                </div>
                <div className="w-full sm:w-auto">
                  <h3 className="text-3xl lg:text-4xl font-black bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                    Channel Search
                  </h3>
                  <p className="text-gray-400 text-base lg:text-lg">Find the exact channel you're looking for</p>
                </div>
              </div>
              
              <div className="flex flex-col gap-2 w-full sm:w-auto xl:flex-shrink-0">
                <label className="text-gray-300 font-semibold text-sm">Search Strategy:</label>
                <select 
                  value={searchStrategy} 
                  onChange={(e) => setSearchStrategy(e.target.value)}
                  className="px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white font-medium backdrop-blur-sm focus:border-indigo-400 focus:outline-none transition-all duration-300 text-sm lg:text-base"
                >
                  <option value="smart" className="bg-gray-800">Smart Search (Recommended)</option>
                  <option value="exact" className="bg-gray-800">Exact Match Only</option>
                  <option value="handle" className="bg-gray-800">Handle/Username Search</option>
                  <option value="general" className="bg-gray-800">General Search</option>
                </select>
              </div>
            </div>
            
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-xl lg:rounded-2xl blur-sm opacity-0 group-focus-within:opacity-100 transition duration-1000"></div>
              <div className="relative flex flex-col sm:flex-row items-stretch bg-white/10 backdrop-blur-xl rounded-xl lg:rounded-2xl border border-white/20 shadow-lg group-focus-within:border-indigo-400 transition-all duration-300 hover:shadow-xl overflow-hidden">
                <div className="relative flex-1 flex items-center">
                  <FaSearch className="absolute left-4 lg:left-6 text-gray-400 group-focus-within:text-indigo-400 transition-colors duration-300 z-10" size={20} />
                  <input
                    type="text"
                    value={channelInput}
                    onChange={(e) => setChannelInput(e.target.value)}
                    placeholder="Enter channel URL, @handle, or channel name..."
                    className="w-full pl-12 lg:pl-16 pr-4 py-4 lg:py-6 bg-transparent border-none outline-none text-lg lg:text-xl font-medium text-white placeholder-gray-400"
                    disabled={searchLoading}
                  />
                </div>
                <div className="relative flex-shrink-0">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl lg:rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                  <button 
                    type="submit" 
                    className={`relative px-6 lg:px-10 py-4 lg:py-6 rounded-xl lg:rounded-2xl font-bold text-lg lg:text-xl transition-all duration-300 flex items-center justify-center gap-3 lg:gap-4 min-w-[180px] lg:min-w-[220px] ${
                      searchLoading || !channelInput.trim()
                        ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 transform hover:scale-105'
                    }`}
                    disabled={searchLoading || !channelInput.trim()}
                  >
                    {searchLoading ? (
                      <>
                        <AiOutlineLoading3Quarters className="animate-spin" size={20} />
                        <span className="hidden sm:inline">Searching...</span>
                        <span className="sm:hidden">...</span>
                      </>
                    ) : (
                      <>
                        <FaSearch size={18} />
                        <span className="hidden sm:inline">Search Channels</span>
                        <span className="sm:hidden">Search</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            {/* Search Examples and Tips */}
            <div className="bg-white/5 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-white/10 backdrop-blur-sm">
              <h4 className="text-base lg:text-lg font-bold text-white mb-3 lg:mb-4">💡 Search Tips for Better Results:</h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                <div>
                  <h5 className="font-semibold text-indigo-400 mb-2 text-sm lg:text-base">For Exact Matches:</h5>
                  <div className="space-y-1 lg:space-y-2 text-xs lg:text-sm text-gray-300">
                    <div>• Use <code className="bg-white/10 px-1 lg:px-2 py-1 rounded text-xs">@username</code> for handles</div>
                    <div>• Use full YouTube URLs</div>
                    <div>• Put exact names in quotes: <code className="bg-white/10 px-1 lg:px-2 py-1 rounded text-xs">"Channel Name"</code></div>
                  </div>
                </div>
                <div>
                  <h5 className="font-semibold text-purple-400 mb-2 text-sm lg:text-base">Examples:</h5>
                  <div className="space-y-1 lg:space-y-2 text-xs lg:text-sm text-gray-300">
                    <div>• <code className="bg-white/10 px-1 lg:px-2 py-1 rounded text-xs">@MrBeast</code></div>
                    <div>• <code className="bg-white/10 px-1 lg:px-2 py-1 rounded text-xs">https://youtube.com/@codecademy</code></div>
                    <div>• <code className="bg-white/10 px-1 lg:px-2 py-1 rounded text-xs">"TechWithTim"</code></div>
                  </div>
                </div>
              </div>
              
              {searchTips && (
                <div className="mt-3 lg:mt-4 p-3 lg:p-4 bg-yellow-500/20 border border-yellow-500/40 rounded-xl">
                  <h5 className="font-semibold text-yellow-300 mb-2 text-sm lg:text-base">🎯 Recommendations for your search:</h5>
                  <ul className="text-xs lg:text-sm text-yellow-200 space-y-1">
                    {searchTips.map((tip, index) => (
                      <li key={index}>• {tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            {searchHistory.length > 0 && !searchLoading && (
              <div className="flex flex-wrap items-center gap-4 pt-6 border-t border-white/20">
                <span className="text-lg font-bold text-gray-300">Quick Access:</span>
                {searchHistory.map((search, index) => (
                  <button
                    key={index}
                    type="button"
                    className="px-5 py-3 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white text-sm font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 backdrop-blur-sm"
                    onClick={() => setChannelInput(search)}
                  >
                    {search.length > 30 ? `${search.substring(0, 30)}...` : search}
                  </button>
                ))}
              </div>
            )}

            {searchLoading && (
              <div className="space-y-6 animate-pulse">
                <div className="relative">
                  <div className="w-full bg-white/20 rounded-full h-4 overflow-hidden backdrop-blur-sm">
                    <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full animate-shimmer" style={{backgroundSize: '200% 100%'}}></div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/30 to-purple-500/30 rounded-full blur-sm animate-pulse"></div>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                    Searching channels...
                  </p>
                  <p className="text-gray-400 text-lg">Finding matching channels for your query...</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="space-y-6 animate-pulse">
                <div className="relative">
                  <div className="w-full bg-white/20 rounded-full h-4 overflow-hidden backdrop-blur-sm">
                    <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full animate-shimmer" style={{backgroundSize: '200% 100%'}}></div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/30 to-purple-500/30 rounded-full blur-sm animate-pulse"></div>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                    {loadingProgress}
                  </p>
                  <p className="text-gray-400 text-lg">Please wait while we analyze the channel...</p>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Channel Selection */}
        {currentStep === 'select' && searchResults.length > 1 && (
          <div className="bg-white/5 backdrop-blur-2xl rounded-3xl p-8 mb-12 border border-white/10 shadow-2xl shadow-cyan-500/10 relative overflow-hidden group">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-6">
                  <div className="p-4 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-2xl backdrop-blur-sm border border-white/10">
                    <FaUsers className="text-cyan-400 text-3xl" />
                  </div>
                  <div>
                    <h3 className="text-4xl font-black bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
                      Select Channel
                    </h3>
                    <p className="text-gray-400 text-lg">Found {searchResults.length} channels matching "{channelInput}"</p>
                  </div>
                </div>
                <button 
                  onClick={resetSearch}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 backdrop-blur-sm"
                >
                  New Search
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                {searchResults.map((channel, index) => (
                  <div
                    key={channel.id}
                    onClick={() => handleChannelSelect(channel)}
                    className="group relative bg-white/10 backdrop-blur-xl rounded-3xl p-6 border-2 border-white/20 hover:border-cyan-400 transition-all duration-300 cursor-pointer hover:shadow-xl hover:-translate-y-2 hover:bg-white/15"
                  >
                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    
                    {/* Relevance Score Badge */}
                    {channel.relevanceScore > 90 && (
                      <div className="absolute -top-2 -right-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg border-2 border-white">
                        ⭐ Best Match
                      </div>
                    )}
                    {channel.relevanceScore > 50 && channel.relevanceScore <= 90 && (
                      <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg border-2 border-white">
                        Good Match
                      </div>
                    )}
                    
                    <div className="relative z-10 text-center">
                      <div className="mb-4 relative">
                        <img 
                          src={channel.thumbnails?.high?.url || channel.thumbnails?.medium?.url || channel.thumbnails?.default?.url}
                          alt={channel.title}
                          className="w-20 h-20 rounded-full mx-auto object-cover border-4 border-white/20 group-hover:border-cyan-400 transition-all duration-300 shadow-lg"
                        />
                        {channel.matchType === 'direct_url' && (
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        )}
                      </div>
                      
                      <h4 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors duration-300">
                        {channel.title}
                      </h4>
                      
                      {channel.customUrl && (
                        <p className="text-gray-400 text-sm mb-3 font-medium">
                          @{channel.customUrl.replace('/', '')}
                        </p>
                      )}
                      
                      <div className="grid grid-cols-3 gap-2 text-center mb-4">
                        <div className="bg-white/10 rounded-xl p-2">
                          <div className="text-lg font-bold text-white">{formatNumber(channel.subscriberCount)}</div>
                          <div className="text-xs text-gray-400">Subscribers</div>
                        </div>
                        <div className="bg-white/10 rounded-xl p-2">
                          <div className="text-lg font-bold text-white">{formatNumber(channel.videoCount)}</div>
                          <div className="text-xs text-gray-400">Videos</div>
                        </div>
                        <div className="bg-white/10 rounded-xl p-2">
                          <div className="text-lg font-bold text-white">{formatNumber(channel.viewCount)}</div>
                          <div className="text-xs text-gray-400">Views</div>
                        </div>
                      </div>
                      
                      {channel.description && (
                        <p className="text-gray-300 text-sm line-clamp-2 mb-4">
                          {channel.description.length > 100 ? `${channel.description.substring(0, 100)}...` : channel.description}
                        </p>
                      )}
                      
                      <div className="mt-4">
                        <div className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-semibold opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                          Select This Channel
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Analysis Step Button */}
        {currentStep === 'analyze' && selectedChannel && !channelData && (
          <div className="bg-white/5 backdrop-blur-2xl rounded-3xl p-8 mb-12 border border-white/10 shadow-2xl shadow-green-500/10 relative overflow-hidden group">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-teal-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            
            <div className="relative z-10 text-center">
              <div className="flex items-center justify-center gap-6 mb-6">
                <img 
                  src={selectedChannel.thumbnails?.high?.url || selectedChannel.thumbnails?.medium?.url || selectedChannel.thumbnails?.default?.url}
                  alt={selectedChannel.title}
                  className="w-16 h-16 rounded-full object-cover border-4 border-green-400 shadow-lg"
                />
                <div>
                  <h3 className="text-3xl font-black bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                    {selectedChannel.title}
                  </h3>
                  <p className="text-gray-400 text-lg">{formatNumber(selectedChannel.subscriberCount)} subscribers</p>
                </div>
              </div>
              
              <div className="flex justify-center gap-4">
                <button 
                  onClick={resetSearch}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 backdrop-blur-sm"
                >
                  Change Channel
                </button>
                
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                  <button 
                    onClick={handleAnalyzeChannel}
                    disabled={loading || selectedOptions.length === 0}
                    className={`relative px-10 py-4 rounded-2xl font-bold text-xl transition-all duration-300 flex items-center gap-4 ${
                      loading || selectedOptions.length === 0
                        ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white transform hover:scale-105'
                    }`}
                  >
                    {loading ? (
                      <>
                        <AiOutlineLoading3Quarters className="animate-spin" size={24} />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <FaChartLine size={20} />
                        <span>Analyze Channel</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {selectedOptions.length === 0 && (
                <p className="text-red-400 mt-4 text-lg font-semibold">
                  Please select at least one data option below to proceed
                </p>
              )}
            </div>
          </div>
        )}

        <div className="bg-white/5 backdrop-blur-2xl rounded-2xl lg:rounded-3xl p-6 lg:p-8 mb-8 lg:mb-12 border border-white/10 shadow-2xl shadow-purple-500/10 relative overflow-hidden group">
          {/* Animated gradient border */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
          
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-10">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl backdrop-blur-sm border border-white/10">
                  <FaFilter className="text-purple-400 text-3xl" />
                </div>
                <div>
                  <h3 className="text-4xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                    Data Selection
                  </h3>
                  <p className="text-gray-400 text-lg">Choose what data to extract from the channel</p>
                </div>
                <button 
                  className="w-10 h-10 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-purple-400 hover:text-white rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 backdrop-blur-sm"
                  onClick={() => setShowOptionsHelp(!showOptionsHelp)}
                >
                  <FaInfoCircle size={20} />
                </button>
                              </div>
              
              <div className="flex flex-wrap gap-4">
                <div className="flex gap-3 bg-white/10 p-2 rounded-2xl backdrop-blur-sm border border-white/20">
                <button type="button" onClick={() => selectByCategory('basic')} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-600 transition-all duration-300">
                  <FaUsers size={14} />
                  Basic Info
                </button>
                <button type="button" onClick={() => selectByCategory('analytics')} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-600 transition-all duration-300">
                  <FaChartLine size={14} />
                  Analytics
                </button>
                <button type="button" onClick={() => selectByCategory('content')} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-600 transition-all duration-300">
                  <FaVideo size={14} />
                  Content
                </button>
              </div>
                <div className="flex gap-3 bg-white/10 p-2 rounded-2xl backdrop-blur-sm border border-white/20">
                  <button type="button" onClick={selectAll} className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold hover:from-green-600 hover:to-emerald-600 transition-all duration-300 transform hover:scale-105">
                    <BiSelectMultiple size={16} />
                    All
                  </button>
                  <button type="button" onClick={selectNone} className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl font-semibold hover:from-red-600 hover:to-rose-600 transition-all duration-300 transform hover:scale-105">
                    <MdClear size={16} />
                    None
                  </button>
                </div>
              </div>
            </div>
          </div>

          {showOptionsHelp && (
            <div className="bg-white/10 backdrop-blur-xl p-8 rounded-3xl mb-8 border border-white/20 animate-fadeIn shadow-lg">
              <h4 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-6">Data Categories Explained:</h4>
              <div className="grid gap-6">
                <div className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full mt-3"></div>
                  <div className="text-gray-300">
                    <strong className="text-indigo-400 text-lg">Basic Info:</strong> Essential channel details like name, description, and subscriber count
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-3"></div>
                  <div className="text-gray-300">
                    <strong className="text-purple-400 text-lg">Analytics:</strong> Performance metrics including views, engagement, and video statistics
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div className="w-2 h-2 bg-pink-400 rounded-full mt-3"></div>
                  <div className="text-gray-300">
                    <strong className="text-pink-400 text-lg">Content:</strong> Channel structure, playlists, branding, and organizational data
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mb-8 p-6 bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold text-white text-xl">
                {selectedOptions.length} of {DATA_OPTIONS.length} options selected
              </span>
              <div className="flex items-center gap-3">
                <span className="text-lg text-gray-300 font-semibold">
                  {Math.round((selectedOptions.length / DATA_OPTIONS.length) * 100)}%
                </span>
                <div className="w-16 h-16 relative">
                  <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="m18,2.0845a 15.9155,15.9155 0 0,1 0,31.831a 15.9155,15.9155 0 0,1 0,-31.831"
                      fill="none"
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="2"
                    />
                    <path
                      d="m18,2.0845a 15.9155,15.9155 0 0,1 0,31.831a 15.9155,15.9155 0 0,1 0,-31.831"
                      fill="none"
                      stroke="url(#progress-gradient)"
                      strokeWidth="2"
                      strokeDasharray={`${(selectedOptions.length / DATA_OPTIONS.length) * 100}, 100`}
                      className="transition-all duration-500 ease-out"
                    />
                    <defs>
                      <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#8B5CF6" />
                        <stop offset="50%" stopColor="#A855F7" />
                        <stop offset="100%" stopColor="#EC4899" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-white">
                      {Math.round((selectedOptions.length / DATA_OPTIONS.length) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="w-full bg-white/20 rounded-full h-4 overflow-hidden backdrop-blur-sm">
              <div 
                className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full transition-all duration-500 ease-out relative"
                style={{ width: `${(selectedOptions.length / DATA_OPTIONS.length) * 100}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 rounded-full animate-pulse opacity-50"></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {DATA_OPTIONS.map(option => (
              <div 
                key={option.id} 
                className={`group relative bg-white/10 backdrop-blur-xl rounded-3xl p-6 border-2 transition-all duration-300 cursor-pointer hover:shadow-xl hover:-translate-y-2 ${
                  selectedOptions.includes(option.id) 
                    ? 'border-purple-500 bg-white/20 shadow-lg shadow-purple-500/20 transform scale-105' 
                    : 'border-white/20 hover:border-purple-400 hover:bg-white/15'
                }`}
              >
                {/* Glow effect for selected cards */}
                {selectedOptions.includes(option.id) && (
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 rounded-3xl blur opacity-30 animate-glow"></div>
                )}
                
                <label className="relative cursor-pointer flex items-start gap-5 w-full">
                  <div className="flex-shrink-0 mt-1">
                    <div className={`w-8 h-8 rounded-2xl border-2 flex items-center justify-center transition-all duration-300 ${
                      selectedOptions.includes(option.id)
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 border-purple-500 text-white transform scale-110 shadow-lg'
                        : 'border-white/40 text-white/60 group-hover:border-purple-400 group-hover:text-purple-400'
                    }`}>
                      {selectedOptions.includes(option.id) && <FaCheckSquare size={16} />}
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedOptions.includes(option.id)}
                      onChange={() => handleOptionChange(option.id)}
                      className="hidden"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-bold text-xl mb-3 transition-colors duration-300 ${
                      selectedOptions.includes(option.id)
                        ? 'text-white'
                        : 'text-gray-200 group-hover:text-white'
                    }`}>
                      {option.label}
                    </h4>
                    <p className={`text-sm leading-relaxed transition-colors duration-300 ${
                      selectedOptions.includes(option.id)
                        ? 'text-gray-200'
                        : 'text-gray-400 group-hover:text-gray-300'
                    }`}>
                      {option.description}
                    </p>
                  </div>
                </label>
                
                {selectedOptions.includes(option.id) && (
                  <div className="absolute -top-3 -right-3 w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg animate-bounce-slow">
                    <FaCheckSquare className="text-white" size={16} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {selectedOptions.length === 0 && (
            <div className="flex items-center gap-6 bg-red-500/20 backdrop-blur-xl border border-red-500/40 text-red-300 p-6 rounded-3xl mt-8 animate-bounce-slow shadow-lg">
              <div className="p-3 bg-red-500/30 rounded-2xl">
                <FaExclamationCircle size={28} className="text-red-400" />
              </div>
              <div>
                <h4 className="font-bold text-red-200 text-lg mb-1">Selection Required</h4>
                <span className="text-red-300">Please select at least one data option to proceed</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/20 backdrop-blur-2xl border border-red-500/40 rounded-3xl p-8 mb-12 shadow-2xl shadow-red-500/10 animate-slideInRight relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-red-400/10 to-red-600/10 opacity-50"></div>
            <div className="relative z-10 flex items-start gap-6">
              <div className="flex-shrink-0 p-4 bg-red-500/30 rounded-2xl backdrop-blur-sm">
                <FaExclamationCircle className="text-red-400 text-4xl" />
              </div>
              <div className="flex-1">
                <h4 className="text-2xl font-bold text-red-200 mb-3">Oops! Something went wrong</h4>
                <p className="text-red-300 mb-6 leading-relaxed text-lg">{error}</p>
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-red-500 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                  <button 
                    className="relative px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
                    onClick={() => setError('')}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {channelData && (
          <div className="bg-white/5 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl shadow-green-500/10 border border-white/10 animate-slideInUp relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 opacity-50"></div>
            <div className="relative z-10">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-10 pb-8 border-b border-white/20">
                <div className="flex items-center gap-6">
                  <div className="p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-2xl backdrop-blur-sm border border-white/10">
                    <FaChartLine className="text-green-400 text-4xl" />
                  </div>
                  <div>
                    <h2 className="text-5xl font-black bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent mb-2">
                      Analytics Dashboard
                    </h2>
                    <p className="text-gray-400 text-lg">Channel insights and performance metrics</p>
                  </div>
                </div>
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                  <button 
                    onClick={exportToExcel} 
                    className="relative flex items-center gap-4 px-8 py-5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-2xl shadow-lg transition-all duration-300 transform hover:scale-105 text-xl"
                  >
                    <FaDownload size={22} />
                    <span>Export to Excel</span>
                  </button>
                </div>
              </div>
            </div>

            {channelData.basicInfo && (
              <div className="bg-white rounded-2xl mb-6 border border-gray-200 shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
                <div 
                  className="flex justify-between items-center p-6 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200 cursor-pointer hover:from-gray-100 hover:to-blue-100 transition-all duration-300"
                  onClick={() => toggleSection('basicInfo')}
                >
                  <div className="flex items-center gap-4">
                    <FaUsers className="text-indigo-600 text-2xl" />
                    <h3 className="text-2xl font-bold text-gray-800">Basic Information</h3>
                  </div>
                  <button className={`w-8 h-8 bg-white rounded-full flex items-center justify-center text-indigo-600 hover:bg-indigo-100 transition-all duration-300 ${expandedSections.basicInfo ? 'transform rotate-180' : ''}`}>
                    ▼
                  </button>
                </div>
                <div className={`transition-all duration-500 ease-in-out ${expandedSections.basicInfo ? 'max-h-96 p-6' : 'max-h-0 overflow-hidden'}`}>
                  <div className="flex flex-col lg:flex-row gap-6 items-start">
                    {channelData.thumbnails && (
                      <div className="flex-shrink-0">
                        <img 
                          src={channelData.thumbnails.high?.url || channelData.thumbnails.default?.url} 
                          alt={channelData.basicInfo.title}
                          className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-3xl font-black text-gray-800 mb-3">{channelData.basicInfo.title}</h4>
                      {channelData.basicInfo.customUrl && (
                        <div className="flex items-center gap-3 mb-4">
                          <FaExternalLinkAlt className="text-indigo-500" size={16} />
                          <a 
                            href={`https://youtube.com/${channelData.basicInfo.customUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800 font-semibold hover:underline transition-colors duration-300"
                          >
                            youtube.com/{channelData.basicInfo.customUrl}
                          </a>
                        </div>
                      )}
                      <p className="text-gray-700 leading-relaxed mb-4 line-clamp-3">{channelData.basicInfo.description}</p>
                      <div className="flex flex-wrap gap-4">
                        <span className="flex items-center gap-2 text-gray-600 font-medium">
                          <FaCalendarAlt size={16} />
                          Joined {formatDate(channelData.basicInfo.publishedAt)}
                        </span>
                        {channelData.basicInfo.country && (
                          <span className="flex items-center gap-2 text-gray-600 font-medium">
                            📍 {channelData.basicInfo.country}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {channelData.statistics && (
              <div className="bg-white rounded-2xl mb-6 border border-gray-200 shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
                <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
                  <div className="flex items-center gap-4">
                    <FaChartLine className="text-indigo-600 text-2xl" />
                    <h3 className="text-2xl font-bold text-gray-800">Statistics</h3>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="group bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-4 translate-x-4"></div>
                      <div className="flex items-center gap-4 relative z-10">
                        <div className="bg-white/20 p-3 rounded-xl">
                          <FaUsers size={24} />
                        </div>
                        <div>
                          <h4 className="text-3xl font-black mb-1">{formatNumber(channelData.statistics.subscriberCount)}</h4>
                          <p className="text-white/90 font-semibold">Subscribers</p>
                        </div>
                      </div>
                    </div>
                    <div className="group bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-4 translate-x-4"></div>
                      <div className="flex items-center gap-4 relative z-10">
                        <div className="bg-white/20 p-3 rounded-xl">
                          <FaVideo size={24} />
                        </div>
                        <div>
                          <h4 className="text-3xl font-black mb-1">{formatNumber(channelData.statistics.videoCount)}</h4>
                          <p className="text-white/90 font-semibold">Videos</p>
                        </div>
                      </div>
                    </div>
                    <div className="group bg-gradient-to-br from-pink-500 to-rose-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-4 translate-x-4"></div>
                      <div className="flex items-center gap-4 relative z-10">
                        <div className="bg-white/20 p-3 rounded-xl">
                          <FaEye size={24} />
                        </div>
      <div>
                          <h4 className="text-3xl font-black mb-1">{formatNumber(channelData.statistics.viewCount)}</h4>
                          <p className="text-white/90 font-semibold">Total Views</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {channelData.branding?.bannerImageUrl && (
              <div className="data-card">
                <h3>Channel Banner</h3>
                <img 
                  src={channelData.branding.bannerImageUrl} 
                  alt="Channel Banner"
                  className="channel-banner"
                />
              </div>
            )}

            {channelData.recentVideos && channelData.recentVideos.length > 0 && (
              <div className="data-card">
                <h3>Recent Videos ({channelData.recentVideos.length})</h3>
                <div className="videos-grid">
                  {channelData.recentVideos.map((video) => (
                    <div key={video.id} className="video-card">
                      <img 
                        src={video.thumbnails?.medium?.url || video.thumbnails?.default?.url}
                        alt={video.title}
                        className="video-thumbnail"
                      />
                      <div className="video-info">
                        <h5>{video.title}</h5>
                        <p>{formatDate(video.publishedAt)}</p>
                        <a 
                          href={`https://youtube.com/watch?v=${video.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="video-link"
                        >
                          <FaExternalLinkAlt size={14} />
                          Watch Video
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {channelData.allVideos && channelData.allVideos.length > 0 && (
              <div className="data-card">
                <h3>All Videos - Detailed ({channelData.allVideos.length})</h3>
                <div className="videos-table-container">
                  <div className="videos-summary">
                    <p>Complete video analytics including view counts, descriptions, and engagement metrics.</p>
                    <p><strong>Total Videos:</strong> {channelData.allVideos.length}</p>
                    <p><strong>Total Views:</strong> {formatNumber(channelData.allVideos.reduce((sum, video) => sum + parseInt(video.viewCount || 0), 0))}</p>
                  </div>
                  <div className="overflow-x-auto bg-white rounded-2xl border border-gray-200 shadow-lg">
                    <table className="w-full border-collapse min-w-[1200px]">
                      <thead>
                        <tr className="bg-gradient-to-r from-gray-50 to-blue-50">
                          <th className="p-4 text-left font-bold text-gray-800 border-b-2 border-gray-200">Thumbnail</th>
                          <th className="p-4 text-left font-bold text-gray-800 border-b-2 border-gray-200">Title & Details</th>
                          <th className="p-4 text-left font-bold text-gray-800 border-b-2 border-gray-200">Published</th>
                          <th className="p-4 text-left font-bold text-gray-800 border-b-2 border-gray-200">Views</th>
                          <th className="p-4 text-left font-bold text-gray-800 border-b-2 border-gray-200">Likes</th>
                          <th className="p-4 text-left font-bold text-gray-800 border-b-2 border-gray-200">Comments</th>
                          <th className="p-4 text-left font-bold text-gray-800 border-b-2 border-gray-200">Duration</th>
                          <th className="p-4 text-left font-bold text-gray-800 border-b-2 border-gray-200">Quality</th>
                          <th className="p-4 text-left font-bold text-gray-800 border-b-2 border-gray-200">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {channelData.allVideos.slice(0, 50).map((video, index) => (
                          <React.Fragment key={video.id}>
                            <tr className="hover:bg-gray-50 transition-colors duration-200 border-b border-gray-100">
                              <td className="p-4">
                                <img 
                                  src={video.thumbnails?.medium?.url || video.thumbnails?.default?.url}
                                  alt={video.title}
                                  className="w-20 h-14 object-cover rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300"
                                />
                              </td>
                              <td className="p-4 max-w-md">
                                <div className="space-y-2">
                                  <h4 className="font-bold text-gray-800 line-clamp-2 leading-tight hover:text-indigo-600 transition-colors duration-300">
                                    {video.title}
                                  </h4>
                                  <div className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">
                                    ID: {video.id}
                                  </div>
                                  {video.tags && video.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {video.tags.slice(0, 3).map((tag, tagIndex) => (
                                        <span key={tagIndex} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                          {tag}
                                        </span>
                                      ))}
                                      {video.tags.length > 3 && (
                                        <span className="text-xs text-gray-500">+{video.tags.length - 3} more</span>
                                      )}
                                    </div>
                                  )}
                                  {video.description && (
                                    <button 
                                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                                      onClick={() => toggleSection(`video-${video.id}`)}
                                    >
                                      <FaInfoCircle size={10} />
                                      {expandedSections[`video-${video.id}`] ? 'Hide' : 'Show'} Description
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 text-sm text-gray-700 font-medium">
                                {formatDate(video.publishedAt)}
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-1">
                                  <FaEye className="text-gray-400" size={12} />
                                  <span className="font-semibold text-gray-800">{formatNumber(video.viewCount)}</span>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-1">
                                  <span className="text-red-500">👍</span>
                                  <span className="font-semibold text-gray-800">{formatNumber(video.likeCount)}</span>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-1">
                                  <span className="text-blue-500">💬</span>
                                  <span className="font-semibold text-gray-800">{formatNumber(video.commentCount)}</span>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="bg-gray-100 px-3 py-1 rounded-full text-sm font-mono font-semibold text-gray-700">
                                  {video.duration}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="space-y-1">
                                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                                    video.definition === 'hd' 
                                      ? 'bg-green-100 text-green-700' 
                                      : 'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {video.definition?.toUpperCase()}
                                  </span>
                                  {video.caption && (
                                    <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                                      CC
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="p-4">
                                <a 
                                  href={`https://youtube.com/watch?v=${video.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-md"
                                >
                                  <FaExternalLinkAlt size={12} />
                                  Watch
                                </a>
                              </td>
                            </tr>
                            {expandedSections[`video-${video.id}`] && video.description && (
                              <tr>
                                <td colSpan="9" className="p-0">
                                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-t border-gray-200">
                                    <div className="space-y-4">
                                      <div>
                                        <h5 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                                          <FaInfoCircle className="text-indigo-500" />
                                          Video Description
                                        </h5>
                                        <p className="text-gray-700 leading-relaxed text-sm whitespace-pre-wrap">
                                          {video.description.length > 500 
                                            ? `${video.description.substring(0, 500)}...` 
                                            : video.description
                                          }
                                        </p>
                                      </div>
                                      {video.tags && video.tags.length > 0 && (
                                        <div>
                                          <h5 className="font-bold text-gray-800 mb-2">All Tags ({video.tags.length})</h5>
                                          <div className="flex flex-wrap gap-2">
                                            {video.tags.map((tag, tagIndex) => (
                                              <span key={tagIndex} className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-medium">
                                                {tag}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                          <span className="font-semibold text-gray-600">Category:</span>
                                          <span className="ml-2 text-gray-800">{video.categoryId || 'Unknown'}</span>
                                        </div>
                                        <div>
                                          <span className="font-semibold text-gray-600">Language:</span>
                                          <span className="ml-2 text-gray-800">{video.defaultLanguage || 'Not specified'}</span>
                                        </div>
                                        <div>
                                          <span className="font-semibold text-gray-600">Privacy:</span>
                                          <span className="ml-2 text-gray-800">{video.privacyStatus || 'Unknown'}</span>
                                        </div>
                                        <div>
                                          <span className="font-semibold text-gray-600">License:</span>
                                          <span className="ml-2 text-gray-800">{video.license || 'Standard'}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                    {channelData.allVideos.length > 50 && (
                      <div className="table-note">
                        Showing first 50 videos. Export to Excel to see all {channelData.allVideos.length} videos.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {channelData.playlists && channelData.playlists.length > 0 && (
              <div className="data-card">
                <h3>Channel Playlists ({channelData.playlists.length})</h3>
                <div className="playlists-grid">
                  {channelData.playlists.map((playlist) => (
                    <div key={playlist.id} className="playlist-card">
                      <div className="playlist-info">
                        <h5>{playlist.title}</h5>
                        <p>{playlist.description}</p>
                        <span className="playlist-meta">{playlist.videoCount} videos</span>
                        <a 
                          href={`https://youtube.com/playlist?list=${playlist.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="playlist-link"
                        >
                          <FaExternalLinkAlt size={14} />
                          View Playlist
        </a>
      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {channelData.topicDetails && (
              <div className="data-card">
                <h3>Topic Categories</h3>
                <div className="topics-list">
                  {channelData.topicDetails.topicIds?.map((topicId, index) => (
                    <span key={index} className="topic-tag">{topicId}</span>
                  ))}
                  {channelData.topicDetails.topicCategories?.map((category, index) => (
                    <span key={index} className="topic-tag">{category}</span>
                  ))}
                </div>
              </div>
            )}

            {channelData.channelSections && channelData.channelSections.length > 0 && (
              <div className="data-card">
                <h3>Channel Sections ({channelData.channelSections.length})</h3>
                <div className="sections-list">
                  {channelData.channelSections.map((section) => (
                    <div key={section.id} className="section-item">
                      <h5>{section.title || section.type}</h5>
                      <p>Style: {section.style} | Position: {section.position}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
