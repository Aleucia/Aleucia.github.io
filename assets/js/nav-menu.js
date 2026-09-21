/**
 * Aleucia Player Menu
 *
 * Injects the left-edge menu toggle and its slide-out panel on every
 * protected page, once a session exists. Load this after auth.js:
 *   <script src="assets/js/auth.js"></script>
 *   <script src="assets/js/nav-menu.js"></script>
 *
 * Paths below are root-relative on purpose: character subpages set a base
 * tag pointing at the site root, and pages at the site root resolve the
 * same paths against their own location — either way they land on the
 * same file.
 */
(function () {
  function init() {
    var session = typeof getSession === "function" ? getSession() : null;
    if (!session) return;

    var slug = session.username.toLowerCase().replace(/\s+/g, "-");
    var charBase = "characters/" + slug + "/";

    var links = [
      { label: "Home",             href: "home.html" },
      { label: "Character Home",   href: "player.html" },
      { label: "Session Journals", href: charBase + "timeline.html" },
      { label: "Known Recipes",    href: "world.html?table=recipes" },
      { label: "Item Catalog",     href: "world.html?table=items" },
      { label: "Locations",        href: "world.html?table=locations" }
    ];

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "nav-menu-toggle";
    toggle.setAttribute("aria-label", "Open menu");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = "<span></span><span></span><span></span>";

    var overlay = document.createElement("div");
    overlay.className = "nav-menu-overlay";

    var panel = document.createElement("nav");
    panel.className = "nav-menu-panel";
    panel.setAttribute("aria-label", "Player menu");

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "nav-menu-close";
    closeBtn.setAttribute("aria-label", "Close menu");
    closeBtn.innerHTML = "&times;";
    panel.appendChild(closeBtn);

    var heading = document.createElement("p");
    heading.className = "nav-menu-heading";
    heading.textContent = session.username;
    panel.appendChild(heading);

    var list = document.createElement("ul");
    list.className = "nav-menu-list";
    links.forEach(function (link) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = link.href;
      a.className = "nav-menu-link";
      a.textContent = link.label;
      li.appendChild(a);
      list.appendChild(li);
    });
    panel.appendChild(list);

    function open() {
      document.body.classList.add("nav-menu-open");
      toggle.setAttribute("aria-expanded", "true");
    }
    function close() {
      document.body.classList.remove("nav-menu-open");
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", function () {
      if (document.body.classList.contains("nav-menu-open")) close();
      else open();
    });
    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });

    var brand = document.querySelector(".topbar-brand");
    if (brand && brand.parentNode) {
      var topbarLeft = document.createElement("div");
      topbarLeft.className = "topbar-left";
      brand.parentNode.insertBefore(topbarLeft, brand);
      topbarLeft.appendChild(toggle);
      topbarLeft.appendChild(brand);
    } else {
      document.body.appendChild(toggle);
    }

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}());
