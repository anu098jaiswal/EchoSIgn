// src/glossMap.js — English word → ISL Gloss animation file mapping
// Add more entries as you create/download animations from Mixamo

export const ISL_GLOSS_MAP = {
  // ── Greetings ──────────────────────────────────────────────────
  "hello":        "hello",
  "hi":           "hello",
  "bye":          "goodbye",
  "goodbye":      "goodbye",
  "thanks":       "thank_you",
  "thank":        "thank_you",
  "welcome":      "welcome",
  "please":       "please",
  "sorry":        "sorry",

  // ── Common Verbs ───────────────────────────────────────────────
  "learn":        "learn",
  "study":        "study",
  "understand":   "understand",
  "know":         "know",
  "see":          "see",
  "read":         "read",
  "write":        "write",
  "listen":       "listen",
  "speak":        "speak",
  "ask":          "ask",
  "answer":       "answer",
  "help":         "help",
  "start":        "start",
  "stop":         "stop",
  "repeat":       "repeat",
  "explain":      "explain",
  "show":         "show",
  "open":         "open",
  "close":        "close",

  // ── People / Nouns ─────────────────────────────────────────────
  "student":      "student",
  "students":     "student",
  "teacher":      "teacher",
  "professor":    "teacher",
  "school":       "school",
  "college":      "college",
  "university":   "university",
  "class":        "class",
  "lecture":      "lecture",
  "library":      "library",
  "book":         "book",
  "books":        "book",
  "exam":         "exam",
  "test":         "test",
  "question":     "question",
  "questions":    "question",

  // ── Gestures / Pointing ────────────────────────────────────────
  "great":        "clap",
  "here":         "point",
  "this":         "point",
  "that":         "point",

  // ── Academic / STEM ────────────────────────────────────────────
  "computer":     "computer",
  "algorithm":    "algorithm",
  "data":         "data",
  "science":      "science",
  "math":         "math",
  "mathematics":  "math",
  "physics":      "physics",
  "chemistry":    "chemistry",
  "biology":      "biology",
  "history":      "history",
  "english":      "english",
  "language":     "language",
  "number":       "number",
  "numbers":      "number",
  "formula":      "formula",

  // ── Yes / No / Basic ───────────────────────────────────────────
  "yes":          "yes",
  "no":           "no",
  "maybe":        "maybe",
  "good":         "good",
  "bad":          "bad",
  "more":         "more",
  "less":         "less",
  "same":         "same",
  "different":    "different",
  "important":    "important",
  "easy":         "easy",
  "difficult":    "difficult",
  "hard":         "difficult",
  "fast":         "fast",
  "slow":         "slow",
  "big":          "big",
  "small":        "small",
  "new":          "new",
  "old":          "old",

  // ── Time ───────────────────────────────────────────────────────
  "today":        "today",
  "tomorrow":     "tomorrow",
  "yesterday":    "yesterday",
  "now":          "now",
  "later":        "later",
  "before":       "before",
  "after":        "after",
  "morning":      "morning",
  "evening":      "evening",
  "night":        "night",
  "week":         "week",
  "month":        "month",
  "year":         "year",

  // ── Numbers (map words to number signs) ───────────────────────
  "one":          "number_1",
  "two":          "number_2",
  "three":        "number_3",
  "four":         "number_4",
  "five":         "number_5",
  "six":          "number_6",
  "seven":        "number_7",
  "eight":        "number_8",
  "nine":         "number_9",
  "ten":          "number_10",
  "1":            "number_1",
  "2":            "number_2",
  "3":            "number_3",
  "4":            "number_4",
  "5":            "number_5",
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
    .map(word => ISL_GLOSS_MAP[word] || null)
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
