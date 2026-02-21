// src/speechHandler.js — Web Speech API wrapper for real-time transcription

export class SpeechHandler {
  constructor({ onWord, onTranscript, onError, onStateChange, lang = 'en-IN' }) {
    this.onWord = onWord;           // called per gloss-able word
    this.onTranscript = onTranscript; // called with full running transcript
    this.onError = onError;
    this.onStateChange = onStateChange;
    this.lang = lang;

    this.recognition = null;
    this.isRunning = false;
    this.lastProcessedIndex = 0;
    this.fullTranscript = '';
  }

  // ─── Start listening ────────────────────────────────────────────────────
  start() {
    if (this.isRunning) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.onError?.('Speech Recognition not supported in this browser.');
      return;
    }

    // Chrome extensions must call getUserMedia first to unlock mic access.
    // We immediately stop the stream — we only need the permission grant.
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach(t => t.stop());
        this._startRecognition(SpeechRecognition);
      })
      .catch(() => {
        this.onError?.('Microphone permission denied.');
      });
  }

  _startRecognition(SpeechRecognition) {
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.lang;

    this.recognition.onstart = () => {
      this.isRunning = true;
      this.onStateChange?.('listening');
      console.log('[Echo-Sign] Speech recognition started.');
    };

    this.recognition.onend = () => {
      // Auto-restart if we didn't explicitly stop
      if (this.isRunning) {
        console.log('[Echo-Sign] Recognition ended, restarting...');
        setTimeout(() => this.recognition?.start(), 300);
      }
    };

    this.recognition.onerror = (event) => {
      console.warn('[Echo-Sign] Speech error:', event.error);
      if (event.error !== 'no-speech') {
        this.onError?.(event.error);
      }
    };

    this.recognition.onresult = (event) => {
      this._handleResult(event);
    };

    this.recognition.start();
  }

  // ─── Stop listening ──────────────────────────────────────────────────────
  stop() {
    this.isRunning = false;
    this.recognition?.stop();
    this.recognition = null;
    this.lastProcessedIndex = 0;
    this.fullTranscript = '';
    this.onStateChange?.('idle');
    console.log('[Echo-Sign] Speech recognition stopped.');
  }

  // ─── Process speech results ──────────────────────────────────────────────
  _handleResult(event) {
    let interimText = '';
    let newFinalText = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0].transcript;

      if (result.isFinal) {
        newFinalText += text + ' ';
      } else {
        interimText += text;
      }
    }

    if (newFinalText) {
      this.fullTranscript += newFinalText;
      this.onTranscript?.(this.fullTranscript.trim());
      // Extract new words and fire onWord for each
      this._extractNewWords(newFinalText);
    } else if (interimText) {
      // Show interim captions but don't trigger signs yet
      this.onTranscript?.((this.fullTranscript + interimText).trim());
    }
  }

  // ─── Extract individual words and emit them ──────────────────────────────
  _extractNewWords(text) {
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 1);

    words.forEach(word => {
      this.onWord?.(word);
    });
  }
}
