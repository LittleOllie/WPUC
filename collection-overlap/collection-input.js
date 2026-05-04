/**
 * CollectionInput — OpenSea collection URL or contract address (0x...) only.
 * Resolves URLs via GET /api/search-collections?q={slug} (Worker). Contract display uses ETH then Base on the server.
 */
(function () {
  const PLACEHOLDER = "Paste collection URL or contract address";
  const DEBOUNCE_MS = 300;
  /** Up to this many slug characters: show saved collections only (no search API). */
  const LOCAL_SAVED_PREFIX_MAX = 20;
  const CUSTOM_CONTRACT_NAME = "Custom Contract";
  const MSG_RETRYING = "Having trouble loading collection… retrying";
  const MSG_LOAD_FINAL = "Couldn't load this collection. Try again or reselect it.";
  const MSG_SEARCH_FAILED = "Search failed, try again";
  const MSG_INVALID_CONTRACT = "Invalid contract address";
  const MSG_ENTER_NEED_SELECTION = "Please select a valid collection";
  const MSG_UNSUPPORTED = "Paste a collection URL or contract address (0x…).";

  const slugCache = new Map();
  const SLUG_CACHE_MAX = 48;

  function slugCachePrune() {
    while (slugCache.size > SLUG_CACHE_MAX) {
      const k = slugCache.keys().next().value;
      slugCache.delete(k);
    }
  }

  function slugCacheGet(q) {
    return slugCache.get(q);
  }

  function slugCacheSet(q, results) {
    slugCache.set(q, results);
    slugCachePrune();
  }

  function slugCacheDelete(q) {
    const k = String(q || "")
      .trim()
      .toLowerCase();
    if (k) slugCache.delete(k);
  }

  function apiBase() {
    const b = typeof window.COLLECTION_OVERLAP_API_BASE === "string" ? window.COLLECTION_OVERLAP_API_BASE.trim() : "";
    return b.replace(/\/+$/, "");
  }

  function buildSearchUrl(q) {
    const root = apiBase();
    const path = `/api/search-collections?q=${encodeURIComponent(q)}`;
    return root ? `${root}${path}` : path;
  }

  function buildContractDisplayUrl(address) {
    const root = apiBase();
    const path = `/api/contract-display?address=${encodeURIComponent(address)}`;
    return root ? `${root}${path}` : path;
  }

  function isLikelyNetworkFailure(err) {
    const name = err?.name || "";
    const msg = String(err?.message || err || "").toLowerCase();
    return (
      name === "TypeError" ||
      msg.includes("failed to fetch") ||
      msg.includes("load failed") ||
      msg.includes("networkerror") ||
      msg.includes("could not connect") ||
      msg.includes("network request failed")
    );
  }

  function validateContract42(s) {
    const t = String(s || "")
      .trim()
      .replace(/[!.,;\s]+$/g, "")
      .toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(t)) return null;
    return t;
  }

  function stripZeroWidth(s) {
    return String(s || "").replace(/[\u200B-\u200D\uFEFF]/g, "");
  }

  /** Trim + strip accidental whitespace/newlines; lowercase for EVM 0x. */
  function sanitizeEvmContractInput(s) {
    return String(s || "")
      .trim()
      .replace(/[\u200B-\u200D\uFEFF\r\n]+/g, "")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  /** Pull the first OpenSea URL out of pasted text (e.g. "Check out https://opensea.io/..."). */
  function extractOpenSeaHrefFromPaste(t) {
    let s = stripZeroWidth(t).trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1).trim();
    }
    const urlRe = /https?:\/\/[^\s<>"')\]}]+/gi;
    let m;
    while ((m = urlRe.exec(s)) !== null) {
      let piece = m[0].replace(/[),.;]+$/g, "");
      if (/opensea\.io/i.test(piece)) return piece;
    }
    if (/opensea\.io/i.test(s)) {
      let href = s.replace(/[),.;]+$/g, "");
      if (!/^https?:\/\//i.test(href)) href = `https://${href.replace(/^\/+/, "")}`;
      return href;
    }
    return null;
  }

  /** ETH or Base contract from `/assets/{chain}/0x…` or `/item/{chain}/0x…` (matches Worker). */
  function openSeaEthereumContractFromPathname(pathname) {
    const p = String(pathname || "").replace(/\/+$/, "");
    const re = /\/(?:assets|item)\/(?:ethereum|eth|base)\/(0x[a-fA-F0-9]{40})(?:\/|$|\?)/i;
    const m = p.match(re);
    if (!m) return null;
    return validateContract42(m[1]);
  }

  /** Collection slug from opensea.io/.../collection/{slug}/… */
  function openSeaCollectionSlugFromHref(hrefStr) {
    let u;
    try {
      let h = String(hrefStr || "").trim();
      if (!/^https?:\/\//i.test(h)) h = `https://${h.replace(/^\/+/, "")}`;
      u = new URL(h);
    } catch {
      return null;
    }
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (!host.endsWith("opensea.io")) return null;
    const col = u.pathname.match(/\/collection\/([^/?#]+)/i);
    if (!col) return null;
    try {
      return decodeURIComponent(col[1]);
    } catch {
      return col[1];
    }
  }

  /** Plain collection slug / symbol (matches Worker `looksLikeOpenseaCollectionSlug`) — searchable without full URL. */
  function looksLikeCollectionSlugQuery(s) {
    const t = String(s || "")
      .trim()
      .toLowerCase();
    if (!t || t.length > 120) return false;
    if (t.startsWith("0x")) return false;
    if (/^https?:\/\//.test(t)) return false;
    if (/[^a-z0-9._-]/.test(t)) return false;
    return true;
  }

  /**
   * @param {string} trimmed
   * @returns {{ kind: string, address?: string, slug?: string }}
   */
  function classifyTrimmedInput(trimmed) {
    if (!trimmed) return { kind: "idle" };

    const osHref = extractOpenSeaHrefFromPaste(trimmed);
    if (osHref) {
      let u;
      try {
        let h = osHref.trim();
        if (!/^https?:\/\//i.test(h)) h = `https://${h.replace(/^\/+/, "")}`;
        u = new URL(h);
      } catch {
        return { kind: "bad-url" };
      }
      const contract = openSeaEthereumContractFromPathname(u.pathname);
      if (contract) return { kind: "contract-valid", address: contract };
      const slug = openSeaCollectionSlugFromHref(osHref);
      if (slug) return { kind: "opensea-slug", slug };
      return { kind: "bad-url" };
    }

    if (/^0x/i.test(trimmed)) {
      const norm = trimmed.replace(/[!.,;\s]+$/g, "").toLowerCase();
      if (norm.length === 42) {
        const ok = validateContract42(norm);
        if (ok) return { kind: "contract-valid", address: ok };
        return { kind: "contract-invalid" };
      }
      if (norm.length > 42) return { kind: "contract-invalid" };
      return { kind: "partial-contract" };
    }

    const slugCandidate = stripZeroWidth(trimmed).trim().toLowerCase();
    if (looksLikeCollectionSlugQuery(slugCandidate)) {
      return { kind: "slug-query", slug: slugCandidate };
    }

    return { kind: "unsupported" };
  }

  class CollectionInput {
    constructor(container) {
      this._container = container;
      this.state = {
        inputValue: "",
        preservedInput: "",
        selectedCollection: null,
        results: [],
      };
      this._debounceTimer = null;
      this._searchAbort = null;
      this._inlineError = "";
      this._slugResolveGen = 0;
      this._onDocDown = this._onDocumentPointerDown.bind(this);
      this._onPageShow = this._onPageShow.bind(this);
      this._onVisibilityChange = this._onVisibilityChange.bind(this);
      /** After a real background/hide, next visible → retry draft slug once (iOS Safari / bfcache). */
      this._resumeAfterHide = false;
      this._resumeTimer = null;
      this._hydrateAbort = null;
      this._retryBtn = null;
      this._lastSlugForRetry = null;
      this._render();
      document.addEventListener("pointerdown", this._onDocDown, true);
      window.addEventListener("pageshow", this._onPageShow);
      document.addEventListener("visibilitychange", this._onVisibilityChange);
    }

    _onPageShow(e) {
      if (e && e.persisted) this._scheduleDraftResumeRetry();
    }

    _onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        this._resumeAfterHide = true;
        return;
      }
      if (document.visibilityState === "visible" && this._resumeAfterHide) {
        this._resumeAfterHide = false;
        this._scheduleDraftResumeRetry();
      }
    }

    /** Debounced so pageshow + visibilitychange do not double-fetch. */
    _scheduleDraftResumeRetry() {
      if (this.state.selectedCollection) return;
      if (this._resumeTimer) clearTimeout(this._resumeTimer);
      this._resumeTimer = setTimeout(() => {
        this._resumeTimer = null;
        this._retryDraftAfterResume();
      }, 280);
    }

    /**
     * User often switches to OpenSea before the first search finishes; on return the field still
     * shows the URL/slug but iOS can leave a stale error or empty cache — run one fresh resolve.
     */
    _retryDraftAfterResume() {
      if (this.state.selectedCollection) return;
      const trimmed = stripZeroWidth(this._input?.value || "").trim();
      if (!trimmed) return;
      const classified = classifyTrimmedInput(trimmed);
      const slug =
        classified.kind === "slug-query" || classified.kind === "opensea-slug"
          ? classified.slug
          : null;
      if (!slug) return;
      const q = String(slug).trim().toLowerCase();
      if (this._debounceTimer) {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = null;
      }
      slugCacheDelete(q);
      this._closeDropdown();
      this._clearInlineError();
      this._setBannerLoading(false);
      void this._resolveSlug(q);
    }

    _syncInputValue() {
      this.state.inputValue = this._input.value;
    }

    _render() {
      const root = document.createElement("div");
      root.className = "co-ci";
      root.innerHTML = `
        <div class="co-ci-shell">
          <div class="co-ci-row co-ci-row--input">
            <input type="text" class="co-ci-input co-input" autocomplete="off" spellcheck="false"
              placeholder="${PLACEHOLDER}" aria-autocomplete="list" aria-expanded="false" />
            <button type="button" class="co-ci-arrow" aria-label="Saved collections" aria-expanded="false" aria-haspopup="listbox"></button>
            <button type="button" class="co-ci-clear" aria-label="Clear">×</button>
            <div class="co-ci-dropdown" role="listbox" hidden></div>
          </div>
          <div class="co-ci-banner">
            <img class="co-ci-banner__mascot" src="assets/lo-mascot.png" alt="" width="1024" height="1024" decoding="async" draggable="false" aria-hidden="true" />
            <div class="co-ci-banner__ring" aria-hidden="true"></div>
            <img class="co-ci-banner__logo" alt="" width="96" height="96" hidden decoding="async" />
          </div>
        </div>
        <p class="co-ci-error" role="status" aria-live="polite" hidden></p>
      `;
      this._container.appendChild(root);
      this._root = root;
      this._shellEl = root.querySelector(".co-ci-shell");
      this._bannerEl = root.querySelector(".co-ci-banner");
      this._bannerLogoEl = root.querySelector(".co-ci-banner__logo");
      this._input = root.querySelector(".co-ci-input");
      this._arrowBtn = root.querySelector(".co-ci-arrow");
      this._clearBtn = root.querySelector(".co-ci-clear");
      this._dropdown = root.querySelector(".co-ci-dropdown");
      this._errEl = root.querySelector(".co-ci-error");

      this._input.addEventListener("input", () => this._onInput());
      this._input.addEventListener("keydown", (e) => this._onKeydown(e));
      this._input.addEventListener("focus", () => this._onInputFocus());
      if (this._arrowBtn) {
        this._arrowBtn.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          this._onArrowClick();
        });
      }
      this._clearBtn.addEventListener("click", () => this._clearSelection());
    }

    _setAriaExpanded(open) {
      this._input.setAttribute("aria-expanded", open ? "true" : "false");
      if (this._arrowBtn) this._arrowBtn.setAttribute("aria-expanded", open ? "true" : "false");
    }

    _syncDropdownLifted(open) {
      if (!this._root || !this._container) return;
      this._root.classList.toggle("co-ci--dropdown-open", Boolean(open));
      this._container.classList.toggle("co-collection-slot--dropdown-open", Boolean(open));
      if (this._arrowBtn) this._arrowBtn.classList.toggle("co-ci-arrow--open", Boolean(open));
    }

    _onArrowClick() {
      if (!this._dropdown.hidden) {
        this._closeDropdown();
        return;
      }
      const t = stripZeroWidth(this._input.value).trim();
      if (t.startsWith("0x") && t.length < 42) {
        this._showSavedDropdown(sanitizeEvmContractInput(t), { addressPrefixOnly: true });
        return;
      }
      if (t.length > 0 && t.length <= LOCAL_SAVED_PREFIX_MAX && !/^https?:\/\//i.test(t) && !t.startsWith("0x")) {
        this._showSavedDropdown(t.toLowerCase());
        return;
      }
      this._showSavedDropdown("");
    }

    _syncVerifiedShell() {
      const sel = this.state.selectedCollection;
      const shell = this._shellEl;
      if (!shell) return;
      if (sel && sel.contractAddress) shell.classList.add("co-ci-shell--verified");
      else shell.classList.remove("co-ci-shell--verified");
      this._syncBanner();
      this._container.dispatchEvent(new CustomEvent("co-selection-change", { bubbles: true }));
    }

    _abortHydrate() {
      if (this._hydrateAbort) {
        try {
          this._hydrateAbort.abort();
        } catch (_) {
          /* ignore */
        }
        this._hydrateAbort = null;
      }
    }

    _setBannerLoading(on) {
      const banner = this._bannerEl;
      if (!banner) return;
      banner.classList.toggle("co-ci-banner--loading", Boolean(on));
    }

    /** Square under the field: faint LO mascot; spinner while searching; collection logo when resolved. */
    _syncBanner() {
      const sel = this.state.selectedCollection;
      const banner = this._bannerEl;
      const img = this._bannerLogoEl;
      if (!banner || !img) return;

      this._setBannerLoading(false);

      if (sel && sel.contractAddress) {
        const url = sel.image && String(sel.image).trim();
        if (url) {
          banner.classList.add("co-ci-banner--has-logo");
          img.alt = sel.name ? `${sel.name} logo` : "Collection logo";
          img.hidden = false;
          const fail = () => {
            banner.classList.remove("co-ci-banner--has-logo");
            img.hidden = true;
            img.removeAttribute("src");
            img.alt = "";
          };
          img.onerror = fail;
          img.onload = () => {
            img.hidden = false;
          };
          img.src = url;
        } else {
          banner.classList.remove("co-ci-banner--has-logo");
          img.onload = null;
          img.onerror = null;
          img.removeAttribute("src");
          img.hidden = true;
          img.alt = "";
        }
      } else {
        banner.classList.remove("co-ci-banner--has-logo");
        img.onload = null;
        img.onerror = null;
        img.removeAttribute("src");
        img.hidden = true;
        img.alt = "";
      }
    }

    _showInlineError(msg, retryOpts) {
      this._inlineError = msg;
      this._errEl.textContent = msg || "";
      this._errEl.hidden = !msg;
      if (this._retryBtn) {
        try {
          this._retryBtn.remove();
        } catch (_) {
          /* ignore */
        }
        this._retryBtn = null;
      }
      if (msg && retryOpts && typeof retryOpts.onRetry === "function") {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "co-ci-retry-btn";
        b.textContent = "Retry";
        b.addEventListener("click", (e) => {
          e.preventDefault();
          retryOpts.onRetry();
        });
        this._errEl.insertAdjacentElement("afterend", b);
        this._retryBtn = b;
      }
    }

    _clearInlineError() {
      this._inlineError = "";
      this._errEl.textContent = "";
      this._errEl.hidden = true;
      if (this._retryBtn) {
        try {
          this._retryBtn.remove();
        } catch (_) {
          /* ignore */
        }
        this._retryBtn = null;
      }
    }

    clearContractError() {
      this._clearInlineError();
    }

    getContractError() {
      return this._inlineError;
    }

    getInlineError() {
      return this._inlineError;
    }

    clearInlineError() {
      this._clearInlineError();
    }

    revalidateDraft() {
      if (this.state.selectedCollection) return;
      const trimmed = stripZeroWidth(this._input.value).trim();
      if (!trimmed) return;
      const classified = classifyTrimmedInput(trimmed);
      if (classified.kind === "contract-invalid") {
        this._showInlineError(MSG_INVALID_CONTRACT);
      } else if (classified.kind === "unsupported") {
        this._showInlineError(MSG_UNSUPPORTED);
      }
    }

    setCompareEmptyError(msg) {
      this._showInlineError(msg || MSG_ENTER_NEED_SELECTION);
    }

    getValue() {
      const s = this.state.selectedCollection;
      if (!s) return { contractAddress: null, name: null };
      return { contractAddress: s.contractAddress, name: s.name };
    }

    /** Image URL from selection (OpenSea-style), or null — used for compare intro animation. */
    getLogoUrl() {
      const s = this.state.selectedCollection;
      if (!s?.image) return null;
      const u = String(s.image).trim();
      return u || null;
    }

    focus() {
      this._input.focus();
    }

    destroy() {
      document.removeEventListener("pointerdown", this._onDocDown, true);
      window.removeEventListener("pageshow", this._onPageShow);
      document.removeEventListener("visibilitychange", this._onVisibilityChange);
      if (this._resumeTimer) clearTimeout(this._resumeTimer);
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      if (this._searchAbort) this._searchAbort.abort();
      this._abortHydrate();
      this._setBannerLoading(false);
      if (this._retryBtn) {
        try {
          this._retryBtn.remove();
        } catch (_) {
          /* ignore */
        }
        this._retryBtn = null;
      }
      this._container.textContent = "";
    }

    _onInputFocus() {
      if (this.state.selectedCollection) return;
      const trimmed = stripZeroWidth(this._input?.value || "").trim();
      if (trimmed) return;
      this._showSavedDropdown("");
    }

    /** @param {{ name?: string, contractAddress: string, image?: string|null }} saved */
    _applyFromSaved(saved) {
      if (!saved || !window.LOSavedCollections) return;
      const addr = window.LOSavedCollections.coNormalizeEvmAddress(saved.contractAddress);
      if (!addr || !/^0x[a-f0-9]{40}$/.test(addr)) return;
      const item = {
        name: (saved.name && String(saved.name).trim()) || "Saved collection",
        contractAddress: addr,
        image: saved.image || null,
      };
      this._applySelection(item, item.contractAddress, { forceFresh: true });
    }

    /**
     * Saved collections only (localStorage). No API.
     * @param {string} [needle]
     * @param {{ addressPrefixOnly?: boolean }} [opts]
     */
    _showSavedDropdown(needle, opts) {
      if (!window.LOSavedCollections) {
        this._closeDropdown();
        return;
      }
      const list = window.LOSavedCollections.filterForChain("evm", needle || "", opts);
      this._dropdown.innerHTML = "";
      const head = document.createElement("div");
      head.className = "co-ci-dd-heading";
      head.textContent = "Saved collections";
      this._dropdown.appendChild(head);
      if (!list.length) {
        const empty = document.createElement("div");
        empty.className = "co-ci-dd-msg";
        empty.textContent = needle ? "No saved matches for that text." : "No saved collections yet.";
        this._dropdown.appendChild(empty);
      } else {
        for (const it of list) {
          const row = document.createElement("button");
          row.type = "button";
          row.className = "co-ci-dd-item";
          row.setAttribute("role", "option");
          const short = this.shortenContract(it.contractAddress);
          let thumb;
          if (it.image) {
            const img = document.createElement("img");
            img.className = "co-ci-dd-img";
            img.alt = "";
            img.width = 36;
            img.height = 36;
            img.loading = "lazy";
            img.decoding = "async";
            img.src = it.image;
            img.addEventListener("error", () => {
              img.replaceWith(Object.assign(document.createElement("div"), { className: "co-ci-dd-img co-ci-dd-img--ph", ariaHidden: "true" }));
            });
            thumb = img;
          } else {
            thumb = Object.assign(document.createElement("div"), { className: "co-ci-dd-img co-ci-dd-img--ph", ariaHidden: "true" });
          }
          const text = document.createElement("div");
          text.className = "co-ci-dd-text";
          const nameEl = document.createElement("span");
          nameEl.className = "co-ci-dd-name";
          nameEl.textContent = it.name || short;
          const addrEl = document.createElement("span");
          addrEl.className = "co-ci-dd-addr";
          addrEl.textContent = short;
          text.append(nameEl, addrEl);
          row.append(thumb, text);
          row.addEventListener("mousedown", (e) => {
            e.preventDefault();
            this._applyFromSaved(it);
          });
          this._dropdown.appendChild(row);
        }
      }
      this._dropdown.hidden = false;
      this._syncDropdownLifted(true);
      this._setAriaExpanded(true);
    }

    _onDocumentPointerDown(e) {
      if (!this._root.contains(e.target)) this._closeDropdown();
    }

    _closeDropdown() {
      this._dropdown.hidden = true;
      this._syncDropdownLifted(false);
      this._setAriaExpanded(false);
    }

    _showNoResults() {
      this._closeDropdown();
    }

    _showDropdownError(msg) {
      this._dropdown.hidden = false;
      this._syncDropdownLifted(true);
      this._setAriaExpanded(true);
      const el = document.createElement("div");
      el.className = "co-ci-dd-msg co-ci-dd-err";
      el.textContent = msg;
      this._dropdown.replaceChildren(el);
    }

    shortenContract(addr) {
      const a = String(addr || "").trim().toLowerCase();
      if (!/^0x[a-f0-9]{40}$/.test(a)) return a || "";
      return `${a.slice(0, 6)}...${a.slice(-4)}`;
    }

    /**
     * @param {{ name: string, contractAddress: string, image: string|null }} item
     * @param {string} [displayText] text to keep visible in the field (URL or 0x…)
     * @param {{ forceFresh?: boolean }} [opts] saved picks: always re-fetch metadata
     */
    _applySelection(item, displayText, opts) {
      const addr = sanitizeEvmContractInput(item.contractAddress);
      if (!/^0x[a-f0-9]{40}$/.test(addr)) return;
      const show =
        displayText != null && String(displayText).trim() !== ""
          ? String(displayText).trim()
          : addr;
      this.state.preservedInput = show;
      this.state.selectedCollection = {
        name: item.name,
        contractAddress: addr,
        image: item.image || null,
      };
      this.state.results = [];
      this._clearInlineError();
      this._input.value = show;
      this.state.inputValue = show;
      if (this._searchAbort) this._searchAbort.abort();
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      this._abortHydrate();
      this._syncVerifiedShell();
      if (window.LOSavedCollections) {
        window.LOSavedCollections.upsert({
          name: this.state.selectedCollection.name,
          contractAddress: addr,
          image: this.state.selectedCollection.image,
          chain: "evm",
        });
      }
      void this._hydrateContractMetadataIfNeeded({ force: opts && opts.forceFresh === true });
      this._closeDropdown();
    }

    /**
     * Fill name/logo from Worker (Alchemy) when paste-by-address or search returned no image.
     * @param {{ force?: boolean }} [opts] force=true re-fetches even when name+image look complete (saved picks).
     */
    async _hydrateContractMetadataIfNeeded(opts) {
      const sel = this.state.selectedCollection;
      if (!sel?.contractAddress) return;
      const force = opts && opts.force === true;
      const needsLogo = !sel.image || !String(sel.image).trim();
      const needsName = !sel.name || sel.name === CUSTOM_CONTRACT_NAME;
      if (!force && !needsLogo && !needsName) return;

      const addrSnap = sanitizeEvmContractInput(sel.contractAddress);
      if (this.state.selectedCollection) this.state.selectedCollection.contractAddress = addrSnap;

      const ac = new AbortController();
      this._abortHydrate();
      this._hydrateAbort = ac;
      this._setBannerLoading(true);
      const url = buildContractDisplayUrl(addrSnap);
      const rf = window.coFetchJson && window.coFetchJson.coResilientFetchJson;
      try {
        if (!rf) {
          const res = await fetch(url, { method: "GET", signal: ac.signal, mode: "cors" });
          const data = await res.json().catch(() => ({}));
          if (ac.signal.aborted) return;
          if (this.state.selectedCollection?.contractAddress !== addrSnap) return;
          if (!res.ok || !data?.success) {
            this._showInlineError(MSG_LOAD_FINAL, {
              onRetry: () => {
                this._clearInlineError();
                void this._hydrateContractMetadataIfNeeded({ force: true });
              },
            });
            return;
          }
          const n = data.name && String(data.name).trim();
          if (n && (needsName || force || this.state.selectedCollection.name === CUSTOM_CONTRACT_NAME)) {
            this.state.selectedCollection.name = n;
          }
          const img = data.image && String(data.image).trim();
          if (img && (needsLogo || force)) this.state.selectedCollection.image = img;
          if (window.LOSavedCollections) {
            window.LOSavedCollections.upsert({
              name: this.state.selectedCollection.name,
              contractAddress: addrSnap,
              image: this.state.selectedCollection.image,
              chain: "evm",
            });
          }
          this._syncVerifiedShell();
          return;
        }

        const { res, data } = await rf(url, {
          signal: ac.signal,
          timeoutMs: 8000,
          maxAdditionalRetries: 2,
          retryDelaysMs: [300, 800],
          onRetrying: () => {
            if (ac.signal.aborted) return;
            if (this.state.selectedCollection?.contractAddress !== addrSnap) return;
            this._showInlineError(MSG_RETRYING);
          },
          shouldRetry: ({ res: r, data: d, err, isLastAttempt }) => {
            if (isLastAttempt) return false;
            if (err) {
              if (ac.signal.aborted) return false;
              return true;
            }
            if (!r) return true;
            if (r.status >= 500 || r.status === 429 || r.status === 408) return true;
            if (r.status === 503) return true;
            if (!r.ok) return false;
            if (!d?.success) return true;
            return false;
          },
        });

        if (ac.signal.aborted) return;
        if (this.state.selectedCollection?.contractAddress !== addrSnap) return;
        if (!res.ok || !data?.success) {
          const apiErr = typeof data?.error === "string" && data.error.trim() ? data.error.trim() : "";
          this._showInlineError(apiErr || MSG_LOAD_FINAL, {
            onRetry: () => {
              this._clearInlineError();
              void this._hydrateContractMetadataIfNeeded({ force: true });
            },
          });
          return;
        }
        const n = data.name && String(data.name).trim();
        if (n && (needsName || force || this.state.selectedCollection.name === CUSTOM_CONTRACT_NAME)) {
          this.state.selectedCollection.name = n;
        }
        const img = data.image && String(data.image).trim();
        if (img && (needsLogo || force)) this.state.selectedCollection.image = img;
        if (window.LOSavedCollections) {
          window.LOSavedCollections.upsert({
            name: this.state.selectedCollection.name,
            contractAddress: addrSnap,
            image: this.state.selectedCollection.image,
            chain: "evm",
          });
        }
        this._clearInlineError();
        this._syncVerifiedShell();
      } catch (e) {
        if (e?.name === "AbortError") return;
        if (this.state.selectedCollection?.contractAddress !== addrSnap) return;
        this._showInlineError(MSG_LOAD_FINAL, {
          onRetry: () => {
            this._clearInlineError();
            void this._hydrateContractMetadataIfNeeded({ force: true });
          },
        });
      } finally {
        if (this._hydrateAbort === ac) {
          this._hydrateAbort = null;
          this._setBannerLoading(false);
          this._syncBanner();
        }
      }
    }

    _applyCustomContract(address, displayText) {
      const addr = sanitizeEvmContractInput(address);
      const ok = validateContract42(addr);
      if (!ok) return;
      this._applySelection(
        {
          name: CUSTOM_CONTRACT_NAME,
          contractAddress: ok,
          image: null,
        },
        displayText != null && String(displayText).trim() ? String(displayText).trim() : ok
      );
    }

    _clearSelection() {
      this._abortHydrate();
      this.state.selectedCollection = null;
      this.state.preservedInput = "";
      this.state.results = [];
      this._clearInlineError();
      this._input.value = "";
      this._closeDropdown();
      this._input.focus();
      this._syncInputValue();
      this._setBannerLoading(false);
      this._syncVerifiedShell();
    }

    _onKeydown(e) {
      if (e.key === "Escape") {
        this._closeDropdown();
        return;
      }
      if (e.key !== "Enter") return;
      if (this.state.selectedCollection) return;

      const trimmed = sanitizeEvmContractInput(stripZeroWidth(this._input.value));
      if (!trimmed) {
        this._showInlineError(MSG_ENTER_NEED_SELECTION);
        e.preventDefault();
        return;
      }

      const ok = validateContract42(trimmed);
      if (ok) {
        this._applyCustomContract(ok, trimmed);
        e.preventDefault();
        return;
      }

      const classified = classifyTrimmedInput(trimmed);
      if (classified.kind === "contract-invalid") {
        this._showInlineError(MSG_INVALID_CONTRACT);
        e.preventDefault();
        return;
      }

      if (classified.kind === "opensea-slug") {
        e.preventDefault();
        void this._resolveSlug(classified.slug);
        return;
      }
      if (classified.kind === "slug-query") {
        e.preventDefault();
        const slug = classified.slug;
        if (slug.length <= LOCAL_SAVED_PREFIX_MAX) {
          this._showSavedDropdown(slug);
          return;
        }
        void this._resolveSlug(slug);
        return;
      }

      this._showInlineError(MSG_ENTER_NEED_SELECTION);
      e.preventDefault();
    }

    _onInput() {
      const raw = stripZeroWidth(this._input.value);
      const trimmed = raw.trim();

      if (this.state.selectedCollection) {
        if (trimmed !== String(this.state.preservedInput || "").trim()) {
          this._abortHydrate();
          this.state.selectedCollection = null;
          this.state.preservedInput = "";
          this._syncVerifiedShell();
        } else {
          this._syncInputValue();
          return;
        }
      }

      this._syncInputValue();
      this._clearInlineError();

      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      if (this._searchAbort) {
        this._searchAbort.abort();
        this._slugResolveGen += 1;
        this._setBannerLoading(false);
      }

      if (!trimmed) {
        this.state.results = [];
        this._setBannerLoading(false);
        this._closeDropdown();
        return;
      }

      const classified = classifyTrimmedInput(trimmed);

      if (classified.kind === "contract-valid") {
        this._applyCustomContract(classified.address, trimmed);
        return;
      }

      if (classified.kind === "contract-invalid") {
        this._showInlineError(MSG_INVALID_CONTRACT);
        this._closeDropdown();
        return;
      }

      if (classified.kind === "bad-url") {
        this._showInlineError("Could not read that OpenSea link.");
        this._closeDropdown();
        return;
      }

      if (classified.kind === "unsupported") {
        this._showInlineError(MSG_UNSUPPORTED);
        this.state.results = [];
        this._closeDropdown();
        return;
      }

      if (classified.kind === "partial-contract") {
        this.state.results = [];
        const needle = sanitizeEvmContractInput(trimmed);
        this._showSavedDropdown(needle, { addressPrefixOnly: true });
        return;
      }

      if (classified.kind === "opensea-slug") {
        const slug = classified.slug;
        this._debounceTimer = setTimeout(() => void this._resolveSlug(slug), DEBOUNCE_MS);
        return;
      }

      if (classified.kind === "slug-query") {
        const slug = classified.slug;
        if (slug.length <= LOCAL_SAVED_PREFIX_MAX) {
          this._showSavedDropdown(slug);
          return;
        }
        this._closeDropdown();
        this._debounceTimer = setTimeout(() => void this._resolveSlug(slug), DEBOUNCE_MS);
      }
    }

    /** @param {string} slug */
    async _resolveSlug(slug) {
      if (this.state.selectedCollection) return;
      this._slugResolveGen += 1;
      const myGen = this._slugResolveGen;
      const query = String(slug || "")
        .trim()
        .toLowerCase();
      if (!query) {
        this._closeDropdown();
        return;
      }

      this._lastSlugForRetry = query;
      const displaySnapshot = stripZeroWidth(this._input.value).trim();

      const cached = slugCacheGet(query);
      if (cached && cached.length > 0) {
        this._finishSlugResults(cached, displaySnapshot, myGen, "");
        return;
      }

      this._setBannerLoading(true);
      this._closeDropdown();
      if (this._searchAbort) {
        try {
          this._searchAbort.abort();
        } catch (_) {
          /* ignore */
        }
      }
      const ac = new AbortController();
      this._searchAbort = ac;

      const url = buildSearchUrl(query);
      const rf = window.coFetchJson && window.coFetchJson.coResilientFetchJson;
      try {
        if (!rf) {
          const res = await fetch(url, { method: "GET", signal: ac.signal, mode: "cors" });
          const data = await res.json().catch(() => ({}));
          if (ac.signal.aborted) return;
          if (myGen !== this._slugResolveGen) return;
          if (!res.ok) {
            const apiErr =
              typeof data?.error === "string" && data.error.trim()
                ? data.error.trim()
                : res.status === 404
                  ? "Search API not found on this host. Deploy the Worker or set COLLECTION_OVERLAP_API_BASE."
                  : "";
            this._showDropdownError(apiErr || MSG_SEARCH_FAILED);
            return;
          }
          if (!data?.success || !Array.isArray(data.results)) {
            const apiErr = typeof data?.error === "string" && data.error.trim() ? data.error.trim() : "";
            this._showDropdownError(apiErr || MSG_SEARCH_FAILED);
            return;
          }
          const list = data.results.slice(0, 10);
          if (myGen !== this._slugResolveGen) return;
          if (list.length > 0) slugCacheSet(query, list);
          this._finishSlugResults(list, displaySnapshot, myGen, "");
          return;
        }

        const { res, data } = await rf(url, {
          signal: ac.signal,
          timeoutMs: 8000,
          maxAdditionalRetries: 2,
          retryDelaysMs: [300, 800],
          onRetrying: () => {
            if (ac.signal.aborted) return;
            if (myGen !== this._slugResolveGen) return;
            this._showInlineError(MSG_RETRYING);
          },
          shouldRetry: ({ res: r, data: d, err, isLastAttempt }) => {
            if (isLastAttempt) return false;
            if (err) {
              if (ac.signal.aborted) return false;
              return true;
            }
            if (!r) return true;
            if (r.status === 404) return false;
            if (r.status >= 500 || r.status === 429 || r.status === 408) return true;
            if (!r.ok) return false;
            if (!d?.success) {
              if (r.status === 503) return true;
              return false;
            }
            if (!Array.isArray(d.results)) return true;
            if (d.results.length === 0) return true;
            return false;
          },
        });

        if (ac.signal.aborted) return;
        if (myGen !== this._slugResolveGen) return;
        if (!res.ok) {
          const apiErr =
            typeof data?.error === "string" && data.error.trim()
              ? data.error.trim()
              : res.status === 404
                ? "Search API not found on this host. Deploy the Worker or set COLLECTION_OVERLAP_API_BASE."
                : "";
          this._showDropdownError(apiErr || MSG_SEARCH_FAILED);
          return;
        }
        if (!data?.success || !Array.isArray(data.results)) {
          const apiErr = typeof data?.error === "string" && data.error.trim() ? data.error.trim() : "";
          this._showDropdownError(apiErr || MSG_SEARCH_FAILED);
          return;
        }
        const list = data.results.slice(0, 10);
        const hint = typeof data.hint === "string" && data.hint.trim() ? data.hint.trim() : "";
        if (myGen !== this._slugResolveGen) return;
        if (list.length > 0) slugCacheSet(query, list);
        this._finishSlugResults(list, displaySnapshot, myGen, hint);
      } catch (e) {
        if (e?.name === "AbortError") return;
        if (ac.signal.aborted) return;
        if (myGen !== this._slugResolveGen) return;
        if (isLikelyNetworkFailure(e)) {
          this._showInlineError(MSG_LOAD_FINAL, {
            onRetry: () => {
              slugCacheDelete(query);
              this._clearInlineError();
              void this._resolveSlug(query);
            },
          });
          return;
        }
        this._showInlineError(MSG_LOAD_FINAL, {
          onRetry: () => {
            slugCacheDelete(query);
            this._clearInlineError();
            void this._resolveSlug(query);
          },
        });
      } finally {
        if (myGen === this._slugResolveGen) this._setBannerLoading(false);
      }
    }

    /**
     * @param {Array<{ name: string, contractAddress: string, image: string|null }>} list
     * @param {string} displaySnapshot
     * @param {number} [requestGen] drop stale responses when the user changed input
     * @param {string} [hint]
     */
    _finishSlugResults(list, displaySnapshot, requestGen, hint) {
      if (requestGen != null && requestGen !== this._slugResolveGen) return;
      this.state.results = list.slice(0, 10);
      if (this.state.results.length === 0) {
        const q = this._lastSlugForRetry;
        const msg = (hint && hint.trim()) || MSG_LOAD_FINAL;
        this._showInlineError(msg, {
          onRetry:
            q != null && String(q).trim()
              ? () => {
                  slugCacheDelete(String(q).trim().toLowerCase());
                  this._clearInlineError();
                  void this._resolveSlug(String(q).trim().toLowerCase());
                }
              : undefined,
        });
        this._showNoResults();
        return;
      }
      if (this.state.results.length === 1) {
        this._applySelection(this.state.results[0], displaySnapshot);
        return;
      }
      this._renderPickList(this.state.results);
    }

    _renderPickList(results) {
      this._dropdown.innerHTML = "";
      this._dropdown.hidden = false;
      this._syncDropdownLifted(true);
      this._setAriaExpanded(true);
      for (const item of results) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "co-ci-dd-item";
        row.setAttribute("role", "option");
        const short = this.shortenContract(item.contractAddress);
        let thumb;
        if (item.image) {
          const img = document.createElement("img");
          img.className = "co-ci-dd-img";
          img.alt = "";
          img.width = 36;
          img.height = 36;
          img.loading = "lazy";
          img.decoding = "async";
          img.src = item.image;
          img.addEventListener("error", () => {
            img.replaceWith(Object.assign(document.createElement("div"), { className: "co-ci-dd-img co-ci-dd-img--ph", ariaHidden: "true" }));
          });
          thumb = img;
        } else {
          thumb = Object.assign(document.createElement("div"), { className: "co-ci-dd-img co-ci-dd-img--ph", ariaHidden: "true" });
        }
        const text = document.createElement("div");
        text.className = "co-ci-dd-text";
        const nameEl = document.createElement("span");
        nameEl.className = "co-ci-dd-name";
        nameEl.textContent = item.name;
        const addrEl = document.createElement("span");
        addrEl.className = "co-ci-dd-addr";
        addrEl.textContent = short;
        text.append(nameEl, addrEl);
        row.append(thumb, text);
        row.addEventListener("mousedown", (e) => {
          e.preventDefault();
          this._applySelection(item, stripZeroWidth(this._input.value).trim());
        });
        this._dropdown.appendChild(row);
      }
    }
  }

  window.CollectionInput = CollectionInput;
})();
