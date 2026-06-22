# YTM Key Attributor

A lightweight, modern, and beautiful Chrome extension built for personal use that adds musical attributes (Key and BPM/Tempo) to currently playing tracks on the **YouTube Music** player bar. 

It queries the [GetSongBPM](https://getsongbpm.com) database to retrieve song features and displays them as a native-looking badge right next to the song title.

---

## Features

- 🎵 **Real-time Attribution:** Automatically detects song changes in YouTube Music and displays the musical key and BPM.
- 🔄 **Supports Multiple Notations:** Displays keys in Standard notation (e.g. `F#m`), Camelot code (e.g. `11A`), or both (e.g. `F#m (11A)`).
- ⚡ **Performance Optimized:** Uses a local, in-memory cache to store resolved song results to minimize network latency and API requests.
- 🎨 **Premium Aesthetics:** Integrates smoothly into the YouTube Music player bar with semi-transparent glassmorphic badges, loading spinners, and adjustable theme colors.
- ⚙️ **Dashboard Configurator:** Features an Options page to manage settings, API key authentication, and toggle displays.
- 🔒 **Privacy Focused:** Runs completely client-side in your browser. Your API credentials are saved safely in `chrome.storage.local`.

---

## Installation Guide (Chrome Developer Mode)

Since this is a custom extension for personal use, you can load it as an "Unpacked" extension in Google Chrome:

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle the **"Developer mode"** switch in the top-right corner to **On**.
3. Click the **"Load unpacked"** button in the top-left corner.
4. Select the project folder: `c:\EladServices\ytm-key-attributor`.
5. The extension is now loaded and active!

---

## Obtaining a Free GetSongBPM API Key

This extension utilizes the free database provided by GetSongBPM. To activate it, you will need a personal API key:

1. Visit the [GetSongBPM API Portal](https://getsongbpm.com/api).
2. Register for a free account.
3. Once registered, generate your developer `api_key`.
4. Open the extension's options page:
   - Click the extension icon in Chrome and click **Options**, or
   - Go to `chrome://extensions/`, find **YTM Key Attributor**, and click **Details** ➡️ **Extension options**.
5. Paste your API Key in the field and click **Test Key** to verify.
6. Click **Save Settings**.
7. Open or refresh [YouTube Music](https://music.youtube.com/) and play a track!

---

## Technical Details

- **Manifest Version:** MV3
- **Network Stack:** Native browser Fetch API directed through Chrome background service worker (`background.js`) to bypass CORS.
- **DOM Integration:** `content.js` monitors the YTM SPA interface using a `MutationObserver` targetting `.title` modifications on the `<ytmusic-player-bar>` component.
- **Attribution Policy:** Includes an interactive hover tooltip in the player bar badge with a backlink directly to `getsongbpm.com` in compliance with their API Terms of Service.
