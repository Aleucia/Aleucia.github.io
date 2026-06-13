/**
 * Aleucia Auth Guard
 *
 * Include this as the FIRST <script> tag (no defer/async) on every protected
 * page. It runs synchronously before the browser paints anything, so
 * unauthenticated visitors never see protected content.
 *
 * What it does:
 *  1. Immediately hides the document (sets visibility:hidden) to prevent flash.
 *  2. Reads the session from sessionStorage.
 *  3. If the session is valid: makes the document visible and continues.
 *  4. If not: saves the current URL as the return target, then redirects to
 *     index.html so the user can log in and return here automatically.
 *
 * Note on path depth: this script redirects to "index.html" (relative).
 * Pages in subdirectories must adjust the path (e.g., "../index.html") or
 * add a <base> tag pointing to the site root. See SECURITY.md.
 */
(function () {
  // Prevent any content flash while the check runs
  document.documentElement.style.visibility = "hidden";

  var SESSION_KEY  = "aleucia_session";
  var RETURN_KEY   = "aleucia_return_url";
  var LOGIN_PAGE   = "index.html";

  function redirect() {
    try {
      sessionStorage.setItem(RETURN_KEY, window.location.href);
    } catch (_) { /* ignore if sessionStorage is blocked */ }
    window.location.replace(LOGIN_PAGE);
  }

  try {
    var raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) { redirect(); return; }

    var session = JSON.parse(raw);
    if (
      !session ||
      typeof session.username !== "string" ||
      typeof session.token   !== "string" ||
      typeof session.expiry  !== "number" ||
      Date.now() > session.expiry
    ) {
      sessionStorage.removeItem(SESSION_KEY);
      redirect();
      return;
    }

    // Session is valid — reveal the page
    document.documentElement.style.visibility = "";
  } catch (_) {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_2) { /* ignore */ }
    redirect();
  }
}());
