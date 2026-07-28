/** Step 1 — chain chip picker (Ethereum, Base, etc.) */

const CHAIN_LABELS = {
  eth: "Ethereum",
  base: "Base",
  apechain: "ApeChain",
  polygon: "Polygon",
  solana: "Solana (Beta)",
  custom: "Custom grid",
};

let selectedChain = "";
let chainNextBtn = null;
let chainSelectEl = null;
let onChainChange = null;
let onGoToWalletStep = null;
let onGoToChainStep = null;

function $(id) {
  return document.getElementById(id);
}

function updateChainChipUi() {
  document.querySelectorAll(".flexgrid-chain-btn[data-chain]").forEach((btn) => {
    const on = btn.dataset.chain === selectedChain;
    btn.classList.toggle("isSelected", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  if (chainNextBtn) chainNextBtn.disabled = !selectedChain;

  const nameEl = $("walletFlowSelectedChainName");
  if (nameEl) {
    nameEl.textContent = selectedChain ? CHAIN_LABELS[selectedChain] || selectedChain : "Not selected";
  }
}

export function getSelectedChain() {
  return selectedChain;
}

/** Restore chip UI without triggering change callbacks (safe inside renderUI). */
export function syncChainStepUi(chain) {
  selectedChain = String(chain || "").trim().toLowerCase();
  updateChainChipUi();
}

export function selectChain(raw) {
  const chain = String(raw || "").trim().toLowerCase();
  if (!chain) return;
  selectedChain = chain;
  updateChainChipUi();
  onChainChange?.(chain);
}

function onChainChipPick(e) {
  const btn = e.target.closest(".flexgrid-chain-btn[data-chain]");
  if (!btn || btn.disabled) return;
  if (btn.classList.contains("flexgrid-chain-btn--disabled")) return;
  const raw = btn.getAttribute("data-chain");
  if (!raw) return;
  e.preventDefault();
  selectChain(raw);
}

export function initChainStep({ onSelected, onGoToWalletStep, onGoToChainStep }) {
  onChainChange = onSelected;
  onGoToWalletStep = onGoToWalletStep;
  onGoToChainStep = onGoToChainStep;

  chainNextBtn = $("chainNextBtn");
  chainSelectEl = $("chainSelect");
  const chainScreenEl = $("screen-chain");

  if (chainScreenEl) {
    chainScreenEl.addEventListener("click", onChainChipPick, true);
  }

  document.querySelectorAll(".flexgrid-chain-btn[data-chain]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      if (e.defaultPrevented) return;
      onChainChipPick(e);
    });
  });

  if (chainNextBtn) {
    chainNextBtn.addEventListener("click", () => {
      if (!selectedChain) return;
      onGoToWalletStep?.();
    });
  }

  const changeBtn = $("walletFlowChangeChainBtn");
  if (changeBtn) {
    changeBtn.addEventListener("click", () => {
      onGoToChainStep?.();
    });
  }

  // Inline HTML fallback: onclick="window.flexgridSelectChain('eth')"
  if (typeof window !== "undefined") {
    window.flexgridSelectChain = (chain) => selectChain(chain);
  }

  updateChainChipUi();
}

export function applyChainToHiddenSelect(chain) {
  if (!chainSelectEl) chainSelectEl = $("chainSelect");
  if (!chainSelectEl) return;
  if (
    chain !== "eth" &&
    chain !== "base" &&
    chain !== "apechain" &&
    chain !== "solana" &&
    chain !== "polygon"
  ) {
    return;
  }
  chainSelectEl.value = chain;
  try {
    chainSelectEl.dispatchEvent(new Event("change", { bubbles: true }));
  } catch {
    chainSelectEl.dispatchEvent(new Event("change"));
  }
}

export { CHAIN_LABELS };
