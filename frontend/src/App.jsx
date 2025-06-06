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

const API_BASE_URL = 'http://localhost:5000/api'

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
  const [loading, setLoading] = useState(false)
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

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!channelInput.trim() || selectedOptions.length === 0) return

    setLoading(true)
    setError('')
    setChannelData(null)
    setLoadingProgress('Initializing search...')

    // Add to search history
    const newSearch = channelInput.trim()
    if (newSearch && !searchHistory.includes(newSearch)) {
      setSearchHistory(prev => [newSearch, ...prev].slice(0, 5))
    }

    try {
      setLoadingProgress('Locating channel...')
      const response = await axios.post(`${API_BASE_URL}/channel`, {
        channelInput: newSearch,
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 p-4">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/20 flex flex-col lg:flex-row items-center justify-between gap-6 animate-fadeInDown">
            <div className="flex items-center gap-6">
              <FaYoutube className="text-red-500 text-5xl animate-pulse-slow drop-shadow-lg" />
              <div className="text-center lg:text-left">
                <h1 className="text-4xl lg:text-5xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  YouTube Analytics Pro
                </h1>
                <p className="text-gray-600 text-lg font-medium">
                  Advanced channel data extraction and analysis
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full font-semibold shadow-lg hover:shadow-xl transition-all duration-300">
                <FaChartLine size={16} />
                <span>Professional Analytics</span>
              </div>
              <div className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full font-semibold shadow-lg hover:shadow-xl transition-all duration-300">
                <FaDownload size={16} />
                <span>Excel Export</span>
              </div>
            </div>
          </div>
        </header>

        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 mb-8 shadow-2xl border border-white/20 animate-slideInUp">
          <form onSubmit={handleSearch} className="space-y-6">
            <div className="relative flex items-center bg-white rounded-full shadow-lg border-2 border-transparent focus-within:border-indigo-500 transition-all duration-300 hover:shadow-xl group">
              <FaSearch className="absolute left-6 text-gray-400 group-focus-within:text-indigo-500 transition-colors duration-300" size={20} />
              <input
                type="text"
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
                placeholder="Enter channel URL, @handle, or channel name..."
                className="flex-1 px-16 py-4 bg-transparent border-none outline-none text-lg font-medium text-gray-700 placeholder-gray-400"
                disabled={loading}
              />
              <button 
                type="submit" 
                className={`px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 flex items-center gap-3 ${
                  loading || !channelInput.trim() || selectedOptions.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg transform hover:-translate-y-0.5'
                }`}
                disabled={loading || !channelInput.trim() || selectedOptions.length === 0}
              >
                {loading ? (
                  <>
                    <AiOutlineLoading3Quarters className="animate-spin" size={20} />
                    <span>Fetching...</span>
                  </>
                ) : (
                  <>
                    <FaSearch size={16} />
                    <span>Analyze Channel</span>
                  </>
                )}
              </button>
            </div>
            
            {searchHistory.length > 0 && !loading && (
              <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-200">
                <span className="text-sm font-semibold text-gray-600">Recent searches:</span>
                {searchHistory.map((search, index) => (
                  <button
                    key={index}
                    type="button"
                    className="px-4 py-2 bg-gray-100 hover:bg-indigo-500 hover:text-white text-gray-700 text-sm font-medium rounded-full transition-all duration-300 transform hover:-translate-y-0.5"
                    onClick={() => setChannelInput(search)}
                  >
                    {search}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="space-y-3 animate-pulse">
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full animate-pulse"></div>
                </div>
                <p className="text-center text-indigo-600 font-semibold">{loadingProgress}</p>
              </div>
            )}
          </form>
        </div>

        <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 mb-8 shadow-2xl border border-white/20 animate-slideInLeft">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
            <div className="flex items-center gap-4">
              <FaFilter className="text-indigo-600 text-2xl" />
              <h3 className="text-3xl font-bold text-gray-800">Data Selection</h3>
              <button 
                className="w-8 h-8 bg-gray-200 hover:bg-indigo-500 hover:text-white text-indigo-500 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110"
                onClick={() => setShowOptionsHelp(!showOptionsHelp)}
              >
                <FaInfoCircle size={16} />
              </button>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
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
              <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                <button type="button" onClick={selectAll} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:from-green-600 hover:to-emerald-600 transition-all duration-300">
                  <BiSelectMultiple size={16} />
                  All
                </button>
                <button type="button" onClick={selectNone} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-lg font-semibold hover:from-red-600 hover:to-rose-600 transition-all duration-300">
                  <MdClear size={16} />
                  None
                </button>
              </div>
            </div>
          </div>

          {showOptionsHelp && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl mb-6 border border-blue-200 animate-fadeIn">
              <h4 className="text-lg font-bold text-gray-800 mb-4">Data Categories Explained:</h4>
              <div className="grid gap-4">
                <div className="text-gray-700">
                  <strong className="text-indigo-600">Basic Info:</strong> Essential channel details like name, description, and subscriber count
                </div>
                <div className="text-gray-700">
                  <strong className="text-indigo-600">Analytics:</strong> Performance metrics including views, engagement, and video statistics
                </div>
                <div className="text-gray-700">
                  <strong className="text-indigo-600">Content:</strong> Channel structure, playlists, branding, and organizational data
                </div>
              </div>
            </div>
          )}

          <div className="mb-6 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl border-l-4 border-indigo-500">
            <div className="flex justify-between items-center mb-3">
              <span className="font-semibold text-gray-800 text-lg">
                {selectedOptions.length} of {DATA_OPTIONS.length} options selected
              </span>
              <span className="text-sm text-gray-600 font-medium">
                {Math.round((selectedOptions.length / DATA_OPTIONS.length) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(selectedOptions.length / DATA_OPTIONS.length) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {DATA_OPTIONS.map(option => (
              <div 
                key={option.id} 
                className={`group relative bg-white rounded-2xl p-5 border-2 transition-all duration-300 cursor-pointer hover:shadow-lg hover:-translate-y-1 ${
                  selectedOptions.includes(option.id) 
                    ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-md' 
                    : 'border-gray-200 hover:border-indigo-300'
                }`}
              >
                <label className="cursor-pointer flex items-start gap-4 w-full">
                  <div className="flex-shrink-0 mt-1">
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-300 ${
                      selectedOptions.includes(option.id)
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500 border-indigo-500 text-white transform scale-110'
                        : 'border-gray-300 group-hover:border-indigo-400'
                    }`}>
                      {selectedOptions.includes(option.id) && <FaCheckSquare size={14} />}
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedOptions.includes(option.id)}
                      onChange={() => handleOptionChange(option.id)}
                      className="hidden"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-800 text-lg mb-2 group-hover:text-indigo-600 transition-colors duration-300">
                      {option.label}
                    </h4>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {option.description}
                    </p>
                  </div>
                </label>
                {selectedOptions.includes(option.id) && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                    <FaCheckSquare className="text-white" size={12} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {selectedOptions.length === 0 && (
            <div className="flex items-center gap-4 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 text-red-700 p-4 rounded-2xl mt-6 animate-bounce-slow">
              <FaExclamationCircle size={24} className="text-red-500" />
              <span className="font-semibold">Please select at least one data option to proceed</span>
            </div>
          )}
        </div>



        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8 shadow-lg animate-slideInRight">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <FaExclamationCircle className="text-red-500 text-3xl" />
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-bold text-red-800 mb-2">Oops! Something went wrong</h4>
                <p className="text-red-700 mb-4 leading-relaxed">{error}</p>
                <button 
                  className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg"
                  onClick={() => setError('')}
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {channelData && (
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/20 animate-slideInUp">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8 pb-6 border-b-2 border-gray-200">
              <div className="flex items-center gap-4">
                <FaChartLine className="text-indigo-600 text-3xl" />
                <h2 className="text-4xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Channel Analytics Dashboard
                </h2>
              </div>
              <button 
                onClick={exportToExcel} 
                className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                <FaDownload size={18} />
                <span>Export to Excel</span>
              </button>
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
