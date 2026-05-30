/**
 * Input sanitization utilities
 * Prevents XSS and cleans user input for safe storage/display
 */

const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"'/]/g, (char) => HTML_ENTITIES[char]);
}

/**
 * Sanitize a general text input (playlist name, description, etc.)
 * Trims whitespace, limits length, removes control characters
 */
export function sanitizeText(str, maxLength = 200) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
    .slice(0, maxLength);
}

/**
 * Validate email format
 */
export function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  // RFC 5322 simplified
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(email);
}

/**
 * Sanitize a playlist name — more restrictive
 */
export function sanitizePlaylistName(name) {
  return sanitizeText(name, 100);
}

/**
 * Sanitize a search query
 */
export function sanitizeSearchQuery(query) {
  return sanitizeText(query, 200);
}
