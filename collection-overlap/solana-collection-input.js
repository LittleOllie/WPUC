/**
 * SolanaCollectionInput — same UI/UX as CollectionInput (yellow shell, banner, dropdown).
 * Resolves Magic Eden marketplace URLs / collection mint via Worker GET /api/search-collections-solana.
 */
(function () {
  const PLACEHOLDER = "Paste collection URL or contract address";
  const DEBOUNCE_MS = 300;
  const CUSTOM_CONTRACT_NAME = "Custom Contract";
  const MSG_NOT_FOUND = "Collection not found";
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
    const path = `/api/search-collections-solana?q=${encodeURIComponent(q)}`;
    return root ? `${root}${path}` : path;
  }

  function buildSolanaCollectionDisplayUrl(mint) {
    const root = apiBase();
    const path = `/api/solana-collection-display?mint=${encodeURIComponent(mint)}`;
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

  /** Solana collection mint (base58); rejects EVM 0x addresses. */
  function validateSolanaMint(s) {
    const t = String(s || "")
      .trim()
      .replace(/[!.,;\s]+$/g, "");
    if (!t) return null;
    const lower = t.toLowerCase();
    if (/^0x[a-f0-9]{40}$/.test(lower) || /^0x/.test(lower)) return null;
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(t)) return null;
    return t;
  }

  function stripZeroWidth(s) {
    return String(s || "").replace(/[\u200B-\u200D\uFEFF]/g, "");
  }

  /** Pull the first Magic Eden URL out of pasted text. */
  function extractMagicEdenHrefFromPaste(t) {
    let s = stripZeroWidth(t).trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1).trim();
    }
    const urlRe = /https?:\/\/[^\s<>"')\]}]+/gi;
    let m;
    while ((m = urlRe.exec(s)) !== null) {
      let piece = m[0].replace(/[),.;]+$/g, "");
      if (/magiceden\.io/i.test(piece)) return piece;
    }
    if (/magiceden\.io/i.test(s)) {
      let href = s.replace(/[),.;]+$/g, "");
      if (!/^https?:\/\//i.test(href)) href = `https://${href.replace(/^\/+/, "")}`;
      return href;
    }
    return null;
  }

  /** Marketplace slug from magiceden.io/marketplace/{slug} or /collections/{slug}. */
  function magicEdenSlugFromHref(hrefStr) {
    let u;
    try {
      let h = String(hrefStr || "").trim();
      if (!/^https?:\/\//i.test(h)) h = `https://${h.replace(/^\/+/, "")}`;
      u = new URL(h);
    } catch {
      return null;
    }
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (!host.endsWith("magiceden.io")) return null;
    const m = u.pathname.match(/\/(?:marketplace|collections)\/([^/?#]+)/i);
    if (!m) return null;
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }

  /** Plain collection symbol / slug — searchable without full URL (same shape as EVM slug rules). */
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

    const meHref = extractMagicEdenHrefFromPaste(trimmed);
    if (meHref) {
      const slug = magicEdenSlugFromHref(meHref);
      if (slug) return { kind: "me-slug", slug };
      return { kind: "bad-url" };
    }

    if (/^0x/i.test(trimmed)) {
      return { kind: "contract-invalid" };
    }

    const norm = trimmed.replace(/[!.,;\s]+$/g, "");
    const mintOk = validateSolanaMint(norm);
    if (mintOk) return { kind: "contract-valid", address: mintOk };
    if (/^[1-9A-HJ-NP-Za-km-z]+$/.test(norm) && norm.length >= 32 && norm.length <= 44) {
      return { kind: "contract-invalid" };
    }
    if (/^[1-9A-HJ-NP-Za-km-z]+$/.test(norm) && norm.length > 20 && norm.length < 32) {
      return { kind: "partial-contract" };
    }

    const slugCandidate = stripZeroWidth(trimmed).trim().toLowerCase();
    if (looksLikeCollectionSlugQuery(slugCandidate)) {
      return { kind: "slug-query", slug: slugCandidate };
    }

    return { kind: "unsupported" };
  }

  class SolanaCollectionInput {
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
        classified.kind === "slug-query" || classified.kind === "me-slug" ? classified.slug : null;
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
            <button type="button" class="co-ci-clear" aria-label="Clear">×</button>
          </div>
          <div class="co-ci-banner">
            <div class="co-ci-banner__mascot" aria-hidden="true"></div>
            <div class="co-ci-banner__ring" aria-hidden="true"></div>
            <p class="co-ci-banner__loading-note" aria-hidden="true">This may take a moment…</p>
            <img class="co-ci-banner__logo" alt="" width="96" height="96" hidden decoding="async" />
          </div>
        </div>
        <div class="co-ci-dropdown" role="listbox" hidden></div>
        <p class="co-ci-error" role="status" aria-live="polite" hidden></p>
      `;
      this._container.appendChild(root);
      this._root = root;
      this._shellEl = root.querySelector(".co-ci-shell");
      this._bannerEl = root.querySelector(".co-ci-banner");
      this._bannerLogoEl = root.querySelector(".co-ci-banner__logo");
      this._bannerLoadingNoteEl = root.querySelector(".co-ci-banner__loading-note");
      this._input = root.querySelector(".co-ci-input");
      this._clearBtn = root.querySelector(".co-ci-clear");
      this._dropdown = root.querySelector(".co-ci-dropdown");
      this._errEl = root.querySelector(".co-ci-error");

      this._input.addEventListener("input", () => this._onInput());
      this._input.addEventListener("keydown", (e) => this._onKeydown(e));
      this._clearBtn.addEventListener("click", () => this._clearSelection());
    }

    _setAriaExpanded(open) {
      this._input.setAttribute("aria-expanded", open ? "true" : "false");
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
      const note = this._bannerLoadingNoteEl;
      if (note) {
        const show = Boolean(on);
        note.hidden = !show;
        note.setAttribute("aria-hidden", show ? "false" : "true");
      }
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

    _showInlineError(msg) {
      this._inlineError = msg;
      this._errEl.textContent = msg || "";
      this._errEl.hidden = !msg;
    }

    _clearInlineError() {
      this._inlineError = "";
      this._errEl.textContent = "";
      this._errEl.hidden = true;
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
      this._container.textContent = "";
    }

    _onDocumentPointerDown(e) {
      if (!this._root.contains(e.target)) this._closeDropdown();
    }

    _closeDropdown() {
      this._dropdown.hidden = true;
      this._setAriaExpanded(false);
    }

    _showNoResults() {
      this._closeDropdown();
    }

    _showDropdownError(msg) {
      this._dropdown.hidden = false;
      this._setAriaExpanded(true);
      const el = document.createElement("div");
      el.className = "co-ci-dd-msg co-ci-dd-err";
      el.textContent = msg;
      this._dropdown.replaceChildren(el);
    }

    shortenMint(mint) {
      const a = String(mint || "").trim();
      if (!a) return "";
      if (a.length <= 12) return a;
      return `${a.slice(0, 4)}...${a.slice(-4)}`;
    }

    /**
     * @param {{ name: string, contractAddress: string, image: string|null }} item
     * @param {string} [displayText] text to keep visible in the field (URL or 0x…)
     */
    _applySelection(item, displayText) {
      const addr = String(item.contractAddress).trim();
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
      void this._hydrateContractMetadataIfNeeded();
    }

    /**
     * Fill name/logo from Worker (Alchemy) when paste-by-address or search returned no image.
     */
    async _hydrateContractMetadataIfNeeded() {
      const sel = this.state.selectedCollection;
      if (!sel?.contractAddress) return;
      const needsLogo = !sel.image || !String(sel.image).trim();
      const needsName = !sel.name || sel.name === CUSTOM_CONTRACT_NAME;
      if (!needsLogo && !needsName) return;

      const addrSnap = sel.contractAddress;
      const ac = new AbortController();
      this._abortHydrate();
      this._hydrateAbort = ac;
      this._setBannerLoading(true);
      const url = buildSolanaCollectionDisplayUrl(addrSnap);
      try {
        const res = await fetch(url, { method: "GET", signal: ac.signal, mode: "cors" });
        const data = await res.json().catch(() => ({}));
        if (ac.signal.aborted) return;
        if (this.state.selectedCollection?.contractAddress !== addrSnap) return;
        if (!res.ok || !data?.success) {
          const apiErr = typeof data?.error === "string" && data.error.trim() ? data.error.trim() : "";
          if (apiErr) {
            this._showInlineError(apiErr);
          } else if (!res.ok) {
            this._showInlineError(`Collection details failed (${res.status}). Check the Worker is running with Helius configured.`);
          }
          return;
        }
        const n = data.name && String(data.name).trim();
        if (n && (needsName || this.state.selectedCollection.name === CUSTOM_CONTRACT_NAME)) {
          this.state.selectedCollection.name = n;
        }
        const img = data.image && String(data.image).trim();
        if (img && needsLogo) this.state.selectedCollection.image = img;
        this._syncVerifiedShell();
      } catch (e) {
        if (e?.name === "AbortError") return;
      } finally {
        if (this._hydrateAbort === ac) {
          this._hydrateAbort = null;
          this._setBannerLoading(false);
          this._syncBanner();
        }
      }
    }

    _applyCustomContract(address, displayText) {
      this._applySelection(
        {
          name: CUSTOM_CONTRACT_NAME,
          contractAddress: String(address).trim(),
          image: null,
        },
        displayText != null && String(displayText).trim() ? String(displayText).trim() : address
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

      const trimmed = stripZeroWidth(this._input.value).trim();
      if (!trimmed) {
        this._showInlineError(MSG_ENTER_NEED_SELECTION);
        e.preventDefault();
        return;
      }

      const ok = validateSolanaMint(trimmed);
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

      if (classified.kind === "me-slug" || classified.kind === "slug-query") {
        e.preventDefault();
        void this._resolveSlug(classified.slug);
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
        this._showInlineError("Could not read that Magic Eden link.");
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
        this._closeDropdown();
        return;
      }

      if (classified.kind === "me-slug" || classified.kind === "slug-query") {
        const slug = classified.slug;
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
      try {
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
        const hint = typeof data.hint === "string" && data.hint.trim() ? data.hint.trim() : "";
        if (myGen !== this._slugResolveGen) return;
        if (list.length > 0) slugCacheSet(query, list);
        this._finishSlugResults(list, displaySnapshot, myGen, hint);
      } catch (e) {
        if (e?.name === "AbortError") return;
        if (ac.signal.aborted) return;
        if (myGen !== this._slugResolveGen) return;
        if (isLikelyNetworkFailure(e)) {
          this._showDropdownError(
            "Cannot reach the API. Start the Worker: cd collection-overlap-api && npm run dev"
          );
          return;
        }
        this._showDropdownError(MSG_SEARCH_FAILED);
      } finally {
        if (myGen === this._slugResolveGen) this._setBannerLoading(false);
      }
    }

    /**
     * @param {Array<{ name: string, contractAddress: string, image: string|null }>} list
     * @param {string} displaySnapshot
     * @param {number} [requestGen] drop stale responses when the user changed input
     * @param {string} [hint] optional server hint when results are empty (Helius / ME resolution)
     */
    _finishSlugResults(list, displaySnapshot, requestGen, hint) {
      if (requestGen != null && requestGen !== this._slugResolveGen) return;
      this.state.results = list.slice(0, 10);
      if (this.state.results.length === 0) {
        this._showInlineError(hint || MSG_NOT_FOUND);
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
      this._setAriaExpanded(true);
      for (const item of results) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "co-ci-dd-item";
        row.setAttribute("role", "option");
        const short = this.shortenMint(item.contractAddress);
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

  window.SolanaCollectionInput = SolanaCollectionInput;
})();
