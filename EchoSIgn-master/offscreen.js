// offscreen.js — Runs in Chrome offscreen document
// Captures tab audio, chunks it, and sends to Whisper API for transcription.

let mediaRecorder = null;
let audioChunks   = [];
let captureStream = null;
let isCapturing   = false;
let apiKey        = '';
let lang          = 'en';
let chunkTimer    = null;

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'START_TAB_CAPTURE') {
    apiKey = message.apiKey || '';
    lang   = (message.lang || 'en-IN').split('-')[0]; // 'en' from 'en-IN'
    startCapture(message.streamId);
  }

  if (message.type === 'STOP_TAB_CAPTURE') {
    stopCapture();
  }
});

async function startCapture(streamId) {
  if (isCapturing) return;

  try {
    captureStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
    });

    // Play audio back so the user still hears the lecture
    const audioEl = new Audio();
    audioEl.srcObject = captureStream;
    audioEl.play();

    isCapturing = true;
    chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', state: 'listening' }).catch(() => {});

    startChunk();
  } catch (err) {
    console.error('[Echo-Sign Offscreen] Capture failed:', err);
    chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', state: 'error', error: 'tab-capture-failed' }).catch(() => {});
  }
}

function startChunk() {
  if (!isCapturing || !captureStream) return;

  audioChunks = [];
  mediaRecorder = new MediaRecorder(captureStream, { mimeType: 'audio/webm' });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };

  mediaRecorder.onstop = async () => {
    if (!isCapturing) return;

    const blob = new Blob(audioChunks, { type: 'audio/webm' });
    audioChunks = [];

    if (blob.size > 2000 && apiKey) {
      await transcribeChunk(blob);
    }

    // Start next chunk
    if (isCapturing) startChunk();
  };

  mediaRecorder.start();
  // Stop after 5 seconds to send chunk to Whisper
  chunkTimer = setTimeout(() => {
    if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
  }, 5000);
}

function stopCapture() {
  isCapturing = false;
  clearTimeout(chunkTimer);

  if (mediaRecorder?.state !== 'inactive') {
    mediaRecorder.stop();
  }
  mediaRecorder = null;

  captureStream?.getTracks().forEach(t => t.stop());
  captureStream = null;
  audioChunks   = [];

  chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', state: 'idle' }).catch(() => {});
}

async function transcribeChunk(blob) {
  try {
    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', lang);

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[Echo-Sign Offscreen] Whisper error:', res.status, err);
      return;
    }

    const { text } = await res.json();
    if (text?.trim()) {
      chrome.runtime.sendMessage({ type: 'TRANSCRIPT_CHUNK', text: text.trim() }).catch(() => {});
    }
  } catch (err) {
    console.error('[Echo-Sign Offscreen] Fetch failed:', err);
  }
}
