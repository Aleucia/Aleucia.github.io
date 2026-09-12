# Security Documentation — Aleucia World Site

## Overview

This site is a GitHub Pages static site (no server-side code). Access is
gated entirely in the browser. The goal is a light barrier so players land on
their own character's content — not financial-grade security.

---

## Authentication Mechanism

### Character Selection

There is **no password**. `assets/js/auth.js` holds a roster (`CHARACTERS`)
of the party's character names; clicking a name on the login page opens a
session as that character immediately. The roster mirrors the party in the
DM's Obsidian vault (`1-Party/The filthy casuals`).

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
| No identity check | Anyone who reaches the login page can open a session as any character in the roster — this only stops casual browsing, not a determined visitor who has the URL. |
| No HTTPS enforcement | GitHub Pages serves over HTTPS by default, which prevents network interception. If using a custom domain, ensure HTTPS is enforced in GitHub Pages settings. |
| sessionStorage limit | In some browsers in private/incognito mode, `sessionStorage` may be restricted and the login will fail gracefully with an error message. |

---

## Adding or Changing a Character

1. Add or edit an entry in the `CHARACTERS` array in `assets/js/auth.js`:
   `{ name: "Character Name", spellcaster: true|false }`.
2. Commit and push.

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
- [ ] The `CHARACTERS` roster in `auth.js` is updated when players change names or new players join.
- [ ] GitHub Pages HTTPS enforcement is enabled (repo Settings → Pages → Enforce HTTPS).

---

## File Reference

| File | Purpose |
|---|---|
| `assets/js/auth.js` | Character roster, session read/write |
| `assets/js/guard.js` | Auth guard — include first on every protected page |
| `index.html` | Login page (unprotected, public) |
| `SECURITY.md` | This document |
