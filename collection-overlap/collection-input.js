/**
 * CollectionInput — OpenSea collection URL or contract address (0x...) only.
 * Resolves URLs via GET /api/search-collections?q={slug} (Worker).
 */
(function () {
  const PLACEHOLDER = "OpenSea collection URL or contract address (0x...)";
  const DEBOUNCE_MS = 300;
  const CUSTOM_CONTRACT_NAME = "Custom Contract";
  const MSG_NOT_FOUND = "Collection not found";
  const MSG_SEARCH_FAILED = "Search failed, try again";
  const MSG_INVALID_CONTRACT = "Invalid contract address";
  const MSG_ENTER_NEED_SELECTION = "Please select a valid collection";
  const MSG_UNSUPPORTED = "Paste an OpenSea collection URL or a contract address (0x…).";

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

  function apiBase() {
    const b = typeof window.COLLECTION_OVERLAP_API_BASE === "string" ? window.COLLECTION_OVERLAP_API_BASE.trim() : "";
    return b.replace(/\/+$/, "");
  }

  function buildSearchUrl(q) {
    const root = apiBase();
    const path = `/api/search-collections?q=${encodeURIComponent(q)}`;
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

  /** @param {string} raw */
  function openSeaCollectionSlug(raw) {
    const s = String(raw || "").trim();
    if (!/opensea\.io/i.test(s)) return null;
    let href = s;
    if (!/^https?:\/\//i.test(href)) href = `https://${href.replace(/^\/+/, "")}`;
    let u;
    try {
      u = new URL(href);
    } catch {
      return null;
    }
    const parts = u.pathname.split("/").filter(Boolean);
    const low = parts.map((p) => p.toLowerCase());
    const i = low.indexOf("collection");
    if (i >= 0 && parts[i + 1]) {
      try {
        return decodeURIComponent(parts[i + 1]);
      } catch {
        return parts[i + 1];
      }
    }
    if (parts.length) {
      try {
        return decodeURIComponent(parts[parts.length - 1]);
      } catch {
        return parts[parts.length - 1];
      }
    }
    return null;
  }

  /**
   * @param {string} trimmed
   * @returns {{ kind: string, address?: string, slug?: string }}
   */
  function classifyTrimmedInput(trimmed) {
    if (!trimmed) return { kind: "idle" };

    if (/opensea\.io/i.test(trimmed)) {
      const slug = openSeaCollectionSlug(trimmed);
      if (!slug) return { kind: "bad-url" };
      return { kind: "opensea-slug", slug };
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

    return { kind: "unsupported" };
  }

  class CollectionInput {
    constructor(container) {
      this._container = container;
      this.state = {
        inputValue: "",
        selectedCollection: null,
        results: [],
      };
      this._debounceTimer = null;
      this._searchAbort = null;
      this._inlineError = "";
      this._onDocDown = this._onDocumentPointerDown.bind(this);
      this._render();
      document.addEventListener("pointerdown", this._onDocDown, true);
    }

    _syncInputValue() {
      this.state.inputValue = this.state.selectedCollection ? "" : this._input.value;
    }

    _render() {
      const root = document.createElement("div");
      root.className = "co-ci";
      root.innerHTML = `
        <div class="co-ci-shell">
          <div class="co-ci-row co-ci-row--input">
            <input type="text" class="co-ci-input co-input" autocomplete="off" spellcheck="false"
              placeholder="${PLACEHOLDER}" aria-autocomplete="list" aria-expanded="false" />
          </div>
          <div class="co-ci-row co-ci-row--selected" hidden>
            <img class="co-ci-thumb" alt="" width="32" height="32" decoding="async" hidden />
            <span class="co-ci-name"></span>
            <button type="button" class="co-ci-clear" aria-label="Clear selection">×</button>
          </div>
        </div>
        <div class="co-ci-dropdown" role="listbox" hidden></div>
        <p class="co-ci-error" role="status" aria-live="polite" hidden></p>
      `;
      this._container.appendChild(root);
      this._root = root;
      this._input = root.querySelector(".co-ci-input");
      this._rowInput = root.querySelector(".co-ci-row--input");
      this._rowSelected = root.querySelector(".co-ci-row--selected");
      this._thumb = root.querySelector(".co-ci-thumb");
      this._nameEl = root.querySelector(".co-ci-name");
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
      const trimmed = this._input.value.trim();
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

    destroy() {
      document.removeEventListener("pointerdown", this._onDocDown, true);
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      if (this._searchAbort) this._searchAbort.abort();
      this._container.textContent = "";
    }

    _onDocumentPointerDown(e) {
      if (!this._root.contains(e.target)) this._closeDropdown();
    }

    _closeDropdown() {
      this._dropdown.hidden = true;
      this._setAriaExpanded(false);
    }

    _showResolving() {
      this._dropdown.hidden = false;
      this._setAriaExpanded(true);
      this._dropdown.innerHTML = `<div class="co-ci-dd-msg co-ci-dd-loading">Resolving collection…</div>`;
    }

    _showNoResults() {
      this._dropdown.hidden = false;
      this._setAriaExpanded(true);
      this._dropdown.innerHTML = `<div class="co-ci-dd-msg">${MSG_NOT_FOUND}</div>`;
    }

    _showDropdownError(msg) {
      this._dropdown.hidden = false;
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

    _applySelection(item) {
      this.state.selectedCollection = {
        name: item.name,
        contractAddress: String(item.contractAddress).trim().toLowerCase(),
        image: item.image || null,
      };
      this.state.results = [];
      this._clearInlineError();
      this._input.value = "";
      this.state.inputValue = "";
      this._rowInput.hidden = true;
      this._rowSelected.hidden = false;
      this._nameEl.textContent = this.state.selectedCollection.name;
      if (this.state.selectedCollection.image) {
        this._thumb.src = this.state.selectedCollection.image;
        this._thumb.hidden = false;
        this._thumb.alt = this.state.selectedCollection.name;
        this._thumb.onerror = () => {
          this._thumb.hidden = true;
          this._thumb.removeAttribute("src");
        };
      } else {
        this._thumb.removeAttribute("src");
        this._thumb.hidden = true;
        this._thumb.alt = "";
      }
      this._closeDropdown();
      if (this._searchAbort) this._searchAbort.abort();
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
    }

    _applyCustomContract(address) {
      this._applySelection({
        name: CUSTOM_CONTRACT_NAME,
        contractAddress: address,
        image: null,
      });
    }

    _clearSelection() {
      this.state.selectedCollection = null;
      this.state.results = [];
      this._clearInlineError();
      this._rowInput.hidden = false;
      this._rowSelected.hidden = true;
      this._thumb.removeAttribute("src");
      this._thumb.hidden = true;
      this._closeDropdown();
      this._input.focus();
      this._syncInputValue();
    }

    _onKeydown(e) {
      if (e.key === "Escape") {
        this._closeDropdown();
        return;
      }
      if (e.key !== "Enter") return;
      if (this.state.selectedCollection) return;

      const trimmed = this._input.value.trim();
      if (!trimmed) {
        this._showInlineError(MSG_ENTER_NEED_SELECTION);
        e.preventDefault();
        return;
      }

      const ok = validateContract42(trimmed);
      if (ok) {
        this._applyCustomContract(ok);
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

      this._showInlineError(MSG_ENTER_NEED_SELECTION);
      e.preventDefault();
    }

    _onInput() {
      if (this.state.selectedCollection) return;

      const raw = this._input.value;
      const trimmed = raw.trim();
      this._syncInputValue();
      this._clearInlineError();

      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      if (this._searchAbort) this._searchAbort.abort();

      if (!trimmed) {
        this.state.results = [];
        this._closeDropdown();
        return;
      }

      const classified = classifyTrimmedInput(trimmed);

      if (classified.kind === "contract-valid") {
        this._applyCustomContract(classified.address);
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
        this._closeDropdown();
        return;
      }

      if (classified.kind === "opensea-slug") {
        const slug = classified.slug;
        this._debounceTimer = setTimeout(() => void this._resolveSlug(slug), DEBOUNCE_MS);
      }
    }

    /** @param {string} slug */
    async _resolveSlug(slug) {
      if (this.state.selectedCollection) return;
      const query = String(slug || "").trim();
      if (!query) {
        this._closeDropdown();
        return;
      }

      const cached = slugCacheGet(query);
      if (cached) {
        this._finishSlugResults(cached);
        return;
      }

      this._showResolving();
      const ac = new AbortController();
      this._searchAbort = ac;

      const url = buildSearchUrl(query);
      try {
        const res = await fetch(url, { method: "GET", signal: ac.signal });
        const data = await res.json().catch(() => ({}));
        if (ac.signal.aborted) return;
        if (!res.ok) {
          this._showDropdownError(MSG_SEARCH_FAILED);
          return;
        }
        if (!data?.success || !Array.isArray(data.results)) {
          this._showDropdownError(MSG_SEARCH_FAILED);
          return;
        }
        const list = data.results.slice(0, 10);
        slugCacheSet(query, list);
        this._finishSlugResults(list);
      } catch (e) {
        if (e?.name === "AbortError") return;
        if (ac.signal.aborted) return;
        if (isLikelyNetworkFailure(e)) {
          this._showDropdownError(
            "Cannot reach the API. Start the Worker: cd collection-overlap-api && npm run dev"
          );
          return;
        }
        this._showDropdownError(MSG_SEARCH_FAILED);
      }
    }

    /**
     * @param {Array<{ name: string, contractAddress: string, image: string|null }>} list
     */
    _finishSlugResults(list) {
      this.state.results = list.slice(0, 10);
      if (this.state.results.length === 0) {
        this._showInlineError(MSG_NOT_FOUND);
        this._showNoResults();
        return;
      }
      if (this.state.results.length === 1) {
        this._applySelection(this.state.results[0]);
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
          this._applySelection(item);
        });
        this._dropdown.appendChild(row);
      }
    }
  }

  window.CollectionInput = CollectionInput;
})();
