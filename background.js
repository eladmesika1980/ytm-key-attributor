// In-memory cache for resolved songs to prevent redundant API queries
// Key: "Title - Artist", Value: { key: "...", bpm: "...", camelot: "...", source: "GetSongBPM" }
const cache = new Map();
const MAX_CACHE_SIZE = 100;

// Listen for messages from the content script or options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fetchKeyBpm') {
    const { title, artist } = message;
    
    // Input validation
    if (!title || !artist) {
      sendResponse({ error: 'Missing title or artist metadata' });
      return true; // Keep message channel open for async response
    }
    
    const cacheKey = `${title.toLowerCase().trim()} - ${artist.toLowerCase().trim()}`;
    
    // Check in-memory cache first
    if (cache.has(cacheKey)) {
      sendResponse({ data: cache.get(cacheKey) });
      return true;
    }
    
    // Retrieve API key and call GetSongBPM
    chrome.storage.local.get(['apiKey'], async (result) => {
      const apiKey = result.apiKey;
      if (!apiKey) {
        sendResponse({ error: 'API_KEY_MISSING' });
        return;
      }
      
      try {
        const data = await fetchSongDetailsFromGetSongBPM(apiKey, title, artist);
        if (data) {
          // Add to cache (evicting oldest if max size reached)
          if (cache.size >= MAX_CACHE_SIZE) {
            const firstKey = cache.keys().next().value;
            cache.delete(firstKey);
          }
          cache.set(cacheKey, data);
          sendResponse({ data });
        } else {
          sendResponse({ error: 'Song not found in database' });
        }
      } catch (err) {
        console.error('API Error:', err);
        sendResponse({ error: 'Failed to fetch data from GetSongBPM: ' + err.message });
      }
    });
    
    return true; // Keep message channel open for async response
  }
  
  if (message.action === 'testConnection') {
    const { apiKey } = message;
    testApiConnection(apiKey)
      .then(success => sendResponse({ success }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return true;
  }
});

// Helper function to query the GetSongBPM API
async function fetchSongDetailsFromGetSongBPM(apiKey, title, artist) {
  // Query endpoint using search/both (search by song & artist)
  // Format is "song:TITLE artist:NAME"
  const lookupQuery = `song:${title} artist:${artist}`;
  const url = `https://api.getsong.co/search/?api_key=${encodeURIComponent(apiKey)}&type=both&lookup=${encodeURIComponent(lookupQuery)}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }
  
  const payload = await response.json();
  if (payload.results && payload.results.length > 0) {
    const result = payload.results[0];
    const key = result.key || 'Unknown';
    const bpm = result.tempo || 'Unknown';
    const camelot = parseKeyToCamelot(key);
    
    return {
      key: key,
      bpm: bpm,
      camelot: camelot || 'Unknown'
    };
  }
  
  return null;
}

// Function to test the API connection with a search query
async function testApiConnection(apiKey) {
  // We use a well-known song like Metallica's "Enter Sandman" for testing
  const url = `https://api.getsong.co/search/?api_key=${encodeURIComponent(apiKey)}&type=both&lookup=song:enter+sandman+artist:metallica&limit=1`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }
  const payload = await response.json();
  // If the response is valid and parsed successfully, authentication works.
  // Note that if the payload has an error or is an empty results array, it's still a valid network connection.
  return payload !== null;
}

// Key parser to map GetSongBPM key names to Camelot Wheel notation
function parseKeyToCamelot(keyStr) {
  if (!keyStr) return null;
  
  // Normalize string: lowercase, remove spaces, rewrite full words to 'm' for minor
  const normalized = keyStr.trim().toLowerCase()
    .replace(/\s+/g, '')
    .replace(/major/g, '')
    .replace(/minor/g, 'm');
  
  const map = {
    // Major Keys
    'c': '8B', 'c#': '3B', 'db': '3B', 'd': '10B', 'd#': '5B', 'eb': '5B',
    'e': '12B', 'f': '7B', 'f#': '2B', 'gb': '2B', 'g': '9B', 'g#': '4B',
    'ab': '4B', 'a': '11B', 'a#': '6B', 'bb': '6B', 'b': '1B',
    
    // Minor Keys
    'cm': '5A', 'c#m': '12A', 'dbm': '12A', 'dm': '7A', 'd#m': '2A', 'ebm': '2A',
    'em': '9A', 'fm': '4A', 'f#m': '11A', 'gbm': '11A', 'gm': '6A', 'g#m': '1A',
    'abm': '1A', 'am': '8A', 'a#m': '3A', 'bbm': '3A', 'bm': '10A'
  };
  
  return map[normalized] || null;
}
