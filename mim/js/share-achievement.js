/**
 * Share Achievement modal component.
 * Modal is closed by default; only opens when explicitly triggered.
 * No localStorage/sessionStorage — state is in-memory only.
 */
import { showToast } from "./utils.js";

const FILENAME = "mim-achievement.png";
const CARD_SIZE = 1080;

/** Modal open state — always false on page load */
let isShareModalOpen = false;

function formatShareDate() {
  const d = new Date();
  const options = { month: "short", day: "numeric", year: "numeric" };
  return d.toLocaleDateString("en-US", options);
}

/**
 * Populate share card with user data.
 * @param {Object} data
 * @param {string} [data.displayName]
 * @param {string} [data.name]
 * @param {string} [data.email]
 * @param {string|null} [data.photoURL]
 * @param {number} [data.completedCount]
 * @param {number} [data.totalCount]
 * @param {number} [data.currentStreak]
 */
function populateShareCard(data) {
  const name = data?.displayName || data?.name || data?.email || "Someone";
  const photoURL = data?.photoURL || null;
  const completed = Number(data?.completedCount) ?? 0;
  const total = Number(data?.totalCount) ?? 0;
  const streak = Number(data?.currentStreak) ?? 0;
  const allDone = total > 0 && completed === total;

  const avatarEl = document.getElementById("shareCardAvatar");
  const nameEl = document.getElementById("shareCardName");
  const iconEl = document.getElementById("shareCardIcon");
  const badgeEl = document.getElementById("shareCardBadge");
  const headlineEl = document.getElementById("shareCardHeadline");
  const progressEl = document.getElementById("shareCardProgress");
  const dateEl = document.getElementById("shareCardDate");
  const streakEl = document.getElementById("shareCardStreak");

  // Avatar — 192x192 (2x) for share card
  if (avatarEl) {
    avatarEl.textContent = "";
    avatarEl.className = "avatar share-card-avatar";
    avatarEl.style.width = "192px";
    avatarEl.style.height = "192px";
    avatarEl.style.fontSize = "96px";
    const initial = (name || "?").trim().charAt(0).toUpperCase();
    if (photoURL) {
      const img = document.createElement("img");
      img.crossOrigin = "anonymous";
      img.alt = name;
      img.className = "avatar-img share-card-avatar-img";
      img.onerror = () => {
        avatarEl.textContent = initial;
      };
      img.onload = () => {
        avatarEl.classList.add("avatar--img");
      };
      img.src = photoURL;
      avatarEl.appendChild(img);
      if (img.complete) avatarEl.classList.add("avatar--img");
    } else {
      avatarEl.textContent = initial;
    }
  }

  if (nameEl) nameEl.textContent = name;
  if (iconEl) iconEl.textContent = allDone ? "🔥" : "📋";
  if (badgeEl) badgeEl.textContent = allDone ? "DAILY WIN" : "TODAY'S PROGRESS";
  if (headlineEl) headlineEl.textContent = allDone ? "All Habits Complete" : "Habits In Progress";
  if (progressEl) {
    progressEl.textContent = total > 0
      ? allDone
        ? `${completed} / ${total} Habits Finished`
        : `${completed} / ${total} Habits Finished`
      : "";
    progressEl.hidden = total === 0;
  }
  if (dateEl) dateEl.textContent = formatShareDate();
  if (streakEl) {
    streakEl.textContent = streak > 0 ? `🔥 ${streak} Day Streak` : "";
    streakEl.hidden = streak === 0;
  }
}

/**
 * Wait for all images and fonts in the share card to be ready.
 */
async function waitForShareCardReady() {
  const card = document.getElementById("shareCard");
  if (!card) return;

  const imgPromises = Array.from(card.querySelectorAll("img")).map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  });

  const fontsReady = document.fonts?.ready
    ? document.fonts.ready
    : Promise.resolve();

  await Promise.all([...imgPromises, fontsReady]);
  await new Promise((r) => setTimeout(r, 50));
}

/**
 * Generate JPG from share card using html2canvas.
 * Clones the card and renders off-screen at full 1080x1080 so the export is square
 * and not affected by the modal's scaled preview.
 * @returns {Promise<string>} Data URL (image/jpeg)
 */
async function generateShareImageDataUrl() {
  const card = document.getElementById("shareCard");
  if (!card) throw new Error("Share card not found");

  const html2canvas = window.html2canvas;
  if (!html2canvas) throw new Error("html2canvas not loaded");

  await waitForShareCardReady();

  // Clone card and render off-screen at full 1080x1080 (avoids parent transform/overflow)
  const clone = card.cloneNode(true);
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "position:fixed;left:-9999px;top:0;width:1080px;height:1080px;z-index:-1;pointer-events:none;";
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);
  await new Promise((r) => setTimeout(r, 100)); // Allow clone to layout

  try {
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false,
      width: CARD_SIZE,
      height: CARD_SIZE,
    });
    // Scale 2 gives higher-res capture; draw to 1080x1080 for output
    const out = document.createElement("canvas");
    out.width = CARD_SIZE;
    out.height = CARD_SIZE;
    const ctx = out.getContext("2d");
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, CARD_SIZE, CARD_SIZE);
    return out.toDataURL("image/png");
  } finally {
    document.body.removeChild(wrapper);
  }
}

function downloadImage(dataUrl) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = FILENAME;
  a.click();
}

async function copyImageToClipboard(dataUrl) {
  if (!navigator.clipboard?.write) return false;
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const type = blob.type || "image/png";
    await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

function lockBodyScroll() {
  document.body.style.overflow = "hidden";
  document.body.style.touchAction = "none";
}

function unlockBodyScroll() {
  document.body.style.overflow = "";
  document.body.style.touchAction = "";
}

function closeShareModal() {
  const modal = document.getElementById("shareModal");
  if (modal) {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }
  isShareModalOpen = false;
  unlockBodyScroll();
  window.removeEventListener("keydown", handleEscape);
}

function handleEscape(e) {
  if (e.key === "Escape") closeShareModal();
}

let listenersInitialized = false;

function initModalListeners() {
  if (listenersInitialized) return;
  listenersInitialized = true;

  const modal = document.getElementById("shareModal");
  const backdrop = document.getElementById("shareModalBackdrop");
  const saveBtn = document.getElementById("shareModalSaveBtn");
  const copyBtn = document.getElementById("shareModalCopyBtn");
  const closeBtn = document.getElementById("shareModalCloseBtn");

  backdrop?.addEventListener("click", closeShareModal);
  closeBtn?.addEventListener("click", closeShareModal);

  saveBtn?.addEventListener("click", async () => {
    if (saveBtn.disabled) return;
    try {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
      const dataUrl = await generateShareImageDataUrl();
      downloadImage(dataUrl);
      showToast("Image saved to device");
      saveBtn.textContent = "Save Image";
    } catch (err) {
      console.error("[Share] Save error:", err);
      showToast("Could not save image");
      saveBtn.textContent = "Save Image";
    } finally {
      saveBtn.disabled = false;
    }
  });

  copyBtn?.addEventListener("click", async () => {
    if (copyBtn.disabled) return;
    try {
      copyBtn.disabled = true;
      copyBtn.textContent = "Copying...";
      const dataUrl = await generateShareImageDataUrl();
      const copied = await copyImageToClipboard(dataUrl);
      if (copied) {
        showToast("Image copied to clipboard");
      } else {
        downloadImage(dataUrl);
        showToast("Image saved to device");
      }
      copyBtn.textContent = "Copy Image";
    } catch (err) {
      console.error("[Share] Copy error:", err);
      try {
        const dataUrl = await generateShareImageDataUrl();
        downloadImage(dataUrl);
        showToast("Image saved to device");
      } catch {
        showToast("Could not copy image");
      }
      copyBtn.textContent = "Copy Image";
    } finally {
      copyBtn.disabled = false;
    }
  });
}

/**
 * Ensure modal is closed on page load. Call on script load.
 */
function ensureModalClosedOnLoad() {
  const modal = document.getElementById("shareModal");
  if (modal) {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    isShareModalOpen = false;
  }
}

/**
 * Open share achievement modal.
 * @param {Object} data - Profile + completion data
 * @param {string} [data.displayName]
 * @param {string} [data.name]
 * @param {string} [data.email]
 * @param {string|null} [data.photoURL]
 * @param {number} [data.completedCount]
 * @param {number} [data.totalCount]
 */
export function openShareModal(data = {}) {
  initModalListeners();

  const modal = document.getElementById("shareModal");
  if (!modal) return;

  populateShareCard(data);

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  isShareModalOpen = true;
  lockBodyScroll();
  window.addEventListener("keydown", handleEscape);
}

/**
 * Close share modal. Exported for external use.
 */
export function closeShareModalExported() {
  closeShareModal();
}

/**
 * @deprecated Use openShareModal. Kept for backwards compatibility.
 */
export async function shareAchievement(profile = {}, options = {}) {
  const data = {
    ...profile,
    completedCount: options.completedCount ?? profile.completedCount,
    totalCount: options.totalCount ?? profile.totalCount,
  };
  openShareModal(data);
}

// Ensure modal starts closed on load
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureModalClosedOnLoad);
  } else {
    ensureModalClosedOnLoad();
  }
}
