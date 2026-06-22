// State management
let currentTitle = '';
let currentArtist = '';
let activeSettings = {
  notation: 'both', // 'standard', 'camelot', 'both'
  showBpm: true,
  badgeColor: 'green' // 'green', 'blue', 'purple', 'gray'
};
let activeData = null; // Store currently loaded song attributes

// Constants for Transposition
const PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS_MAP = { "db": "C#", "eb": "D#", "gb": "F#", "ab": "G#", "bb": "A#" };

// Inject CSS styles for the key badge, tooltip, and popover editor
const styleEl = document.createElement('style');
styleEl.id = 'ytm-key-attributor-styles';
styleEl.textContent = `
  .ytm-key-badge-container {
    display: inline-flex;
    align-items: center;
    position: relative;
    margin-left: 12px;
    vertical-align: middle;
    user-select: none;
    font-family: 'Roboto', 'Outfit', sans-serif;
  }
  
  .ytm-key-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.2px;
    cursor: default;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  /* Double click trigger indicator */
  .ytm-key-badge:active {
    transform: scale(0.96);
  }
  
  /* Badge Colors */
  .ytm-key-badge.color-green {
    background: rgba(29, 185, 84, 0.12);
    color: #1db954;
    border-color: rgba(29, 185, 84, 0.25);
  }
  .ytm-key-badge.color-green:hover {
    background: rgba(29, 185, 84, 0.2);
    border-color: rgba(29, 185, 84, 0.4);
    box-shadow: 0 0 8px rgba(29, 185, 84, 0.2);
  }
  
  .ytm-key-badge.color-blue {
    background: rgba(0, 112, 243, 0.12);
    color: #0070f3;
    border-color: rgba(0, 112, 243, 0.25);
  }
  .ytm-key-badge.color-blue:hover {
    background: rgba(0, 112, 243, 0.2);
    border-color: rgba(0, 112, 243, 0.4);
    box-shadow: 0 0 8px rgba(0, 112, 243, 0.2);
  }
  
  .ytm-key-badge.color-purple {
    background: rgba(121, 40, 202, 0.12);
    color: #7928ca;
    border-color: rgba(121, 40, 202, 0.25);
  }
  .ytm-key-badge.color-purple:hover {
    background: rgba(121, 40, 202, 0.2);
    border-color: rgba(121, 40, 202, 0.4);
    box-shadow: 0 0 8px rgba(121, 40, 202, 0.2);
  }
  
  .ytm-key-badge.color-gray {
    background: rgba(255, 255, 255, 0.06);
    color: #aaaaaa;
    border-color: rgba(255, 255, 255, 0.15);
  }
  .ytm-key-badge.color-gray:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.25);
  }
  
  /* Loading state */
  .ytm-key-badge.state-loading {
    background: rgba(255, 255, 255, 0.04);
    color: #888888;
    border-color: rgba(255, 255, 255, 0.08);
    animation: ytm-pulse-loading 1.5s infinite ease-in-out;
  }
  
  /* Setup needed state */
  .ytm-key-badge.state-setup {
    background: rgba(255, 165, 0, 0.12);
    color: #ffa500;
    border-color: rgba(255, 165, 0, 0.3);
    cursor: pointer;
  }
  .ytm-key-badge.state-setup:hover {
    background: rgba(255, 165, 0, 0.2);
    border-color: rgba(255, 165, 0, 0.5);
  }
  
  /* Error / Not Found state */
  .ytm-key-badge.state-notfound {
    background: rgba(255, 255, 255, 0.03);
    color: #666666;
    border-color: rgba(255, 255, 255, 0.08);
  }
  
  @keyframes ytm-pulse-loading {
    0% { opacity: 0.6; }
    50% { opacity: 1; }
    100% { opacity: 0.6; }
  }
  
  /* Tooltip Container */
  .ytm-key-tooltip {
    visibility: hidden;
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%) translateY(4px);
    background: #111111;
    color: #eeeeee;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 11px;
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.15);
    opacity: 0;
    transition: opacity 0.2s ease, transform 0.2s ease;
    z-index: 10000;
    text-align: center;
    pointer-events: none;
  }
  
  .ytm-key-tooltip a {
    color: #0070f3;
    text-decoration: underline;
    pointer-events: auto;
  }
  
  .ytm-key-badge-container:hover .ytm-key-tooltip {
    visibility: visible;
    opacity: 1;
    transform: translateX(-50%) translateY(0);
    pointer-events: auto;
  }
  
  /* Hide tooltip when popover is open */
  .ytm-key-badge-container.popover-open:hover .ytm-key-tooltip {
    visibility: hidden;
    opacity: 0;
  }
  
  /* Subtle arrow for tooltip */
  .ytm-key-tooltip::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: #111111 transparent transparent transparent;
  }
  
  /* Transposing Editor Popover */
  .ytm-key-popover {
    position: absolute;
    bottom: calc(100% + 12px);
    left: 50%;
    transform: translateX(-50%) translateY(10px);
    background: rgba(15, 17, 23, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    padding: 16px;
    width: 230px;
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    z-index: 10001;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
    font-family: inherit;
  }
  
  .ytm-key-popover.show {
    opacity: 1;
    visibility: visible;
    transform: translateX(-50%) translateY(0);
  }
  
  /* Subtle arrow for popover */
  .ytm-key-popover::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: rgba(15, 17, 23, 0.95) transparent transparent transparent;
  }
  
  .ytm-popover-title {
    font-size: 11px;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 12px;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.8;
  }
  
  .ytm-popover-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    gap: 8px;
  }
  
  .ytm-popover-row button {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #ffffff;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .ytm-popover-row button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.25);
  }
  
  .ytm-popover-row button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  
  .ytm-popover-key-display {
    font-size: 15px;
    font-weight: 800;
    color: #1db954;
    min-width: 60px;
    text-align: center;
  }
  
  .ytm-popover-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 10px 0;
  }
  
  .ytm-popover-field {
    margin-bottom: 10px;
  }
  
  .ytm-popover-field label {
    display: block;
    font-size: 9px;
    color: #888888;
    margin-bottom: 4px;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.3px;
  }
  
  .ytm-popover-field select, 
  .ytm-popover-field input {
    width: 100%;
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 12px;
    color: #ffffff;
    outline: none;
    transition: all 0.2s;
  }
  
  .ytm-popover-field select:focus, 
  .ytm-popover-field input:focus {
    border-color: #0070f3;
    box-shadow: 0 0 5px rgba(0, 112, 243, 0.3);
  }
  
  .ytm-popover-actions {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 14px;
  }
  
  .ytm-popover-actions button {
    flex: 1;
    padding: 7px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }
  
  .ytm-popover-btn-save {
    background: linear-gradient(135deg, #7928ca 0%, #0070f3 100%);
    color: #ffffff;
  }
  
  .ytm-popover-btn-save:hover {
    box-shadow: 0 0 10px rgba(0, 112, 243, 0.4);
    transform: translateY(-0.5px);
  }
  
  .ytm-popover-btn-reset {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #aaaaaa;
  }
  
  .ytm-popover-btn-reset:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }
`;
document.head.appendChild(styleEl);

// Load settings and start observation
init();

function init() {
  // Retrieve settings from storage
  chrome.storage.local.get(['notation', 'showBpm', 'badgeColor'], (settings) => {
    if (settings.notation) activeSettings.notation = settings.notation;
    if (settings.showBpm !== undefined) activeSettings.showBpm = settings.showBpm;
    if (settings.badgeColor) activeSettings.badgeColor = settings.badgeColor;
    
    // Begin listening for DOM updates in YouTube Music player
    observePlayerBar();
  });
  
  // Listen for dynamic settings changes from the options page
  chrome.storage.onChanged.addListener((changes) => {
    let needsRedraw = false;
    
    if (changes.notation) {
      activeSettings.notation = changes.notation.newValue;
      needsRedraw = true;
    }
    if (changes.showBpm !== undefined) {
      activeSettings.showBpm = changes.showBpm.newValue;
      needsRedraw = true;
    }
    if (changes.badgeColor) {
      activeSettings.badgeColor = changes.badgeColor.newValue;
      needsRedraw = true;
    }
    if (changes.keyOverrides) {
      // Manual overrides updated in options page, force immediate updates
      needsRedraw = true;
    }
    
    if (needsRedraw) {
      forceRedraw();
    }
  });
}

function forceRedraw() {
  // Clearing activeData triggers a storage check and reload
  currentTitle = '';
  currentArtist = '';
  triggerUpdate();
}

// Watch for song changes using a MutationObserver
function observePlayerBar() {
  const targetNode = document.body;
  
  // YouTube Music player loads dynamically. Wait for player bar to load.
  const intervalId = setInterval(() => {
    const playerBar = document.querySelector('ytmusic-player-bar');
    if (playerBar) {
      clearInterval(intervalId);
      
      const observer = new MutationObserver(() => {
        triggerUpdate();
      });
      
      observer.observe(playerBar, {
        childList: true,
        subtree: true,
        characterData: true
      });
      
      // Run once initially
      triggerUpdate();
    }
  }, 1000);
}

// Extracts metadata and requests Key/BPM if changed
function triggerUpdate() {
  const metadata = getSongMetadata();
  if (!metadata) return;
  
  // Only query if the song has changed
  if (metadata.title !== currentTitle || metadata.artist !== currentArtist) {
    currentTitle = metadata.title;
    currentArtist = metadata.artist;
    activeData = null;
    
    // Close override popover if open from a previous track
    closeOverridePopover();
    
    setLoadingState();
    
    const lookupKey = `${currentTitle.toLowerCase().trim()} - ${currentArtist.toLowerCase().trim()}`;
    
    // Step 1: Check manual overrides first
    chrome.storage.local.get(['keyOverrides'], (storage) => {
      // Double check that we are still on the same song
      const freshMetadata = getSongMetadata();
      if (!freshMetadata || freshMetadata.title !== currentTitle || freshMetadata.artist !== currentArtist) {
        return;
      }
      
      const overrides = storage.keyOverrides || {};
      
      if (overrides[lookupKey]) {
        // Load manual override
        activeData = {
          ...overrides[lookupKey],
          isOverride: true
        };
        renderBadge(activeData);
      } else {
        // Step 2: Fallback to background query (API fetch)
        chrome.runtime.sendMessage(
          { action: 'fetchKeyBpm', title: currentTitle, artist: currentArtist },
          (response) => {
            const currentMetadata = getSongMetadata();
            if (!currentMetadata || currentMetadata.title !== metadata.title || currentMetadata.artist !== metadata.artist) {
              return; // Song changed while waiting for API, discard response
            }
            
            if (response && response.data) {
              activeData = response.data;
              renderBadge(activeData);
            } else if (response && response.error === 'API_KEY_MISSING') {
              renderSetupState();
            } else {
              renderNotFoundState(response ? response.error : 'Not Found');
            }
          }
        );
      }
    });
  }
}

// Scrapes currently playing metadata from the DOM
function getSongMetadata() {
  const playerBar = document.querySelector('ytmusic-player-bar');
  if (!playerBar) return null;
  
  const titleEl = playerBar.querySelector('.title') || 
                  playerBar.querySelector('yt-formatted-string.title') || 
                  playerBar.querySelector('.middle-controls .title');
  const title = titleEl ? (titleEl.textContent || titleEl.innerText).trim() : '';
  
  let artist = '';
  const bylineEl = playerBar.querySelector('.byline') || 
                   playerBar.querySelector('.middle-controls .byline');
  if (bylineEl) {
    const artistLink = bylineEl.querySelector('a');
    if (artistLink) {
      artist = (artistLink.textContent || artistLink.innerText).trim();
    } else {
      const text = (bylineEl.textContent || bylineEl.innerText).trim();
      if (text) {
        artist = text.split('•')[0].trim();
      }
    }
  }
  
  if (!title) return null;
  return { title, artist };
}

// Creates or fetches the badge elements in the player bar
function getOrCreateBadgeElements() {
  const playerBar = document.querySelector('ytmusic-player-bar');
  if (!playerBar) return null;
  
  const infoWrapper = playerBar.querySelector('.content-info-wrapper') || 
                      playerBar.querySelector('.middle-controls');
  if (!infoWrapper) return null;
  
  let container = document.getElementById('ytm-key-attributor-badge-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'ytm-key-attributor-badge-container';
    container.className = 'ytm-key-badge-container';
    
    const badge = document.createElement('div');
    badge.id = 'ytm-key-attributor-badge';
    badge.className = 'ytm-key-badge';
    
    // Hint that double-click edits key
    badge.title = 'Double-click to manually transpose or override key';
    
    const tooltip = document.createElement('div');
    tooltip.id = 'ytm-key-attributor-tooltip';
    tooltip.className = 'ytm-key-tooltip';
    
    // Inject popover skeleton
    const popover = document.createElement('div');
    popover.id = 'ytm-key-override-popover';
    popover.className = 'ytm-key-popover';
    
    container.appendChild(badge);
    container.appendChild(tooltip);
    container.appendChild(popover);
    
    infoWrapper.appendChild(container);
  }
  
  return {
    container: container,
    badge: container.querySelector('#ytm-key-attributor-badge'),
    tooltip: container.querySelector('#ytm-key-attributor-tooltip'),
    popover: container.querySelector('#ytm-key-override-popover')
  };
}

// Renders the loading animation state
function setLoadingState() {
  const el = getOrCreateBadgeElements();
  if (!el) return;
  
  el.badge.className = 'ytm-key-badge state-loading';
  el.badge.onclick = null;
  el.badge.ondblclick = null;
  el.badge.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
      <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
      <path d="M12 2 A10 10 0 0 1 22 12" stroke-dasharray="16" stroke-dashoffset="0"></path>
    </svg>
    <span>Analyzing...</span>
  `;
  
  if (!document.getElementById('ytm-spinner-styles')) {
    const s = document.createElement('style');
    s.id = 'ytm-spinner-styles';
    s.textContent = `
      .ytm-key-badge svg {
        animation: ytm-spin 1s linear infinite;
      }
      @keyframes ytm-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(s);
  }
  
  el.tooltip.innerHTML = 'Querying GetSongBPM database...';
}

// Renders the setup instruction state (if API key missing)
function renderSetupState() {
  const el = getOrCreateBadgeElements();
  if (!el) return;
  
  el.badge.className = 'ytm-key-badge state-setup';
  el.badge.innerHTML = `⚠️ Set API Key`;
  el.badge.onclick = () => {
    chrome.runtime.sendMessage({ action: 'openOptions' });
  };
  el.badge.ondblclick = null;
  
  el.tooltip.innerHTML = `Click here to setup your free GetSongBPM API Key in extension settings.`;
}

// Renders the song not found or error state
function renderNotFoundState(reason) {
  const el = getOrCreateBadgeElements();
  if (!el) return;
  
  el.badge.className = 'ytm-key-badge state-notfound color-gray';
  el.badge.onclick = null;
  el.badge.innerHTML = `N/A`;
  
  // Enable override even if song not found in API! Double click allows setting key manually.
  el.badge.ondblclick = () => {
    openOverridePopover({ key: 'Unknown', bpm: 'Unknown', camelot: 'Unknown' });
  };
  
  el.tooltip.innerHTML = `Double-click to manually define Key/BPM.<br><span style="opacity:0.6;font-size:9px">Not in API: ${reason}</span>`;
}

// Renders the successful key and BPM attributes
function renderBadge(data) {
  const el = getOrCreateBadgeElements();
  if (!el) return;
  
  const badgeColor = activeSettings.badgeColor;
  el.badge.className = `ytm-key-badge color-${badgeColor}`;
  el.badge.onclick = null;
  
  // Set double-click listener to open manual override dialog
  el.badge.ondblclick = () => {
    openOverridePopover(data);
  };
  
  // Build representation based on display settings
  let displayParts = [];
  
  // 1. Key notation formatting
  if (data.key && data.key !== 'Unknown') {
    if (activeSettings.notation === 'standard') {
      displayParts.push(`Key: ${data.key}`);
    } else if (activeSettings.notation === 'camelot') {
      displayParts.push(`Key: ${data.camelot}`);
    } else {
      // 'both'
      displayParts.push(`Key: ${data.key} (${data.camelot})`);
    }
  } else {
    displayParts.push('Key: Unknown');
  }
  
  // 2. BPM formatting
  if (activeSettings.showBpm && data.bpm && data.bpm !== 'Unknown') {
    displayParts.push(`${data.bpm} BPM`);
  }
  
  // Add edit pencil icon to denote manual override status
  const pencilIcon = data.isOverride ? 
    `<span style="margin-left:4px;font-size:10px;opacity:0.8;" title="Manually overridden">✏️</span>` : '';
  
  // Render HTML content
  el.badge.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M9 18V5l12-2v13"></path>
      <circle cx="6" cy="18" r="3" fill="currentColor"></circle>
      <circle cx="18" cy="16" r="3" fill="currentColor"></circle>
    </svg>
    <span>${displayParts.join('  •  ')}</span>
    ${pencilIcon}
  `;
  
  // Set complying TOS hover tooltip
  if (data.isOverride) {
    el.tooltip.innerHTML = `
      <strong>Manual Override:</strong> Adjusted by user.<br>Double-click to transpose or reset.
    `;
  } else {
    el.tooltip.innerHTML = `
      <strong>Attribution:</strong> Key & BPM provided by <a href="https://getsongbpm.com" target="_blank" rel="noopener noreferrer">GetSongBPM.com</a>.<br>Double-click to manually transpose.
    `;
  }
}

// Global click listener to close popover on clicking outside
document.addEventListener('click', (e) => {
  const container = document.getElementById('ytm-key-attributor-badge-container');
  if (container && !container.contains(e.target)) {
    closeOverridePopover();
  }
});

// Close Popover Helper
function closeOverridePopover() {
  const elements = getOrCreateBadgeElements();
  if (elements && elements.popover) {
    elements.popover.classList.remove('show');
    elements.container.classList.remove('popover-open');
  }
}

// Opens the Transpose / Manual Override UI
function openOverridePopover(data) {
  const el = getOrCreateBadgeElements();
  if (!el) return;
  
  // Mark container as popover-open to disable hover tooltip
  el.container.classList.add('popover-open');
  
  // Parse current values
  let currentKeyVal = data.key || 'Unknown';
  let currentBpmVal = data.bpm || '120';
  
  // Generate HTML for the popover panel
  el.popover.innerHTML = `
    <div class="ytm-popover-title">Manual Key Override</div>
    
    <div class="ytm-popover-row">
      <button type="button" id="ytm-popover-dec" ${currentKeyVal === 'Unknown' ? 'disabled' : ''}>-1 Semi</button>
      <span class="ytm-popover-key-display" id="ytm-popover-display-key">${currentKeyVal}</span>
      <button type="button" id="ytm-popover-inc" ${currentKeyVal === 'Unknown' ? 'disabled' : ''}>+1 Semi</button>
    </div>
    
    <div class="ytm-popover-divider"></div>
    
    <div class="ytm-popover-field">
      <label for="ytm-popover-select">Select Key</label>
      <select id="ytm-popover-select">
        <option value="Unknown" ${currentKeyVal === 'Unknown' ? 'selected' : ''}>Unknown</option>
        <optgroup label="Major Keys">
          ${PITCH_CLASSES.map(k => `<option value="${k}" ${currentKeyVal === k ? 'selected' : ''}>${k} Major</option>`).join('')}
        </optgroup>
        <optgroup label="Minor Keys">
          ${PITCH_CLASSES.map(k => `<option value="${k}m" ${currentKeyVal === (k + 'm') ? 'selected' : ''}>${k} Minor</option>`).join('')}
        </optgroup>
      </select>
    </div>
    
    <div class="ytm-popover-field">
      <label for="ytm-popover-bpm-input">BPM (Tempo)</label>
      <input type="number" id="ytm-popover-bpm-input" min="30" max="300" value="${currentBpmVal !== 'Unknown' ? currentBpmVal : '120'}">
    </div>
    
    <div class="ytm-popover-actions">
      <button type="button" class="ytm-popover-btn-reset" id="ytm-popover-btn-reset">Reset</button>
      <button type="button" class="ytm-popover-btn-save" id="ytm-popover-btn-save">Save</button>
    </div>
  `;
  
  // Show popover
  el.popover.classList.add('show');
  
  // Setup Event Listeners inside Popover
  const displayKey = el.popover.querySelector('#ytm-popover-display-key');
  const selectKey = el.popover.querySelector('#ytm-popover-select');
  const inputBpm = el.popover.querySelector('#ytm-popover-bpm-input');
  const btnDec = el.popover.querySelector('#ytm-popover-dec');
  const btnInc = el.popover.querySelector('#ytm-popover-inc');
  const btnReset = el.popover.querySelector('#ytm-popover-btn-reset');
  const btnSave = el.popover.querySelector('#ytm-popover-btn-save');
  
  // Sync select input dropdown with current display key
  function updatePopoverKey(newKey) {
    currentKeyVal = newKey;
    displayKey.textContent = newKey;
    selectKey.value = newKey;
    
    if (newKey === 'Unknown') {
      btnDec.disabled = true;
      btnInc.disabled = true;
    } else {
      btnDec.disabled = false;
      btnInc.disabled = false;
    }
  }
  
  // Semi-tone adjustment listeners
  btnDec.addEventListener('click', () => {
    const transposed = calculateTransposition(currentKeyVal, -1);
    updatePopoverKey(transposed);
  });
  
  btnInc.addEventListener('click', () => {
    const transposed = calculateTransposition(currentKeyVal, 1);
    updatePopoverKey(transposed);
  });
  
  // Select Dropdown change listener
  selectKey.addEventListener('change', (e) => {
    updatePopoverKey(e.target.value);
  });
  
  // Save button listener
  btnSave.addEventListener('click', () => {
    const key = currentKeyVal;
    const bpm = parseInt(inputBpm.value, 10) || 'Unknown';
    const camelot = parseKeyToCamelot(key) || 'Unknown';
    
    saveOverride(key, bpm, camelot);
  });
  
  // Reset button listener
  btnReset.addEventListener('click', () => {
    resetOverride();
  });
}

// Transposes a standard musical key string by a offset in semitones
function calculateTransposition(keyStr, semitones) {
  if (!keyStr || keyStr === 'Unknown') return 'Unknown';
  
  let isMinor = false;
  let keyName = keyStr.trim();
  
  // Extract major/minor
  if (keyName.endsWith('m')) {
    isMinor = true;
    keyName = keyName.slice(0, -1);
  }
  
  // Normalize flats to sharps
  const lowerName = keyName.toLowerCase();
  if (FLATS_MAP[lowerName]) {
    keyName = FLATS_MAP[lowerName];
  }
  
  let index = PITCH_CLASSES.indexOf(keyName);
  if (index === -1) {
    // Case insensitive find
    index = PITCH_CLASSES.findIndex(k => k.toLowerCase() === lowerName);
  }
  
  if (index === -1) return keyStr; // Return unchanged if parse fails
  
  let newIndex = (index + semitones) % 12;
  if (newIndex < 0) newIndex += 12;
  
  return `${PITCH_CLASSES[newIndex]}${isMinor ? 'm' : ''}`;
}

// Writes the override to chrome.storage.local
function saveOverride(key, bpm, camelot) {
  const songKey = `${currentTitle.toLowerCase().trim()} - ${currentArtist.toLowerCase().trim()}`;
  
  chrome.storage.local.get(['keyOverrides'], (storage) => {
    const overrides = storage.keyOverrides || {};
    overrides[songKey] = {
      title: currentTitle,
      artist: currentArtist,
      key: key,
      bpm: bpm,
      camelot: camelot,
      dateAdded: new Date().toISOString()
    };
    
    chrome.storage.local.set({ keyOverrides: overrides }, () => {
      // Update local state and redraw badge
      activeData = {
        key: key,
        bpm: bpm,
        camelot: camelot,
        isOverride: true
      };
      renderBadge(activeData);
      closeOverridePopover();
    });
  });
}

// Deletes the manual override and triggers API re-fetch
function resetOverride() {
  const songKey = `${currentTitle.toLowerCase().trim()} - ${currentArtist.toLowerCase().trim()}`;
  
  chrome.storage.local.get(['keyOverrides'], (storage) => {
    const overrides = storage.keyOverrides || {};
    if (overrides[songKey]) {
      delete overrides[songKey];
      chrome.storage.local.set({ keyOverrides: overrides }, () => {
        activeData = null;
        currentTitle = ''; // force re-evaluation of track attributes
        currentArtist = '';
        triggerUpdate();
        closeOverridePopover();
      });
    } else {
      closeOverridePopover();
    }
  });
}

// Key parser to map key names to Camelot Wheel notation
function parseKeyToCamelot(keyStr) {
  if (!keyStr || keyStr === 'Unknown') return null;
  
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
