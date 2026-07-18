(function (global) {
  "use strict";
  var LoBookReader = (global.LoBookReader = global.LoBookReader || {});

  LoBookReader.ReaderHeader = {
    create: function (root, opts) {
      var libraryUrl = opts.libraryUrl || "../../index.html#club-library";
      var logoUrl = opts.logoUrl || "../../../webpageassets/logo-nav.webp";

      var nav = document.createElement("header");
      nav.className = "home-nav book-reader__menu";
      nav.id = "book-reader-nav";

      var inner = document.createElement("div");
      inner.className = "home-nav__inner";

      var brand = document.createElement("a");
      brand.className = "home-nav__brand";
      brand.href = libraryUrl;
      brand.setAttribute("aria-label", "Back to Club library");
      brand.innerHTML =
        '<img src="' +
        logoUrl +
        '" alt="" class="home-nav__logo" width="140" height="40" decoding="async" />';

      var title = document.createElement("span");
      title.className = "book-reader__nav-title visually-hidden";
      title.textContent = opts.title || "Book";

      var links = document.createElement("nav");
      links.className = "home-nav__links";
      links.id = "book-reader-nav-links";
      links.setAttribute("aria-label", "Book reader menu");

      var pagesBtn = document.createElement("button");
      pagesBtn.type = "button";
      pagesBtn.className = "home-nav__link book-reader__pages-btn";
      pagesBtn.textContent = "View Pages";
      pagesBtn.setAttribute("aria-expanded", "false");
      pagesBtn.setAttribute("aria-controls", "book-thumbs-drawer");

      var libraryLink = document.createElement("a");
      libraryLink.className = "home-nav__link";
      libraryLink.href = libraryUrl;
      libraryLink.textContent = "Library";

      links.appendChild(pagesBtn);
      links.appendChild(libraryLink);

      if (opts.amazonUrl) {
        var buyBtn = document.createElement("a");
        buyBtn.className = "home-nav__link book-reader__buy-btn";
        buyBtn.href = opts.amazonUrl;
        buyBtn.rel = "noopener noreferrer";
        buyBtn.target = "_blank";
        buyBtn.textContent = "Buy the Book";
        links.appendChild(buyBtn);
      }

      var closeBtn = document.createElement("a");
      closeBtn.className = "home-nav__cta home-nav__cta--mobile book-reader__close-btn";
      closeBtn.href = libraryUrl;
      closeBtn.textContent = "Close Book";
      links.appendChild(closeBtn);

      var closeDesktop = document.createElement("a");
      closeDesktop.className = "home-nav__cta home-nav__cta--desktop book-reader__close-btn";
      closeDesktop.href = libraryUrl;
      closeDesktop.textContent = "Close Book";

      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "home-nav__toggle";
      toggle.id = "book-reader-nav-toggle";
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-controls", "book-reader-nav-links");
      toggle.setAttribute("aria-label", "Open menu");
      toggle.innerHTML =
        '<span class="home-nav__toggle-bar" aria-hidden="true"></span>' +
        '<span class="home-nav__toggle-bar" aria-hidden="true"></span>' +
        '<span class="home-nav__toggle-bar" aria-hidden="true"></span>';

      inner.appendChild(brand);
      inner.appendChild(title);
      inner.appendChild(links);
      inner.appendChild(closeDesktop);
      inner.appendChild(toggle);
      nav.appendChild(inner);
      root.insertBefore(nav, root.firstChild);

      var backdrop = document.createElement("div");
      backdrop.className = "home-nav-backdrop";
      backdrop.id = "book-reader-nav-backdrop";
      backdrop.hidden = true;
      backdrop.setAttribute("aria-hidden", "true");
      document.body.appendChild(backdrop);

      function setMenuOpen(open) {
        nav.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        document.body.classList.toggle("menu-open", open);
        backdrop.hidden = !open;
        backdrop.setAttribute("aria-hidden", open ? "false" : "true");
      }

      toggle.addEventListener("click", function () {
        setMenuOpen(!nav.classList.contains("is-open"));
      });

      backdrop.addEventListener("click", function () {
        setMenuOpen(false);
      });

      links.querySelectorAll("a, button").forEach(function (el) {
        el.addEventListener("click", function () {
          if (window.innerWidth < 1024) setMenuOpen(false);
        });
      });

      return {
        el: nav,
        title: title,
        back: brand,
        pagesBtn: pagesBtn,
        closeBtn: closeBtn,
        buyBtn: links.querySelector(".book-reader__buy-btn"),
        navToggle: toggle,
        navBackdrop: backdrop,
        setTitle: function (text) {
          title.textContent = text;
        },
        setFullscreenLabel: function () {
          /* fullscreen removed from reader menu */
        },
        setCompact: function () {
          /* nav uses site menu — no compact mode */
        },
        closeMenu: function () {
          setMenuOpen(false);
        },
      };
    },
  };
})(window);
