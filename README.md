# YTM Key Attributor

A lightweight, modern, and beautiful Chrome Extension (Manifest v3) that performs **real-time local Digital Signal Processing (DSP)** to analyze and display musical attributes directly inside the **YouTube Music** player bar.

Unlike traditional database-reliant solutions, this extension operates as a **Pure Frontend Live Audio Tuner**, analyzing the tab's audio stream locally inside the browser. It features **Dual Detection** to track both the overall song key and the currently playing chord simultaneously.

---

## Key Features

- 🎵 **Dual Real-time Detection**:
  - **Global Key (Cumulative Window)**: Accumulates all audio frames since the track started and correlates them using the Krumhansl-Schmuckler pitch profiles to identify the overall musical key signature.
  - **Live Chord (Short Window)**: Evaluates a sliding 1.5-second audio window against 24 major and minor chord templates to determine the currently playing chord in real-time.
- ⚡ **Zero Network Latency & Privacy-First**: 100% local Web Audio API signal processing. The extension makes **no external API calls** and sends no audio or telemetry data over the network.
- ⏸️ **Silent Bypass & Auto-Reset**:
  - Dynamically pauses DSP computations when the music is paused or silent (`rms < 0.0005`), dropping CPU overhead to 0%.
  - Automatically resets cumulative averages and tuner history when a new track is loaded or after 5 seconds of consecutive silence.
- 🎨 **Premium Aesthetics**: Integrates natively into the player bar next to the song title with a glassmorphic badge, subtle CSS animations, and customizable Spotify Green, Electric Blue, Amethyst Purple, or Charcoal Gray themes.
- ⚙️ **Manual Overrides & Transposer**: Double-clicking the player bar badge opens an interactive popover to manually transpose the key (semitone offset adjustments) or type in/save custom attributes.
- 📊 **Detections Log for Analysis**: Saves a rolling log of up to 2,000 detection frames in `chrome.storage.local`. Logs can be monitored in the developer console via `window.dumpYtmKeyAttributorLogs(format)` or downloaded as a CSV file from the Options dashboard.
- 🛡️ **XSS Protection**: Sanitizes all DOM-scraped metadata using HTML entity escaping before rendering inside the extension UI.

---

## How It Works (Technical Architecture)

```
[ YTM Audio Stream ]
         │
         ▼  (chrome.tabCapture)
[ Background Service Worker ]
         │
         ▼  (chrome.offscreen)
[ Offscreen Audio Analyzer ] (invisible context)
   ├── Web Audio AnalyserNode (FFT Size: 4096)
   ├── Volume Envelope RMS Tracker (50Hz) ──► Silent Bypass / Idle state
   │
   ├── 12-Tone Semitone Chromagram
   │     │
   │     ├── Cumulative Buffer ──► Pearson Correlation ──► Global Key (e.g. A Minor)
   │     │                           (Krumhansl-Schmuckler)
   │     │
   │     └── 1.5s Sliding Window ──► Template Matching ──► Live Chord (e.g. Dm)
   │                                  (Score: EC - 0.6 * ENC)
   ▼
[ Content Script (content.js) ] ──► Inject Premium Player Badge (Key | Chord • BPM)
```

1. **Audio Capture**: The background worker (`background.js`) uses the `chrome.tabCapture` API to grab the digital audio stream of the active tab.
2. **Offscreen Document Workaround**: In Manifest v3, background service workers cannot access the DOM or the Web Audio API. The stream ID is relayed to an invisible offscreen document (`offscreen.html` + `analyzer.js`) running under the `USER_MEDIA` reason.
3. **Chroma Vector Extraction**: The raw audio stream is piped into a Web Audio `AnalyserNode`. Frequency bins between 65Hz and 1050Hz (C2 to C6) are mapped to MIDI note numbers and grouped into 12 semitone bins to form a running Chromagram.
4. **Key Detection (Pearson Correlation)**: The accumulated chromagram is correlated using a numerically stable Pearson Correlation Coefficient against Krumhansl-Kessler pitch profiles.
5. **Chord Classification**: The 1.5-second average chroma profile is scored against 24 major and minor chord templates. The score is calculated as the chord tone energy minus 60% of the non-chord energy: `Score = chordEnergy - 0.6 * nonChordEnergy`.
6. **BPM / Onset Tracking**: A envelope tracker analyzes root-mean-square (RMS) amplitude peaks to log onset timestamps (min 260ms refractory period) and calculates the median tempo interval.

---

## Installation Guide (Chrome Developer Mode)

As this is a custom extension, it is loaded unpacked:

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle the **"Developer mode"** switch (top-right corner) to **On**.
3. Click the **"Load unpacked"** button (top-left corner).
4. Select the project folder: `c:\EladServices\ytm-key-attributor`.
5. The extension is now loaded and active!

---

## How to Use

1. Open [YouTube Music](https://music.youtube.com) and play any track.
2. Look at the player bar next to the song title; you will see the badge showing: **🎧 Click icon to tune**.
3. Click the **YTM Key Attributor** extension icon in your Chrome toolbar.
4. The badge will transition to **🎧 Listening...** and begin analysis.
5. Within 5-10 seconds, it will lock on the overall **Key** and dynamically update the **Chord** and **BPM** (e.g. `🎵 Key: A Minor (8A) | Chord: Dm  •  120 BPM`).
6. **Double-click** the badge at any time to open the manual override transposer.
7. To access the settings panel or download detection logs for analysis, right-click the extension icon and select **Options**.
