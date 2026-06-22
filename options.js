// Elements
const form = document.getElementById('settingsForm');
const apiKeyInput = document.getElementById('apiKey');
const notationSelect = document.getElementById('notation');
const showBpmInput = document.getElementById('showBpm');
const themeButtons = document.querySelectorAll('.theme-btn');
const btnTest = document.getElementById('btnTest');
const testIndicator = document.getElementById('testIndicator');
const testMessage = document.getElementById('testMessage');
const toast = document.getElementById('toast');
const toastText = document.getElementById('toastText');
const toastIcon = document.getElementById('toastIcon');
const overridesList = document.getElementById('overridesList');

let selectedTheme = 'green';

// SVG Icons for Test Indicator
const ICONS = {
  loading: `<svg class="spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor"></path></svg>`,
  success: `<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
  failed: `<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
};

// Toast Path Templates
const TOAST_ICONS = {
  success: `<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>`,
  error: `<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>`
};

// Document Loaded - Read saved settings
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(
    {
      apiKey: '',
      notation: 'both',
      showBpm: true,
      badgeColor: 'green'
    },
    (items) => {
      apiKeyInput.value = items.apiKey;
      notationSelect.value = items.notation;
      showBpmInput.checked = items.showBpm;
      
      // Highlight the active theme button
      selectedTheme = items.badgeColor;
      themeButtons.forEach(btn => {
        if (btn.getAttribute('data-theme') === selectedTheme) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
      
      // Load manual overrides
      loadManualOverrides();
    }
  );
});

// Theme Button Click Handler
themeButtons.forEach(button => {
  button.addEventListener('click', () => {
    themeButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    selectedTheme = button.getAttribute('data-theme');
  });
});

// Save Settings Form Submission
form.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const apiKey = apiKeyInput.value.trim();
  const notation = notationSelect.value;
  const showBpm = showBpmInput.checked;
  const badgeColor = selectedTheme;
  
  chrome.storage.local.set(
    {
      apiKey,
      notation,
      showBpm,
      badgeColor
    },
    () => {
      showToast('Settings saved successfully!', 'success');
    }
  );
});

// Test Connection Handler
btnTest.addEventListener('click', () => {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    showToast('Please enter an API Key first', 'error');
    return;
  }
  
  // Show loading indicator
  testIndicator.className = 'test-indicator show loading';
  testIndicator.innerHTML = `${ICONS.loading} <span id="testMessage">Connecting to GetSongBPM...</span>`;
  
  chrome.runtime.sendMessage(
    { action: 'testConnection', apiKey },
    (response) => {
      if (response && response.success) {
        testIndicator.className = 'test-indicator show success';
        testIndicator.innerHTML = `${ICONS.success} <span id="testMessage">Connection successful! Key is valid.</span>`;
        showToast('API Key validated!', 'success');
      } else {
        const errMsg = response && response.error ? response.error : 'Invalid API Key';
        testIndicator.className = 'test-indicator show failed';
        testIndicator.innerHTML = `${ICONS.failed} <span id="testMessage">Connection failed: ${errMsg}</span>`;
        showToast('API Key validation failed.', 'error');
      }
    }
  );
});

// Display Toast Alert Utility
function showToast(message, type = 'success') {
  toastText.textContent = message;
  toastIcon.innerHTML = TOAST_ICONS[type];
  
  if (type === 'error') {
    toast.classList.add('error');
  } else {
    toast.classList.remove('error');
  }
  
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Load and Render Manual Overrides List
function loadManualOverrides() {
  chrome.storage.local.get(['keyOverrides'], (result) => {
    const overrides = result.keyOverrides || {};
    const songKeys = Object.keys(overrides);
    
    if (songKeys.length === 0) {
      overridesList.innerHTML = `<div class="overrides-empty">No manual key overrides saved yet.</div>`;
      return;
    }
    
    // Clear list
    overridesList.innerHTML = '';
    
    // Sort overrides by addition date (descending)
    songKeys.sort((a, b) => {
      return new Date(overrides[b].dateAdded || 0) - new Date(overrides[a].dateAdded || 0);
    });
    
    songKeys.forEach(songKey => {
      const data = overrides[songKey];
      const itemEl = document.createElement('div');
      itemEl.className = 'override-item';
      
      // Capitalize song title and artist
      const songTitle = data.title || 'Unknown Song';
      const songArtist = data.artist || 'Unknown Artist';
      const keyVal = data.key || 'Unknown';
      const bpmVal = data.bpm || 'Unknown';
      const camelotVal = data.camelot || 'Unknown';
      
      const badgeText = bpmVal !== 'Unknown' ? `${keyVal} (${camelotVal}) • ${bpmVal} BPM` : `${keyVal} (${camelotVal})`;
      
      itemEl.innerHTML = `
        <div class="override-info">
          <span class="override-song">${songTitle}</span>
          <span class="override-artist">${songArtist}</span>
        </div>
        <div class="override-values-delete">
          <span class="override-badge">${badgeText}</span>
          <button type="button" class="override-delete" data-key="${songKey}" title="Delete override">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      `;
      
      // Wire delete button listener
      const delBtn = itemEl.querySelector('.override-delete');
      delBtn.addEventListener('click', () => {
        deleteOverride(songKey);
      });
      
      overridesList.appendChild(itemEl);
    });
  });
}

// Delete Manual Override Function
function deleteOverride(songKey) {
  chrome.storage.local.get(['keyOverrides'], (result) => {
    const overrides = result.keyOverrides || {};
    if (overrides[songKey]) {
      delete overrides[songKey];
      chrome.storage.local.set({ keyOverrides: overrides }, () => {
        showToast('Override deleted successfully', 'success');
        loadManualOverrides();
      });
    }
  });
}
