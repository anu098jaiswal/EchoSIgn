// src/glossMap.js — English word → ISL Gloss animation file mapping
// Add more entries as you create/download animations from Mixamo

export const ISL_GLOSS_MAP = {
  // Single animations
  "hello": "hello", "hi": "hello", "hey": "hello",
  "clap": "clap", "applause": "clap",
  "point": "point", "there": "point", "look": "point",
  "yes": "yes", "yeah": "yes", "yep": "yes",
  "no": "no", "nah": "no", "nope": "no",
  "good": "good", "nice": "good",
  "acknowledge": "acknowledge", "ok": "acknowledge", "okay": "acknowledge",
  "think": "think", "hmm": "think",

  // Concept-breaking arrays
  "agree": ["yes", "acknowledge"],
  "disagree": ["no", "think"],
  "understand": ["think", "acknowledge"],
  "understood": ["think", "acknowledge"],
  "confused": ["think", "no"],
  "idea": ["think", "point"],
  "great": ["good", "clap"],
  "awesome": ["good", "clap"],
  "excellent": ["good", "clap"],
  "perfect": ["good", "yes"],
  "wrong": ["no", "point"],
  "smart": ["think", "good"],
  "brilliant": ["think", "good", "clap"],
  "welcome": ["hello", "acknowledge"],
  "amazing": ["clap", "good"],
  "bad": ["no", "good"],
  "right": ["yes", "point"],
  "correct": ["yes", "point", "good"],
  "approve": ["yes", "good", "acknowledge"],
  "reject": ["no", "acknowledge"],
  "maybe": ["think", "acknowledge"],
  "question": ["think", "point"],
  "questions": ["think", "point"],
  "answer": ["acknowledge", "point"],
  "listen": ["acknowledge", "think"],
  "sure": ["yes", "good"],
  "problem": ["think", "no"],
  "solution": ["think", "yes"],
  "congratulations": ["clap", "clap"],
  "congrats": ["clap", "clap"],
  "success": ["good", "clap"],
  "failure": ["no", "good"],
  "best": ["good", "yes"],
  "true": ["yes", "point"],
  "false": ["no", "point"],
  "important": ["point", "acknowledge"],

  // Study-related and Academic
  "learn": ["think", "good"],
  "learning": ["think", "good", "acknowledge"],
  "study": ["think", "acknowledge"],
  "studying": ["think", "acknowledge", "acknowledge"],
  "know": ["think", "yes"],
  "student": ["hello", "acknowledge"],
  "teacher": ["hello", "clap"],
  "computer": ["think", "point"],
  "exam": ["think", "point", "acknowledge"],
  "test": ["think", "point", "acknowledge"],
  "quiz": ["think", "point"],
  "book": ["think", "acknowledge"],
  "books": ["think", "acknowledge"],
  "read": ["point", "acknowledge"],
  "reading": ["point", "acknowledge"],
  "write": ["point", "think"],
  "writing": ["point", "think"],
  "math": ["think", "yes"],
  "mathematics": ["think", "yes"],
  "science": ["think", "yes"],
  "history": ["think", "acknowledge"],
  "literature": ["think", "acknowledge"],
  "physics": ["think", "yes"],
  "chemistry": ["think", "yes"],
  "biology": ["think", "yes"],
  "lecture": ["acknowledge", "point", "think"],
  "class": ["hello", "acknowledge"],
  "classroom": ["hello", "acknowledge"],
  "school": ["acknowledge", "good"],
  "college": ["acknowledge", "good"],
  "university": ["acknowledge", "good", "clap"],
  "homework": ["think", "acknowledge", "point"],
  "assignment": ["think", "acknowledge", "point"],
  "research": ["think", "think"],
  "project": ["think", "good", "point"]
};

// ─── Stopwords to skip (don't try to sign these) ────────────────────────────
const SKIP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "to", "of", "in", "on", "at",
  "by", "for", "with", "about", "as", "into", "through", "during",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her",
  "us", "them", "my", "your", "his", "its", "our", "their",
  "this", "that", "these", "those", "and", "but", "or", "so", "if",
  "not", "very", "just", "also", "then", "there", "here", "which",
  "what", "when", "where", "who", "how", "why"
]);

/**
 * Converts a transcript string into an array of ISL gloss animation names.
 * @param {string} text - Raw transcript text
 * @returns {string[]} - Array of gloss animation file names
 */
export function textToGlosses(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 1 && !SKIP_WORDS.has(word))
    .flatMap(word => {
      const gloss = ISL_GLOSS_MAP[word];
      return Array.isArray(gloss) ? gloss : [gloss];
    })
    .filter(Boolean);
}

/**
 * Returns the gloss name for a single word, or null if not found.
 * @param {string} word
 * @returns {string|null}
 */
export function wordToGloss(word) {
  const clean = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  return ISL_GLOSS_MAP[clean] || null;
}
