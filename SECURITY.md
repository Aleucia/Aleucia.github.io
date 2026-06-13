# Security Documentation — Aleucia World Site

## Overview

This site is a GitHub Pages static site (no server-side code). Authentication
is implemented entirely in the browser using the Web Crypto API. The goal is a
reasonable access barrier for TTRPG players — not financial-grade security.

---

## Authentication Mechanism

### Password Hashing

Passwords are **never stored in plaintext**. Each character entry in
`assets/js/auth.js` holds a PBKDF2-SHA256 hash:

| Parameter      | Value                                                    |
|----------------|----------------------------------------------------------|
| Algorithm      | PBKDF2                                                   |
| Hash function  | SHA-256                                                  |
| Iterations     | 100 000                                                  |
| Output length  | 256 bits (64 hex characters)                             |
| Salt           | `characterName.toLowerCase() + "-aleucia-vault-2026"`    |
| Password norm  | `password.toLowerCase().trim()` (case-insensitive entry) |

Using a per-character salt means identical passwords for two different
characters produce different hashes, preventing correlation.

The hash comparison uses a constant-time loop (`_safeEqual` in `auth.js`) to
mitigate timing-based inference.

### Session Management

| Property         | Value                                            |
|------------------|--------------------------------------------------|
| Storage          | `sessionStorage` (cleared on tab/browser close)  |
| Session token    | `crypto.randomUUID()` (cryptographically random) |
| Session duration | 8 hours from login                               |

Sessions are pure client-side objects: `{ username, token, expiry }`. There is
no server to validate them, so a manually crafted sessionStorage entry would
bypass the guard. This is a known limitation (see below).

### Auth Guard

`assets/js/guard.js` must be the **first `<script>` tag** (no `defer` or
`async`) on every protected page. It:

1. Immediately sets `document.documentElement.style.visibility = "hidden"`
   so no content is painted before the check runs.
2. Reads and validates the session from `sessionStorage`.
3. If valid: makes the page visible.
4. If not: stores the current URL as the return target, then redirects to
   `index.html`.

### Return-URL Handling

When the guard redirects an unauthenticated visitor, it saves their intended
destination in `sessionStorage` under the key `aleucia_return_url`. After a
successful login, the user is sent to that saved URL automatically.

---

## Known Limitations

| Limitation | Detail |
|---|---|
| Client-side only | All content files are publicly accessible via direct URL or `curl`. The guard only works in a browser. |
| Source-visible hashes | The hashed passwords in `auth.js` are public. A determined user could attempt offline cracking. 100 000 PBKDF2 iterations slow this significantly, but short passwords remain vulnerable to dictionary attacks. |
| No HTTPS enforcement | GitHub Pages serves over HTTPS by default, which prevents network interception. If using a custom domain, ensure HTTPS is enforced in GitHub Pages settings. |
| sessionStorage limit | In some browsers in private/incognito mode, `sessionStorage` may be restricted and the login will fail gracefully with an error message. |

---

## Adding or Changing a Character

1. Open `tools/generate-hash.html` locally in any modern browser (no server needed).
2. Enter the **exact character name** (as it will appear in the list) and the **player's first name** as the password.
3. Click **Generate Hash** and copy the output.
4. Paste the new entry into the `CHARACTERS` array in `assets/js/auth.js`.
5. Commit and push.

> **Do not deploy `tools/generate-hash.html` to GitHub Pages.** It is a local
> DM tool only. Add it to `.gitignore` if you want to keep it out of the repo
> entirely (though it contains no secrets).

---

## Adding a New Protected Page

Every new HTML page that should be behind the login wall needs:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <!-- Auth guard MUST be first — no defer, no async -->
  <script src="assets/js/guard.js"></script>
  ...
```

**Path note**: The guard redirects to `index.html` (relative). Pages in
subdirectories (e.g. `lore/dragons.html`) must either:

- Change the redirect target in `guard.js` to `../index.html`, or
- Add a `<base href="/">` tag *before* the guard script (GitHub Pages user
  sites are served from `/`; project sites from `/<repo-name>/`).

---

## Ongoing Development — Security Checklist

When adding new features, verify:

- [ ] New content pages include `guard.js` as the first script.
- [ ] No secrets, real names, or session tokens are committed to the repo.
- [ ] Any new links from `index.html` (login page) do not expose protected content without a guard.
- [ ] `tools/` directory contents are not linked from the main site.
- [ ] Password hashes are regenerated with `tools/generate-hash.html` if players change names or new players join.
- [ ] GitHub Pages HTTPS enforcement is enabled (repo Settings → Pages → Enforce HTTPS).

---

## File Reference

| File | Purpose |
|---|---|
| `assets/js/auth.js` | Character roster, PBKDF2 hashing, session read/write |
| `assets/js/guard.js` | Auth guard — include first on every protected page |
| `index.html` | Login page (unprotected, public) |
| `tools/generate-hash.html` | Local DM tool for generating password hashes |
| `SECURITY.md` | This document |
