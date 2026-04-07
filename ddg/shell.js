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
  const SKIN_STORAGE_KEY = "frappybrew_skin";

  /** Default pickups + hazard (Oceanus / water theme). */
  var DEFAULT_SKIN_ASSETS = {
    bean: "assets/bean.png",
    bean_golden: "assets/bean_golden.png",
    cup_red: "assets/ddg.png",
    pillar_cup: "assets/pillar_cup.png",
    mineHowto: "assets/mine-howto.svg",
    hazardTheme: "water",
  };

  /**
   * Player + scene pairs; optional pickup art + hazardTheme + howTo copy per Lord.
   */
  var FRAPPY_SKINS = [
    {
      id: "1",
      player: "assets/player1.png",
      bg: "assets/bg01.png",
      characterName: "The Supreme Leader",
      sceneName: "Supreme Lab",
      bean: "assets/skin_lab_bean.svg",
      bean_golden: "assets/skin_lab_golden.svg",
      cup_red: "assets/ddg.png",
      pillar_cup: "assets/skin_lab_pillar.svg",
      mineHowto: "assets/skin_lab_mine.svg",
      hazardTheme: "lab",
      howTo: {
        themeIntro:
          "You rule the Supreme Lab as The Supreme Leader. Flap through sealed corridors—every pickup is lab-themed, and the hazard sphere is a volatile containment core.",
        controls:
          "Tap, click, or press Space to flap. Stay in the gap between the lab pillars (reinforced glass and steel).",
        scoring:
          "Pass pillars to increase your score. Your best run is saved on this device.",
        chipBean: "Lab bubble (+1 score, +1 bubble)",
        chipGolden: "Golden reactor bubble (+5, +1 bubble, shield charge)",
        chipFish: "DDG skull (+8 score)",
        shield:
          "Collect a golden reactor bubble to gain a shield ring. The next hit consumes the shield instead of ending your run.",
        avoidHazard: "Containment sphere — explodes on contact",
        avoidPillar: "Lab pillars — don’t touch the solid parts",
      },
    },
    {
      id: "2",
      player: "assets/player2.png",
      bg: "assets/bg02.png",
      characterName: "Inferna",
      sceneName: "Molten Crucible",
      bean: "assets/skin_fire_bean.svg",
      bean_golden: "assets/skin_fire_golden.svg",
      cup_red: "assets/ddg.png",
      pillar_cup: "assets/skin_fire_pillar.svg",
      mineHowto: "assets/skin_fire_mine.svg",
      hazardTheme: "fire",
      howTo: {
        themeIntro:
          "Inferna burns through the Molten Crucible. Flap between molten columns—collect embers and flames, and steer clear of the cinder core hazard.",
        controls:
          "Tap, click, or press Space to flap. Stay in the gap between the molten pillars.",
        scoring:
          "Pass pillars to increase your score. Your best run is saved on this device.",
        chipBean: "Ember flame (+1 score, +1 bubble)",
        chipGolden: "Solar core (+5, +1 bubble, shield charge)",
        chipFish: "DDG skull (+8 score)",
        shield:
          "Collect a solar core to gain a shield ring. The next hit consumes the shield instead of ending your run.",
        avoidHazard: "Cinder core — explodes on contact",
        avoidPillar: "Molten pillars — don’t touch the solid parts",
      },
    },
    {
      id: "3",
      player: "assets/player3.png",
      bg: "assets/bg03.png",
      characterName: "Oceanus",
      sceneName: "Primordial Waters",
      bean: "assets/bean.png",
      bean_golden: "assets/bean_golden.png",
      cup_red: "assets/ddg.png",
      pillar_cup: "assets/pillar_cup.png",
      mineHowto: "assets/mine-howto.svg",
      hazardTheme: "water",
      howTo: {
        themeIntro:
          "Oceanus glides through the Primordial Waters. Flap past steel pillars, scoop bubbles and fish, and dodge the underwater mine.",
        controls:
          "Tap, click, or press Space to flap. Stay in the gap between the steel pillars.",
        scoring:
          "Pass pillars to increase your score. Your best run is saved on this device.",
        chipBean: "Bubble (+1 score, +1 bubble)",
        chipGolden: "Golden bubble (+5, +1 bubble, shield charge)",
        chipFish: "DDG skull (+8 score)",
        shield:
          "Collect a golden bubble to gain a shield ring. The next hit consumes the shield instead of ending your run.",
        avoidHazard: "Underwater mine — explodes on contact",
        avoidPillar: "Steel pillars — don’t touch the solid parts",
      },
    },
  ];

  function skinGamePayload(skin) {
    var d = DEFAULT_SKIN_ASSETS;
    return {
      player: skin.player,
      bg: skin.bg,
      bean: skin.bean || d.bean,
      bean_golden: skin.bean_golden || d.bean_golden,
      cup_red: skin.cup_red || d.cup_red,
      pillar_cup: skin.pillar_cup || d.pillar_cup,
      hazardTheme: skin.hazardTheme || d.hazardTheme,
    };
  }

  /** @type {HTMLElement | null} */
  var focusBeforeModal = null;
  var usernameIsFirstTime = false;
  var characterSelectFirstTime = false;
  /** @type {string | null} */
  var selectedSkinId = null;

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

  /** Intro welcome + game HUD handle line (shown while playing). */
  function syncHandleDisplay() {
    var h = getStoredHandle();
    setWelcomeLine(h);
    var bar = document.getElementById("gameHandleBar");
    if (bar) {
      if (h) {
        bar.textContent = "@" + h;
        bar.removeAttribute("hidden");
      } else {
        bar.textContent = "";
        bar.setAttribute("hidden", "");
      }
    }
  }

  function getSkinId() {
    try {
      var v = localStorage.getItem(SKIN_STORAGE_KEY);
      return v && /^[123]$/.test(v) ? v : "";
    } catch (_) {
      return "";
    }
  }

  function getSkinById(id) {
    for (var i = 0; i < FRAPPY_SKINS.length; i++) {
      if (FRAPPY_SKINS[i].id === id) return FRAPPY_SKINS[i];
    }
    return FRAPPY_SKINS[0];
  }

  function syncHudSkinTheme(skin) {
    var el = document.documentElement;
    if (skin && skin.id && /^[123]$/.test(String(skin.id))) {
      el.setAttribute("data-frappy-skin", String(skin.id));
    } else {
      el.removeAttribute("data-frappy-skin");
    }
  }

  function setSkinWindowAndPage(skin) {
    if (typeof window !== "undefined" && skin) {
      window.__FRAPPY_SKIN__ = skinGamePayload(skin);
    }
    if (skin && skin.bg) {
      var u = assetUrl(skin.bg).replace(/\\/g, "/");
      document.documentElement.style.setProperty("--frappy-bg-page", 'url("' + u + '")');
    }
    syncHudSkinTheme(skin);
  }

  function applyStoredSkinToPage() {
    var id = getSkinId();
    if (!id) {
      syncHudSkinTheme(null);
      return;
    }
    setSkinWindowAndPage(getSkinById(id));
  }

  function syncHowToHeroImages() {
    var id = getSkinId();
    var skinForCopy = getSkinById(id || "3");
    var skinForHero = id ? skinForCopy : getSkinById("3");
    var bgEl = document.querySelector(".howto-hero-bg");
    var plEl = document.querySelector(".howto-hero-player");
    if (bgEl) bgEl.src = assetUrl(skinForHero.bg);
    if (plEl) plEl.src = assetUrl(skinForHero.player);
    syncHowToSkinText(skinForCopy);
    if (!id) {
      var intro = document.getElementById("howtoThemeIntro");
      if (intro) {
        intro.textContent =
          "Choose your Lord of chaos from the splash screen. After you confirm, this guide matches that Lord’s scene, pickups, and hazards. Below is the Primordial Waters reference until then.";
      }
    }
  }

  function syncHowToSkinText(skin) {
    var h = skin.howTo || {};
    var minePath = skin.mineHowto || DEFAULT_SKIN_ASSETS.mineHowto;
    var set = function (id, text) {
      var el = document.getElementById(id);
      if (el && text != null && text !== "") el.textContent = text;
    };
    var setSrc = function (id, rel) {
      var el = document.getElementById(id);
      if (el && rel) el.src = assetUrl(rel);
    };
    set("howtoThemeIntro", h.themeIntro);
    set("howtoControlsText", h.controls);
    set("howtoScoringText", h.scoring);
    set("howtoTextBean", h.chipBean);
    set("howtoTextGolden", h.chipGolden);
    set("howtoTextFish", h.chipFish);
    set("howtoShieldText", h.shield);
    set("howtoTextHazard", h.avoidHazard);
    set("howtoTextPillar", h.avoidPillar);
    setSrc("howtoImgBean", skin.bean || DEFAULT_SKIN_ASSETS.bean);
    setSrc("howtoImgGolden", skin.bean_golden || DEFAULT_SKIN_ASSETS.bean_golden);
    setSrc("howtoImgFish", skin.cup_red || DEFAULT_SKIN_ASSETS.cup_red);
    setSrc("howtoMineImg", minePath);
    setSrc("howtoPillarImg", skin.pillar_cup || DEFAULT_SKIN_ASSETS.pillar_cup);
    var th = document.getElementById("howto-theme");
    if (th) th.textContent = getSkinId() ? skin.characterName : "Your Lord";
  }

  function syncHowToPlayButtonAccent() {
    var btn = document.getElementById("howToPlayBtn");
    if (!btn) return;
    btn.classList.remove(
      "howto-btn--accent-1",
      "howto-btn--accent-2",
      "howto-btn--accent-3",
      "howto-btn--accent-none"
    );
    var id = getSkinId();
    if (!id) {
      btn.classList.add("howto-btn--accent-none");
      return;
    }
    if (id === "1") btn.classList.add("howto-btn--accent-1");
    else if (id === "2") btn.classList.add("howto-btn--accent-2");
    else if (id === "3") btn.classList.add("howto-btn--accent-3");
  }

  function buildCharacterGrid() {
    var grid = document.getElementById("characterGrid");
    if (!grid) return;
    grid.innerHTML = "";
    FRAPPY_SKINS.forEach(function (skin) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "character-card";
      btn.setAttribute("data-skin-id", skin.id);
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", "false");
      btn.setAttribute(
        "aria-label",
        skin.characterName + ", scene " + skin.sceneName
      );
      btn.innerHTML =
        '<span class="character-card-preview">' +
        '<img class="character-card-bg" src="' +
        assetUrl(skin.bg) +
        '" alt="" />' +
        '<img class="character-card-player" src="' +
        assetUrl(skin.player) +
        '" alt="" />' +
        "</span>" +
        '<span class="character-card-name"></span>' +
        '<span class="character-card-scene"></span>';
      btn.querySelector(".character-card-name").textContent = skin.characterName;
      btn.querySelector(".character-card-scene").textContent = skin.sceneName;
      btn.addEventListener("click", function () {
        selectCharacterCard(skin.id);
      });
      grid.appendChild(btn);
    });
  }

  function selectCharacterCard(id) {
    selectedSkinId = id;
    var grid = document.getElementById("characterGrid");
    if (grid) {
      var cards = grid.querySelectorAll(".character-card");
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        var sid = c.getAttribute("data-skin-id");
        var on = sid === id;
        c.classList.toggle("character-card--selected", on);
        c.setAttribute("aria-checked", on ? "true" : "false");
      }
    }
    var cont = document.getElementById("characterSelectContinue");
    if (cont) cont.disabled = !id;
  }

  var characterSelectModal = document.getElementById("characterSelectModal");

  function openCharacterSelectModal(opts) {
    var firstTime = !!(opts && opts.firstTime);
    characterSelectFirstTime = firstTime;
    focusBeforeModal = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    var preset = (opts && opts.presetId) || getSkinId() || "1";
    selectCharacterCard(preset);

    if (!characterSelectModal) return;
    characterSelectModal.removeAttribute("hidden");
    characterSelectModal.setAttribute("aria-hidden", "false");
    lockBodyScroll(true);
    requestAnimationFrame(function () {
      var cont = document.getElementById("characterSelectContinue");
      if (cont && typeof cont.focus === "function") cont.focus();
    });
  }

  function closeCharacterSelectModal() {
    if (!characterSelectModal) return;
    characterSelectModal.setAttribute("hidden", "");
    characterSelectModal.setAttribute("aria-hidden", "true");
    lockBodyScroll(false);
    if (focusBeforeModal && typeof focusBeforeModal.focus === "function") {
      try {
        focusBeforeModal.focus();
      } catch (_) {}
    }
    focusBeforeModal = null;
  }

  function confirmCharacterSelection() {
    if (!selectedSkinId) return;
    try {
      localStorage.setItem(SKIN_STORAGE_KEY, selectedSkinId);
    } catch (_) {}
    var skin = getSkinById(selectedSkinId);
    setSkinWindowAndPage(skin);
    syncHowToHeroImages();
    syncHowToPlayButtonAccent();
    closeCharacterSelectModal();

    var hasGame = !!document.querySelector("script[data-frappy-brew]");
    if (!hasGame) {
      injectGameScript();
    } else if (window.FrappyBrew && typeof window.FrappyBrew.reloadSkinAssets === "function") {
      window.FrappyBrew.reloadSkinAssets();
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
    syncHandleDisplay();
    closeUsernameModal();
    updateEditHandleLabel();
    var hasGame = !!document.querySelector("script[data-frappy-brew]");
    if (!hasGame) {
      openCharacterSelectModal({ firstTime: true });
    }
    return true;
  }

  var howToModal = document.getElementById("howToModal");
  var howToCloseBtns = document.querySelectorAll("[data-howto-close]");
  var howToGotIt = document.getElementById("howToGotIt");

  function openHowToModal() {
    syncHowToHeroImages();
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

  var leaderboardModal = document.getElementById("leaderboardModal");

  function onGlobalKeydown(e) {
    if (e.key !== "Escape") return;

    if (leaderboardModal && !leaderboardModal.hidden) {
      e.preventDefault();
      if (window.Leaderboard && typeof window.Leaderboard.closeLeaderboardModal === "function") {
        window.Leaderboard.closeLeaderboardModal();
      }
      return;
    }

    if (howToModal && !howToModal.hidden) {
      e.preventDefault();
      closeHowToModal();
      return;
    }

    if (characterSelectModal && !characterSelectModal.hidden) {
      if (characterSelectFirstTime) return;
      e.preventDefault();
      closeCharacterSelectModal();
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

  var gameHowToBtn = document.getElementById("gameHowToBtn");
  if (gameHowToBtn) {
    gameHowToBtn.addEventListener("click", function (e) {
      e.preventDefault();
      openHowToModal();
    });
  }

  var editHandleBtn = document.getElementById("editHandleBtn");
  if (editHandleBtn) {
    editHandleBtn.addEventListener("click", function () {
      openUsernameModal({ firstTime: !getStoredHandle() });
    });
  }

  buildCharacterGrid();

  var characterSelectContinue = document.getElementById("characterSelectContinue");
  if (characterSelectContinue) {
    characterSelectContinue.addEventListener("click", function () {
      confirmCharacterSelection();
    });
  }

  if (characterSelectModal) {
    characterSelectModal.addEventListener("click", function (e) {
      if (e.target === characterSelectModal && !characterSelectFirstTime) {
        closeCharacterSelectModal();
      }
    });
  }

  var chooseCharacterBtn = document.getElementById("chooseCharacterBtn");
  if (chooseCharacterBtn) {
    chooseCharacterBtn.addEventListener("click", function () {
      openCharacterSelectModal({ firstTime: false });
    });
  }

  updateEditHandleLabel();

  var initial = getStoredHandle();
  var loadingEl = document.getElementById("introSplashLoading");
  function onBackToMenu() {
    if (window.FrappyBrew && typeof window.FrappyBrew.returnToMenu === "function") {
      window.FrappyBrew.returnToMenu();
    } else {
      var intro = document.getElementById("introSplash");
      if (intro) {
        intro.classList.remove("hidden");
        intro.setAttribute("aria-hidden", "false");
      }
    }
    syncHandleDisplay();
  }

  var backBtn = document.getElementById("gameBackBtn");
  if (backBtn) {
    backBtn.addEventListener("click", function (e) {
      e.preventDefault();
      onBackToMenu();
    });
  }

  applyStoredSkinToPage();
  syncHowToHeroImages();
  syncHowToPlayButtonAccent();

  if (initial) {
    syncHandleDisplay();
    if (getSkinId()) {
      injectGameScript();
    } else {
      if (loadingEl) loadingEl.textContent = "Choose your Lord of chaos to continue";
      openCharacterSelectModal({ firstTime: true });
    }
  } else {
    syncHandleDisplay();
    if (loadingEl) loadingEl.textContent = "Save your handle to load the game";
    openUsernameModal({ firstTime: true });
  }
})();
