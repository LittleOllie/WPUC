/**
 * LO × DDG — Frappy Brew shell: X handle, how-to modals, conditional game load.
 * Set BASE_PATH when the site lives in a subpath (must end with /), e.g. "/my-repo/"
 */
(function () {
  const BASE_PATH = "";

  if (typeof window !== "undefined") {
    window.__FRAPPY_BASE__ = BASE_PATH;
  }

  if (BASE_PATH) {
    var baseEl = document.querySelector("base");
    if (baseEl) {
      baseEl.href = BASE_PATH.endsWith("/") ? BASE_PATH : BASE_PATH + "/";
    }
  }

  const STORAGE_KEY = "frappybrew_xhandle";
  const LEGACY_KEYS = ["frappy_brew_x_handle"];

  /** @type {HTMLElement | null} */
  var focusBeforeModal = null;
  var usernameIsFirstTime = false;

  function assetUrl(rel) {
    var r = String(rel || "").replace(/^\//, "");
    if (!BASE_PATH) return r;
    var b = BASE_PATH.endsWith("/") ? BASE_PATH : BASE_PATH + "/";
    return b + r;
  }

  function migrateLegacyHandle() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (v != null && v !== "") return;
      for (var i = 0; i < LEGACY_KEYS.length; i++) {
        var old = localStorage.getItem(LEGACY_KEYS[i]);
        if (old != null && old !== "") {
          var n = normalizeHandle(old);
          if (/^[a-zA-Z0-9_]{1,15}$/.test(n)) {
            localStorage.setItem(STORAGE_KEY, n);
          }
          return;
        }
      }
    } catch (_) {}
  }

  function getStoredHandle() {
    migrateLegacyHandle();
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw == null || raw === "") return "";
      return normalizeHandle(raw);
    } catch (_) {
      return "";
    }
  }

  function normalizeHandle(raw) {
    return String(raw ?? "")
      .replace(/^@+/, "")
      .replace(/[^a-zA-Z0-9_]/g, "")
      .slice(0, 15);
  }

  function isValidHandle(s) {
    return /^[a-zA-Z0-9_]{1,15}$/.test(s);
  }

  function setWelcomeLine(handle) {
    var el = document.getElementById("welcomeLine");
    if (!el) return;
    if (handle) {
      el.textContent = "Welcome " + handle;
      el.removeAttribute("hidden");
    } else {
      el.textContent = "";
      el.setAttribute("hidden", "");
    }
  }

  function injectGameScript() {
    if (document.querySelector("script[data-frappy-brew]")) return;
    var loadingEl = document.getElementById("introSplashLoading");
    if (loadingEl) loadingEl.textContent = "Loading…";
    var s = document.createElement("script");
    s.src = assetUrl("frappy-brew.js");
    s.async = false;
    s.setAttribute("data-frappy-brew", "");
    document.body.appendChild(s);
  }

  function lockBodyScroll(lock) {
    document.documentElement.classList.toggle("modal-open", lock);
    document.body.classList.toggle("modal-open", lock);
  }

  var usernameModal = document.getElementById("usernameModal");
  var usernameTitle = document.getElementById("usernameModalTitle");
  var usernameSubtitle = document.getElementById("usernameModalSubtitle");
  var usernameInput = document.getElementById("usernameInput");
  var usernameCharCount = document.getElementById("usernameCharCount");
  var usernameSaveBtn = document.getElementById("usernameSaveBtn");
  var usernameCloseBtn = document.getElementById("usernameModalClose");
  var usernameError = document.getElementById("usernameError");

  function updateUsernameCharCount() {
    if (!usernameInput || !usernameCharCount) return;
    var n = usernameInput.value.length;
    usernameCharCount.textContent = n + "/15";
  }

  function updateSaveEnabled() {
    if (!usernameSaveBtn || !usernameInput) return;
    var normalized = normalizeHandle(usernameInput.value);
    usernameSaveBtn.disabled = !isValidHandle(normalized);
  }

  function openUsernameModal(opts) {
    var firstTime = !!(opts && opts.firstTime);
    usernameIsFirstTime = firstTime;
    focusBeforeModal = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (usernameTitle) {
      usernameTitle.textContent = firstTime ? "Welcome" : "Edit your handle";
    }
    if (usernameSubtitle) {
      if (firstTime) {
        usernameSubtitle.textContent =
          "We need your X handle so we can greet you before you play. It’s saved only on this device.";
        usernameSubtitle.hidden = false;
      } else {
        usernameSubtitle.textContent = "";
        usernameSubtitle.hidden = true;
      }
    }
    if (usernameInput) {
      usernameInput.setAttribute(
        "aria-describedby",
        firstTime ? "usernameModalSubtitle usernameHint usernameError" : "usernameHint usernameError"
      );
    }
    if (usernameCloseBtn) {
      usernameCloseBtn.hidden = firstTime;
      usernameCloseBtn.style.display = firstTime ? "none" : "";
    }

    var current = getStoredHandle();
    if (usernameInput) {
      usernameInput.value = firstTime ? "" : current;
      updateUsernameCharCount();
      updateSaveEnabled();
    }
    if (usernameError) usernameError.textContent = "";

    if (!usernameModal) return;
    usernameModal.removeAttribute("hidden");
    usernameModal.setAttribute("aria-hidden", "false");
    lockBodyScroll(true);

    requestAnimationFrame(function () {
      if (usernameInput) {
        usernameInput.focus();
        usernameInput.select();
      } else if (usernameSaveBtn && !usernameSaveBtn.disabled) {
        usernameSaveBtn.focus();
      }
    });
  }

  function closeUsernameModal() {
    if (!usernameModal) return;
    usernameModal.setAttribute("hidden", "");
    usernameModal.setAttribute("aria-hidden", "true");
    lockBodyScroll(false);
    if (focusBeforeModal && typeof focusBeforeModal.focus === "function") {
      try {
        focusBeforeModal.focus();
      } catch (_) {}
    }
    focusBeforeModal = null;
  }

  function saveUsernameFromInput() {
    if (!usernameInput || !usernameSaveBtn || usernameSaveBtn.disabled) return false;
    var normalized = normalizeHandle(usernameInput.value);
    if (!isValidHandle(normalized)) {
      if (usernameError) {
        usernameError.textContent = "Use 1–15 letters, numbers, or underscores.";
      }
      return false;
    }
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch (_) {}
    if (usernameError) usernameError.textContent = "";
    setWelcomeLine(normalized);
    injectGameScript();
    closeUsernameModal();
    updateEditHandleLabel();
    return true;
  }

  var howToModal = document.getElementById("howToModal");
  var howToCloseBtns = document.querySelectorAll("[data-howto-close]");
  var howToGotIt = document.getElementById("howToGotIt");

  function openHowToModal() {
    focusBeforeModal = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!howToModal) return;
    howToModal.removeAttribute("hidden");
    howToModal.setAttribute("aria-hidden", "false");
    lockBodyScroll(true);
    requestAnimationFrame(function () {
      var t = howToGotIt || howToModal.querySelector("button");
      if (t && typeof t.focus === "function") t.focus();
    });
  }

  function closeHowToModal() {
    if (!howToModal) return;
    howToModal.setAttribute("hidden", "");
    howToModal.setAttribute("aria-hidden", "true");
    lockBodyScroll(false);
    if (focusBeforeModal && typeof focusBeforeModal.focus === "function") {
      try {
        focusBeforeModal.focus();
      } catch (_) {}
    }
    focusBeforeModal = null;
  }

  function updateEditHandleLabel() {
    var btn = document.getElementById("editHandleBtn");
    if (!btn) return;
    var h = getStoredHandle();
    btn.textContent = h ? "Edit X handle" : "Set X handle";
  }

  function onGlobalKeydown(e) {
    if (e.key !== "Escape") return;

    if (howToModal && !howToModal.hidden) {
      e.preventDefault();
      closeHowToModal();
      return;
    }

    if (usernameModal && !usernameModal.hidden) {
      if (usernameIsFirstTime) return;
      e.preventDefault();
      closeUsernameModal();
    }
  }

  document.addEventListener("keydown", onGlobalKeydown);

  if (usernameInput) {
    usernameInput.addEventListener("input", function () {
      var start = usernameInput.selectionStart;
      var raw = usernameInput.value;
      var norm = normalizeHandle(raw);
      if (norm !== raw) {
        usernameInput.value = norm;
        if (start != null) {
          var pos = Math.min(norm.length, start);
          usernameInput.setSelectionRange(pos, pos);
        }
      }
      updateUsernameCharCount();
      updateSaveEnabled();
      if (usernameError) usernameError.textContent = "";
    });
    usernameInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        if (usernameSaveBtn && !usernameSaveBtn.disabled) {
          e.preventDefault();
          saveUsernameFromInput();
        }
      }
    });
  }

  if (usernameSaveBtn) {
    usernameSaveBtn.addEventListener("click", function () {
      saveUsernameFromInput();
    });
  }

  if (usernameCloseBtn) {
    usernameCloseBtn.addEventListener("click", function () {
      if (!usernameIsFirstTime) closeUsernameModal();
    });
  }

  if (usernameModal) {
    usernameModal.addEventListener("click", function (e) {
      if (e.target === usernameModal && !usernameIsFirstTime) {
        closeUsernameModal();
      }
    });
  }

  howToCloseBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      closeHowToModal();
    });
  });

  if (howToModal) {
    howToModal.addEventListener("click", function (e) {
      if (e.target === howToModal) closeHowToModal();
    });
  }

  var howToBtn = document.getElementById("howToPlayBtn");
  if (howToBtn) {
    howToBtn.addEventListener("click", function () {
      openHowToModal();
    });
  }

  var editHandleBtn = document.getElementById("editHandleBtn");
  if (editHandleBtn) {
    editHandleBtn.addEventListener("click", function () {
      openUsernameModal({ firstTime: !getStoredHandle() });
    });
  }

  updateEditHandleLabel();

  var initial = getStoredHandle();
  var loadingEl = document.getElementById("introSplashLoading");
  if (initial) {
    setWelcomeLine(initial);
    injectGameScript();
  } else {
    setWelcomeLine("");
    if (loadingEl) loadingEl.textContent = "Save your handle to load the game";
    openUsernameModal({ firstTime: true });
  }
})();
