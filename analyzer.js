// Audio DSP Analyzer running in the Offscreen Document context.
// Captures the tab audio stream, performs real-time FFT / Chromagram key detection,
// and envelope onset tracking for BPM estimation.

let audioContext = null;
let mediaStreamSource = null;
let analyserNode = null;
let stream = null;
let analysisInterval = null;

// Krumhansl-Schmuckler Key Profiles (Krumhansl-Kessler)
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const CAMELOT_MAJOR = ["8B", "3B", "10B", "5B", "12B", "7B", "2B", "9B", "4B", "11B", "6B", "1B"];
const CAMELOT_MINOR = ["5A", "12A", "7A", "2A", "9A", "4A", "11A", "6A", "1A", "8A", "3A", "10A"];

// History Buffers for DSP Smoothing
const CHROMA_HISTORY = [];
const MAX_CHROMA_HISTORY = 100; // 10 seconds at 100ms sample interval
const KEY_CONFIDENCE_HISTORY = [];
const MAX_KEY_HISTORY = 20;

// BPM / Onset Detection State
const RMS_HISTORY = [];
const MAX_RMS_HISTORY = 150; // ~3 seconds at 20ms frame rate
const BEAT_TIMESTAMPS = [];
const MAX_BEAT_HISTORY = 15;

// Listen for messages from the service worker
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log("[YTM Key Attributor Analyzer] Message received:", message);
  if (message.action === "start-analysis") {
    const { streamId } = message;
    try {
      await startAnalysis(streamId);
      sendResponse({ success: true });
    } catch (err) {
      console.error("[YTM Key Attributor Analyzer] Error starting analysis:", err);
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

  if (message.action === "stop-analysis") {
    stopAnalysis();
    sendResponse({ success: true });
    return true;
  }

  if (message.action === "reset-history") {
    clearHistory();
    sendResponse({ success: true });
    return true;
  }
});

function clearHistory() {
  console.log("[YTM Key Attributor Analyzer] Clearing history buffers.");
  CHROMA_HISTORY.length = 0;
  KEY_CONFIDENCE_HISTORY.length = 0;
  RMS_HISTORY.length = 0;
  BEAT_TIMESTAMPS.length = 0;
}

// Pearson Correlation Coefficient calculation
function pearsonCorrelation(x, y) {
  const n = x.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }
  const num = (n * sumXY) - (sumX * sumY);
  const den = Math.sqrt(((n * sumX2) - (sumX * sumX)) * ((n * sumY2) - (sumY * sumY)));
  if (den === 0) return 0;
  return num / den;
}

// Rotates a profile array to candidate tonic position
function rotateProfile(profile, offset) {
  const rotated = [];
  for (let i = 0; i < 12; i++) {
    rotated[i] = profile[(i - offset + 12) % 12];
  }
  return rotated;
}

// Estimates the running BPM by finding the median of recent inter-beat intervals
function estimateBpm() {
  if (BEAT_TIMESTAMPS.length < 4) return null;
  
  const intervals = [];
  for (let i = 1; i < BEAT_TIMESTAMPS.length; i++) {
    const diff = BEAT_TIMESTAMPS[i] - BEAT_TIMESTAMPS[i - 1];
    // Limit to reasonable musical tempo intervals (250ms = 240 BPM, 1200ms = 50 BPM)
    if (diff >= 250 && diff <= 1200) {
      intervals.push(diff);
    }
  }

  if (intervals.length === 0) return null;
  
  // Compute median interval
  intervals.sort((a, b) => a - b);
  const medianInterval = intervals[Math.floor(intervals.length / 2)];
  
  // Calculate BPM
  const rawBpm = Math.round(60000 / medianInterval);
  return rawBpm;
}

// Main capture and AudioContext initializer
async function startAnalysis(streamId) {
  stopAnalysis(); // Reset any active state first
  
  console.log("[YTM Key Attributor Analyzer] Initializing stream with ID:", streamId);
  
  stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId
      }
    },
    video: false
  });
  
  audioContext = new AudioContext();
  mediaStreamSource = audioContext.createMediaStreamSource(stream);
  analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 4096;
  
  // Route audio to speakers to prevent muting the tab!
  mediaStreamSource.connect(audioContext.destination);
  mediaStreamSource.connect(analyserNode);

  const bufferLength = analyserNode.frequencyBinCount;
  const freqData = new Float32Array(bufferLength);
  const timeData = new Uint8Array(bufferLength);
  
  const sampleRate = audioContext.sampleRate;
  
  let lastBeatTime = 0;
  let frameCounter = 0;

  // Run the DSP analysis loop
  analysisInterval = setInterval(() => {
    if (!analyserNode) return;
    
    frameCounter++;

    // 1. BPM / Onset Detection (Every ~20ms, or every cycle if interval is 20ms)
    // To achieve good resolution, we check time-domain volume peaks
    analyserNode.getByteTimeDomainData(timeData);
    let sumSquares = 0;
    for (let i = 0; i < timeData.length; i++) {
      const normalized = (timeData[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / timeData.length);
    
    // Check if the signal is silent (idle) to avoid sampling when music is paused/silent
    if (rms < 0.0005) {
      if (frameCounter % 25 === 0) { // Send updates occasionally to avoid message flood
        chrome.runtime.sendMessage({
          action: "update-analysis-results",
          data: {
            isIdle: true,
            bpm: "Paused",
            key: "Unknown",
            camelot: "Unknown"
          }
        }).catch(() => {});
      }
      return;
    }
    
    // Add to history
    RMS_HISTORY.push(rms);
    if (RMS_HISTORY.length > MAX_RMS_HISTORY) {
      RMS_HISTORY.shift();
    }
    
    // Compute average energy
    const avgRms = RMS_HISTORY.reduce((sum, v) => sum + v, 0) / RMS_HISTORY.length;
    const now = Date.now();
    
    // Detection criteria: RMS is a peak, substantially above local average, and respects refractory period (min 260ms = 230BPM)
    if (rms > avgRms * 1.4 && rms > 0.02 && (now - lastBeatTime > 260)) {
      BEAT_TIMESTAMPS.push(now);
      if (BEAT_TIMESTAMPS.length > MAX_BEAT_HISTORY) {
        BEAT_TIMESTAMPS.shift();
      }
      lastBeatTime = now;
    }

    // 2. Chroma / Key Analysis (Every 100ms, i.e., every 5th frame)
    if (frameCounter % 5 === 0) {
      analyserNode.getFloatFrequencyData(freqData);
      
      const chroma = new Float32Array(12);
      
      for (let i = 0; i < bufferLength; i++) {
        const freq = i * sampleRate / analyserNode.fftSize;
        
        // Focus on mid-range frequencies where key tones are most defined (C2 to C6)
        if (freq < 65 || freq > 1050) continue;
        
        // Convert bin frequency to midi note number
        const midiNote = 12 * Math.log2(freq / 440) + 69;
        const noteInt = Math.round(midiNote);
        const dev = Math.abs(midiNote - noteInt);
        
        // Only count bins close to standard pitch centers
        if (dev > 0.4) continue;
        
        const pitchClass = noteInt % 12;
        
        // Convert dB amplitude to linear scale
        const db = freqData[i];
        if (db < -90) continue; // Noise floor cutoff
        const amplitude = Math.pow(10, db / 20);
        
        chroma[pitchClass] += amplitude;
      }
      
      // Add chroma vector to rolling window history
      CHROMA_HISTORY.push(chroma);
      if (CHROMA_HISTORY.length > MAX_CHROMA_HISTORY) {
        CHROMA_HISTORY.shift();
      }
      
      // Sum history chroma vectors to obtain smooth rolling average chroma profile
      const avgChroma = new Float32Array(12);
      for (let h = 0; h < CHROMA_HISTORY.length; h++) {
        for (let p = 0; p < 12; p++) {
          avgChroma[p] += CHROMA_HISTORY[h][p];
        }
      }
      
      // Find maximum correlation against 24 profiles
      let bestKeyName = "Unknown";
      let bestCamelot = "Unknown";
      let maxCorrelation = -1;
      
      for (let root = 0; root < 12; root++) {
        // Test Major Key profile
        const rotatedMajor = rotateProfile(MAJOR_PROFILE, root);
        const rMajor = pearsonCorrelation(avgChroma, rotatedMajor);
        if (rMajor > maxCorrelation) {
          maxCorrelation = rMajor;
          bestKeyName = NOTE_NAMES[root] + " Major";
          bestCamelot = CAMELOT_MAJOR[root];
        }
        
        // Test Minor Key profile
        const rotatedMinor = rotateProfile(MINOR_PROFILE, root);
        const rMinor = pearsonCorrelation(avgChroma, rotatedMinor);
        if (rMinor > maxCorrelation) {
          maxCorrelation = rMinor;
          bestKeyName = NOTE_NAMES[root] + " Minor";
          bestCamelot = CAMELOT_MINOR[root];
        }
      }
      
      // Filter out low confidence frames to avoid jitter
      if (maxCorrelation > 0.5) {
        KEY_CONFIDENCE_HISTORY.push({ key: bestKeyName, camelot: bestCamelot, score: maxCorrelation });
      } else {
        KEY_CONFIDENCE_HISTORY.push({ key: "Unknown", camelot: "Unknown", score: 0 });
      }
      
      if (KEY_CONFIDENCE_HISTORY.length > MAX_KEY_HISTORY) {
        KEY_CONFIDENCE_HISTORY.shift();
      }
      
      // Determine the most common key in our voting window
      const votes = {};
      KEY_CONFIDENCE_HISTORY.forEach(item => {
        if (item.key !== "Unknown") {
          votes[item.key] = (votes[item.key] || 0) + item.score;
        }
      });
      
      let finalKey = "Unknown";
      let finalCamelot = "Unknown";
      let maxVoteScore = 0;
      
      Object.keys(votes).forEach(keyName => {
        if (votes[keyName] > maxVoteScore) {
          maxVoteScore = votes[keyName];
          finalKey = keyName;
          finalCamelot = KEY_CONFIDENCE_HISTORY.find(i => i.key === keyName).camelot;
        }
      });
      
      // Only lock the key if we have a stable signal
      const confidence = maxVoteScore / KEY_CONFIDENCE_HISTORY.length;
      
      const estimatedBpm = estimateBpm();
      
      // Relay analysis results back to the background worker
      chrome.runtime.sendMessage({
        action: "update-analysis-results",
        data: {
          key: finalKey !== "Unknown" ? finalKey : "Unknown",
          camelot: finalCamelot !== "Unknown" ? finalCamelot : "Unknown",
          bpm: estimatedBpm ? String(estimatedBpm) : "Analyzing...",
          confidence: confidence
        }
      });
    }
  }, 20); // 20ms update frequency
}

function stopAnalysis() {
  console.log("[YTM Key Attributor Analyzer] Stopping analysis...");
  if (analysisInterval) {
    clearInterval(analysisInterval);
    analysisInterval = null;
  }
  
  if (analyserNode) {
    analyserNode.disconnect();
    analyserNode = null;
  }
  
  if (mediaStreamSource) {
    mediaStreamSource.disconnect();
    mediaStreamSource = null;
  }
  
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  
  // Clear buffers
  CHROMA_HISTORY.length = 0;
  KEY_CONFIDENCE_HISTORY.length = 0;
  RMS_HISTORY.length = 0;
  BEAT_TIMESTAMPS.length = 0;
}
