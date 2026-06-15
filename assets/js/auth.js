/**
 * Aleucia Authentication Module
 *
 * Security model:
 *  - Passwords are never stored in plaintext. Each entry holds a PBKDF2-SHA256
 *    hash derived with 100 000 iterations and a per-character salt.
 *  - The salt is: characterName.toLowerCase() + "-aleucia-vault-2026"
 *  - Passwords are normalised (lowercased + trimmed) before hashing so entry
 *    is case-insensitive.
 *  - Sessions are stored in sessionStorage (cleared on tab/browser close).
 *  - Session tokens are cryptographically random (crypto.randomUUID).
 *  - The guard script (guard.js) must be the first <script> on every
 *    protected page to prevent content flash.
 *
 * To add / change a character:
 *  1. Open tools/generate-hash.html in any browser (no server needed).
 *  2. Enter the character name and the player's first name.
 *  3. Copy the resulting hash into the CHARACTERS array below.
 *
 * LIMITATION: This is client-side authentication only (GitHub Pages has no
 * server-side code). Determined users can inspect the source. Passwords are
 * hashed, but the content itself is not encrypted at rest. See SECURITY.md.
 */

// ---------------------------------------------------------------------------
// Character roster
// ---------------------------------------------------------------------------
// Each entry: { name: string, passwordHash: string }
// passwordHash = PBKDF2(playerFirstName, characterName + "-aleucia-vault-2026",
//                       100000 iterations, SHA-256, 32 bytes) as hex
// Use tools/generate-hash.html to compute hashes for real player names.
// ---------------------------------------------------------------------------
// Each entry: { name, passwordHash, spellcaster }
// Set spellcaster: true for any character who has a spell book.
const CHARACTERS = [
  {
    name: "Aria Stonehearth",
    passwordHash: "e742aef95f68a1740cd86d28ecd48db65fb5921f75fbbb23b881c1c0bb646a9b",
    spellcaster: false
  },
  {
    name: "Brannick Ironveil",
    passwordHash: "11ef1c224ab01358fecfe5072de1da73aad4a5892af825d3529bfaf437e27d84",
    spellcaster: false
  },
  {
    name: "Celeste Nightshade",
    passwordHash: "89dfd2da4828843b76f47ea3c756d6d99b106a9b8ecae750bb2dc329372b0096",
    spellcaster: false
  },
  {
    name: "Dorian Ashveil",
    passwordHash: "5cb5219b34c2c29a22a3427af52d93ced6d4b97ff8472c53fb024caadd222f78",
    spellcaster: false
  }
  // Add more characters here after generating hashes with tools/generate-hash.html
];

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const AUTH_CONFIG = {
  loginPage:       "index.html",
  defaultRedirect: "player.html",
  sessionKey:      "aleucia_session",
  returnUrlKey:    "aleucia_return_url",
  sessionDuration: 8 * 60 * 60 * 1000  // 8 hours in milliseconds
};

// ---------------------------------------------------------------------------
// Internal: PBKDF2-SHA256 hash via Web Crypto API
// ---------------------------------------------------------------------------
async function _deriveHash(password, characterName) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password.toLowerCase().trim()),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const salt = enc.encode(characterName.toLowerCase() + "-aleucia-vault-2026");
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time hex string comparison to mitigate timing attacks
function _safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

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
 * Attempts to log in as characterName with the given password.
 * On success, writes a session to sessionStorage.
 * @param {string} characterName
 * @param {string} password
 * @returns {Promise<boolean>}
 */
async function login(characterName, password) {
  const character = CHARACTERS.find(c => c.name === characterName);
  if (!character) return false;

  let hash;
  try {
    hash = await _deriveHash(password, characterName);
  } catch {
    return false;
  }

  if (!_safeEqual(hash, character.passwordHash)) return false;

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
