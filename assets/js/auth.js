/**
 * Aleucia Authentication Module
 *
 * Security model:
 *  - There is no password. Selecting a character from the roster is enough
 *    to open a session as them — this is an access gate for players at the
 *    table, not a defence against a determined outsider.
 *  - Sessions are stored in sessionStorage (cleared on tab/browser close).
 *  - Session tokens are cryptographically random (crypto.randomUUID).
 *  - The guard script (guard.js) must be the first <script> on every
 *    protected page to prevent content flash.
 *
 * To add / remove a character, edit the CHARACTERS array below. The roster
 * mirrors the party in the DM's Obsidian vault (1-Party/The filthy casuals).
 *
 * LIMITATION: This is client-side gating only (GitHub Pages has no
 * server-side code). Determined users can inspect the source or view any
 * page's content directly. See SECURITY.md.
 */

// ---------------------------------------------------------------------------
// Character roster
// ---------------------------------------------------------------------------
// Each entry: { name, spellcaster }
// Set spellcaster: true for any character who has a spell book.
const CHARACTERS = [
  { name: "Aerin",       spellcaster: true },
  { name: "Alaric",      spellcaster: true },
  { name: "Clueless",    spellcaster: true },
  { name: "Jeff",        spellcaster: true },
  { name: "Petra",       spellcaster: true },
  { name: "Ser Gillard", spellcaster: true },
  { name: "Steve",       spellcaster: true },
  { name: "Yat",         spellcaster: true }
];

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const AUTH_CONFIG = {
  loginPage:       "index.html",
  defaultRedirect: "home.html",
  sessionKey:      "aleucia_session",
  returnUrlKey:    "aleucia_return_url",
  sessionDuration: 8 * 60 * 60 * 1000  // 8 hours in milliseconds
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the list of character names for display on the login page.
 * @returns {string[]}
 */
function getCharacterNames() {
  return CHARACTERS.map(c => c.name);
}

/**
 * Logs in as characterName. On success, writes a session to sessionStorage.
 * @param {string} characterName
 * @returns {boolean}
 */
function login(characterName) {
  const character = CHARACTERS.find(c => c.name === characterName);
  if (!character) return false;

  const session = {
    username: characterName,
    token:    crypto.randomUUID(),
    expiry:   Date.now() + AUTH_CONFIG.sessionDuration
  };
  try {
    sessionStorage.setItem(AUTH_CONFIG.sessionKey, JSON.stringify(session));
  } catch {
    // sessionStorage unavailable (private browsing restrictions)
    return false;
  }
  return true;
}

/**
 * Returns the current session object or null if not authenticated / expired.
 * @returns {{ username: string, token: string, expiry: number } | null}
 */
function getSession() {
  try {
    const raw = sessionStorage.getItem(AUTH_CONFIG.sessionKey);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session.username || !session.token || Date.now() > session.expiry) {
      sessionStorage.removeItem(AUTH_CONFIG.sessionKey);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/**
 * Returns non-sensitive data for the named character, or null if not found.
 * Used by player.html to determine character-specific features (e.g. spell book).
 * @param {string} characterName
 * @returns {{ name: string, spellcaster: boolean } | null}
 */
function getCharacterData(characterName) {
  const character = CHARACTERS.find(c => c.name === characterName);
  if (!character) return null;
  return { name: character.name, spellcaster: !!character.spellcaster };
}

/**
 * Clears the session and returns to the login page.
 */
function logout() {
  try {
    sessionStorage.removeItem(AUTH_CONFIG.sessionKey);
    sessionStorage.removeItem(AUTH_CONFIG.returnUrlKey);
  } catch { /* ignore */ }
  window.location.replace(AUTH_CONFIG.loginPage);
}
