/**
 * Local saved collections (EVM + Solana) — localStorage only.
 * Key: lo_saved_collections
 */
(function () {
  const STORAGE_KEY = "lo_saved_collections";
  const MAX_ITEMS = 10;

  function coNormalizeEvmAddress(addr) {
    return String(addr || "")
      .trim()
      .replace(/[\u200B-\u200D\uFEFF\r\n]+/g, "")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  function coNormalizeSolanaMint(mint) {
    return String(mint || "")
      .trim()
      .replace(/[\u200B-\u200D\uFEFF\r\n]+/g, "")
      .replace(/\s+/g, "");
  }

  function normalizeEntry(e) {
    const chain = e.chain === "solana" ? "solana" : "evm";
    const contractAddress =
      chain === "solana" ? coNormalizeSolanaMint(e.contractAddress) : coNormalizeEvmAddress(e.contractAddress);
    const name = typeof e.name === "string" && e.name.trim() ? e.name.trim() : "";
    const image = typeof e.image === "string" && e.image.trim() ? e.image.trim() : null;
    const lastUsed = typeof e.lastUsed === "number" && Number.isFinite(e.lastUsed) ? e.lastUsed : Date.now();
    return { name, contractAddress, image, lastUsed, chain };
  }

  function loadRaw() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function migrateChain(entry) {
    if (entry.chain === "solana" || entry.chain === "evm") return entry;
    const a = String(entry.contractAddress || "").trim();
    if (/^0x[a-fA-F0-9]{40}$/.test(a)) return { ...entry, chain: "evm" };
    return { ...entry, chain: "solana" };
  }

  function loadNormalized() {
    return loadRaw()
      .map(migrateChain)
      .map(normalizeEntry)
      .filter((e) => e.contractAddress && (e.chain === "evm" || e.chain === "solana"));
  }

  function save(list) {
    const sorted = list.slice().sort((a, b) => b.lastUsed - a.lastUsed);
    const trimmed = sorted.slice(0, MAX_ITEMS);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      /* quota / private mode */
    }
  }

  /**
   * @param {{ name: string, contractAddress: string, image: string|null, chain: 'evm'|'solana' }} entry
   */
  function upsert(entry) {
    const n = normalizeEntry({ ...entry, lastUsed: Date.now() });
    if (!n.contractAddress) return;
    const list = loadNormalized().filter((e) => !(e.chain === n.chain && e.contractAddress === n.contractAddress));
    list.push(n);
    save(list);
  }

  /** @param {'evm'|'solana'} chain */
  function listForChain(chain) {
    return loadNormalized()
      .filter((e) => e.chain === chain)
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, MAX_ITEMS);
  }

  /**
   * Filter saved rows by name or contract (local only, no network).
   * @param {'evm'|'solana'} chain
   * @param {string} needle
   * @param {{ addressPrefixOnly?: boolean }} [opts]
   */
  function filterForChain(chain, needle, opts) {
    const rows = listForChain(chain);
    const raw = String(needle || "").trim();
    if (!raw) return rows;
    if (chain === "evm") {
      const n = raw.toLowerCase();
      if (opts && opts.addressPrefixOnly) {
        return rows.filter((r) => String(r.contractAddress || "").toLowerCase().startsWith(n));
      }
      return rows.filter((r) => {
        const name = String(r.name || "").toLowerCase();
        const addr = String(r.contractAddress || "").toLowerCase();
        return name.includes(n) || addr.includes(n);
      });
    }
    const n = raw.toLowerCase();
    return rows.filter((r) => {
      const name = String(r.name || "").toLowerCase();
      const addr = String(r.contractAddress || "").toLowerCase();
      return name.includes(n) || addr.includes(n);
    });
  }

  window.LOSavedCollections = {
    STORAGE_KEY,
    MAX_ITEMS,
    upsert,
    listForChain,
    filterForChain,
    coNormalizeEvmAddress,
    coNormalizeSolanaMint,
  };
})();
