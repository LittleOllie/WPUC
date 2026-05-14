import { fetchDdgNftsForOwner, mergeDdgNftLists } from "./walletLoader.js";

function hideBoot() {
  const el = document.getElementById("bootLoading");
  if (!el?.isConnected) return;
  el.setAttribute("aria-busy", "false");
  el.classList.add("bootLoading--done");
  window.setTimeout(() => el.remove(), 420);
}

function setHidden(el, hidden) {
  if (!el?.classList) return;
  el.classList.toggle("hidden", !!hidden);
  el.setAttribute("aria-hidden", hidden ? "true" : "false");
  if (el.id === "entryOverlay" || el.id === "card") {
    queueMicrotask(() => {
      document.dispatchEvent(new CustomEvent("ddg-gorgez-nav-changed"));
    });
  }
}

function collapseWalletPanel(panel, entryWalletBtn, entryWalletStatus) {
  if (!panel) return;
  panel.classList.remove("entryWalletPanel--open");
  panel.setAttribute("aria-hidden", "true");
  entryWalletBtn?.setAttribute("aria-expanded", "false");
  entryWalletBtn?.classList.remove("entryChoiceBtn--openWallet");
  if (entryWalletStatus) entryWalletStatus.textContent = "";
}

function expandWalletPanel(panel, entryWalletBtn) {
  if (!panel) return;
  panel.classList.add("entryWalletPanel--open");
  panel.setAttribute("aria-hidden", "false");
  entryWalletBtn?.setAttribute("aria-expanded", "true");
  entryWalletBtn?.classList.add("entryChoiceBtn--openWallet");
  window.requestAnimationFrame(() => {
    try {
      panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (_) {
      /* ignore */
    }
  });
}

function isWalletPanelOpen(panel) {
  return !!panel?.classList?.contains("entryWalletPanel--open");
}

function syncRemoveButtons(rowsEl) {
  const n = rowsEl?.children?.length ?? 0;
  if (!rowsEl) return;
  for (const row of rowsEl.children) {
    const btn = row.querySelector(".entryWalletRowRemove");
    if (!btn) continue;
    const show = n > 1;
    btn.classList.toggle("entryWalletRowRemove--hidden", !show);
    btn.disabled = !show;
  }
}

function makeWalletRow(rowsEl) {
  const wrap = document.createElement("div");
  wrap.className = "entryWalletRow";
  wrap.innerHTML = `
    <div class="entryWalletRowTop">
      <label class="walletFieldLabel entryWalletRowLabel">Wallet address</label>
      <button type="button" class="entryWalletRowRemove" aria-label="Remove this wallet row">×</button>
    </div>
    <input
      class="input walletInput entryWalletRowInput"
      type="text"
      inputmode="text"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      placeholder="0x…"
    />
  `;
  const removeBtn = wrap.querySelector(".entryWalletRowRemove");
  removeBtn?.addEventListener("click", () => {
    if (rowsEl.children.length <= 1) return;
    wrap.remove();
    syncRemoveButtons(rowsEl);
  });
  return wrap;
}

function getRowInputs(rowsEl) {
  return rowsEl ? Array.from(rowsEl.querySelectorAll(".entryWalletRowInput")) : [];
}

function resetWalletRows(rowsEl) {
  if (!rowsEl) return;
  rowsEl.innerHTML = "";
  rowsEl.appendChild(makeWalletRow(rowsEl));
  syncRemoveButtons(rowsEl);
}

/**
 * @param {{
 *   startClassic: () => void | Promise<void>;
 *   onWalletPoolLoaded?: (nfts: { tokenId: string; thumb: string; full: string; name: string }[]) => void | Promise<void>;
 * }} opts
 */
export function mountEntry({ startClassic, onWalletPoolLoaded }) {
  hideBoot();

  const entry = document.getElementById("entryOverlay");
  const card = document.getElementById("card");
  const entryUploadBtn = document.getElementById("entryUploadBtn");
  const entryWalletBtn = document.getElementById("entryWalletBtn");
  const entryWalletPanel = document.getElementById("entryWalletPanel");
  const entryWalletRows = document.getElementById("entryWalletRows");
  const entryWalletAddBtn = document.getElementById("entryWalletAddBtn");
  const entryWalletLoadBtn = document.getElementById("entryWalletLoadBtn");
  const entryWalletStatus = document.getElementById("entryWalletStatus");

  resetWalletRows(entryWalletRows);

  entryUploadBtn?.addEventListener("click", () => {
    collapseWalletPanel(entryWalletPanel, entryWalletBtn, entryWalletStatus);
    setHidden(entry, true);
    setHidden(card, false);
  });

  entryWalletBtn?.addEventListener("click", () => {
    if (!entryWalletPanel) return;
    if (isWalletPanelOpen(entryWalletPanel)) {
      collapseWalletPanel(entryWalletPanel, entryWalletBtn, entryWalletStatus);
    } else {
      expandWalletPanel(entryWalletPanel, entryWalletBtn);
      const inputs = getRowInputs(entryWalletRows);
      (inputs[0] || inputs[inputs.length - 1])?.focus?.();
    }
  });

  entryWalletAddBtn?.addEventListener("click", () => {
    if (!entryWalletRows) return;
    entryWalletRows.appendChild(makeWalletRow(entryWalletRows));
    syncRemoveButtons(entryWalletRows);
    const inputs = getRowInputs(entryWalletRows);
    inputs[inputs.length - 1]?.focus?.();
  });

  entryWalletLoadBtn?.addEventListener("click", async () => {
    if (!entryWalletStatus || !entryWalletLoadBtn) return;
    entryWalletStatus.textContent = "";
    const inputs = getRowInputs(entryWalletRows);
    const raw = inputs.map((el) => String(el.value || "").trim()).filter(Boolean);

    if (!raw.length) {
      entryWalletStatus.textContent = "Add at least one wallet address.";
      return;
    }

    const invalid = raw.filter((a) => !/^0x[a-fA-F0-9]{40}$/.test(a));
    if (invalid.length) {
      entryWalletStatus.textContent = "Each filled row needs a valid 0x address (42 characters).";
      return;
    }

    const seenAddr = new Set();
    const uniqueOrdered = [];
    for (const a of raw) {
      const k = a.toLowerCase();
      if (seenAddr.has(k)) continue;
      seenAddr.add(k);
      uniqueOrdered.push(a);
    }

    entryWalletStatus.textContent = "Loading your DDGs…";
    entryWalletLoadBtn.disabled = true;

    try {
      const results = await Promise.allSettled(uniqueOrdered.map((addr) => fetchDdgNftsForOwner(addr)));
      const lists = [];
      const failures = [];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const addr = uniqueOrdered[i];
        if (r.status === "fulfilled") lists.push(r.value);
        else {
          const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
          failures.push(`${addr.slice(0, 6)}…${addr.slice(-4)}: ${msg}`);
        }
      }

      const merged = mergeDdgNftLists(lists);

      if (!merged.length) {
        if (failures.length) {
          entryWalletStatus.textContent = failures[0] || "Could not load wallets.";
        } else {
          entryWalletStatus.textContent = "No Drop Dead Gorgez NFTs found for these wallets.";
        }
        return;
      }

      if (failures.length) {
        console.warn("[ddg-gorgez] Some wallets failed to load:", failures);
      }

      collapseWalletPanel(entryWalletPanel, entryWalletBtn, entryWalletStatus);
      setHidden(entry, true);
      setHidden(card, false);
      await onWalletPoolLoaded?.(merged);
      resetWalletRows(entryWalletRows);
    } catch (e) {
      entryWalletStatus.textContent = e instanceof Error ? e.message : "Could not load wallets.";
    } finally {
      entryWalletLoadBtn.disabled = false;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (entry?.classList.contains("hidden")) return;
    if (isWalletPanelOpen(entryWalletPanel)) {
      e.preventDefault();
      collapseWalletPanel(entryWalletPanel, entryWalletBtn, entryWalletStatus);
    }
  });

  document.addEventListener("ddg-gorgez-back-to-entry", (e) => {
    if (!entry || !card) return;
    setHidden(card, true);
    setHidden(entry, false);
    const expand = !!(e.detail && e.detail.expandWalletPanel);
    if (expand && entryWalletPanel && entryWalletBtn) {
      expandWalletPanel(entryWalletPanel, entryWalletBtn);
    } else {
      collapseWalletPanel(entryWalletPanel, entryWalletBtn, entryWalletStatus);
    }
    const inputs = getRowInputs(entryWalletRows);
    inputs[0]?.focus?.();
  });

  queueMicrotask(() => {
    document.dispatchEvent(new CustomEvent("ddg-gorgez-nav-changed"));
  });

  void Promise.resolve(startClassic()).catch(() => {});
}