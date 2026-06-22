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
        const resultData = await fetchSongDetailsFromGetSongBPM(apiKey, title, artist);
        if (resultData && resultData.success) {
          const data = {
            key: resultData.key,
            bpm: resultData.bpm,
            camelot: resultData.camelot
          };
          // Add to cache (evicting oldest if max size reached)
          if (cache.size >= MAX_CACHE_SIZE) {
            const firstKey = cache.keys().next().value;
            cache.delete(firstKey);
          }
          cache.set(cacheKey, data);
          sendResponse({ data });
        } else {
          sendResponse({ 
            error: 'Song not found in database',
            rawResults: resultData ? resultData.rawResults : []
          });
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

// Helper function to clean up song titles for better search matching
function cleanSongTitle(title) {
  if (!title) return '';
  let cleaned = title;
  
  // Remove text inside parentheses or brackets that contain common descriptors
  // Examples: (Live), (Live Session), (Official Video), [Official Audio], (feat. Artist), (ft. Artist)
  cleaned = cleaned.replace(/\s*[([][^)]*(live|session|official|video|audio|remaster|edit|clip|lyrics|ft\.|feat\.)[^)]*[)\]]/gi, '');
  
  // Remove trailing descriptors like "- Live", "- Remix", etc.
  cleaned = cleaned.replace(/\s*-\s*(live|remastered|remix|edit|lyrics|official video|official audio)\b.*/gi, '');
  
  // Remove featured artists outside of brackets
  cleaned = cleaned.replace(/\s*(feat\.|feat|ft\.|ft)\b.*/gi, '');
  
  // Remove double spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

// Helper function to query the GetSongBPM API
async function fetchSongDetailsFromGetSongBPM(apiKey, title, artist) {
  const cleanTitle = cleanSongTitle(title);
  const cleanArtist = cleanSongTitle(artist);
  
  console.log(`[YTM Key Attributor Background] Original query: "${title}" by "${artist}". Cleaned query: "${cleanTitle}" by "${cleanArtist}"`);
  
  let allRawResults = [];

  // Try 1: Precise search using type=both
  try {
    const lookupQuery = `song:${cleanTitle} artist:${cleanArtist}`;
    const url = `https://api.getsong.co/search/?api_key=${encodeURIComponent(apiKey)}&type=both&lookup=${encodeURIComponent(lookupQuery)}&limit=5`;
    const response = await fetch(url);
    if (response.ok) {
      const payload = await response.json();
      if (payload.search && payload.search.length > 0) {
        console.log('[YTM Key Attributor Background] Match found using type=both:', payload.search[0]);
        const result = payload.search[0];
        return {
          success: true,
          key: result.key_of || 'Unknown',
          bpm: result.tempo || 'Unknown',
          camelot: parseKeyToCamelot(result.key_of) || 'Unknown'
        };
      }
      if (payload.search) {
        allRawResults = allRawResults.concat(payload.search);
      }
    }
  } catch (e) {
    console.warn('[YTM Key Attributor Background] type=both search failed:', e);
  }
  
  // Try 2: Fallback search using type=song and filtering by artist name in JS
  console.log('[YTM Key Attributor Background] type=both returned no results. Trying type=song fallback...');
  try {
    const url = `https://api.getsong.co/search/?api_key=${encodeURIComponent(apiKey)}&type=song&lookup=${encodeURIComponent(cleanTitle)}&limit=30`;
    const response = await fetch(url);
    if (response.ok) {
      const payload = await response.json();
      console.log('[YTM Key Attributor Background] Fallback results found:', payload.search);
      if (payload.search && payload.search.length > 0) {
        allRawResults = allRawResults.concat(payload.search);
        // Find a result where the artist matches
        const artistLower = cleanArtist.toLowerCase().trim();
        console.log('[YTM Key Attributor Background] Comparing against artist:', artistLower);
        const matchedResult = payload.search.find(result => {
          const resArtistName = result.artist ? (result.artist.name || '') : '';
          const resArtistLower = resArtistName.toLowerCase().trim();
          console.log(`[YTM Key Attributor Background] Checking result: "${result.title}" by "${resArtistName}"`);
          return resArtistLower.includes(artistLower) || artistLower.includes(resArtistLower);
        });
        
        if (matchedResult) {
          console.log('[YTM Key Attributor Background] Match found using type=song fallback:', matchedResult);
          return {
            success: true,
            key: matchedResult.key_of || 'Unknown',
            bpm: matchedResult.tempo || 'Unknown',
            camelot: parseKeyToCamelot(matchedResult.key_of) || 'Unknown'
          };
        } else {
          console.log('[YTM Key Attributor Background] No artist match in fallback list.');
        }
      }
    }
  } catch (e) {
    console.warn('[YTM Key Attributor Background] type=song search failed:', e);
  }
  
  console.log('[YTM Key Attributor Background] No matches found for song.');
  return {
    success: false,
    rawResults: allRawResults
  };
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
  // Verify that the payload actually has the 'search' array containing results
  return payload && payload.search && payload.search.length > 0;
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
