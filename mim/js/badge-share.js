/**
 * Badge share modal - uses unified share card generator.
 * 1080x1080 JPG export, same as Share Achievement.
 */
import { showToast } from "./utils.js";
import { populateBadgeCard, generateShareImage } from "./share-card.js";
import { closeShareModalExported } from "./share-achievement.js";

const FILENAME = "mim-badge.jpg";

/** Controlled state — always false on page load */
let badgeShareModalOpen = false;

function downloadImage(dataUrl) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = FILENAME;
  a.click();
}

async function copyImage(dataUrl) {
  if (!navigator.clipboard?.write) return false;
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const type = blob.type || "image/jpeg";
    await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

function closeBadgeShareModal() {
  const modal = document.getElementById("badgeShareModal");
  if (modal) {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  badgeShareModalOpen = false;
  window.removeEventListener("keydown", handleBadgeShareEscape);
}

function handleBadgeShareEscape(e) {
  if (e.key === "Escape") closeBadgeShareModal();
}

let badgeShareListenersInit = false;

function initBadgeShareListeners() {
  if (badgeShareListenersInit) return;
  badgeShareListenersInit = true;

  const modal = document.getElementById("badgeShareModal");
  const backdrop = document.getElementById("badgeShareModalBackdrop");
  const closeBtn = document.getElementById("badgeShareCloseBtn");
  const saveBtn = document.getElementById("badgeShareSaveBtn");
  const copyBtn = document.getElementById("badgeShareCopyBtn");

  backdrop?.addEventListener("click", closeBadgeShareModal);
  closeBtn?.addEventListener("click", closeBadgeShareModal);

  saveBtn?.addEventListener("click", async () => {
    if (saveBtn.disabled) return;
    try {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
      const dataUrl = await generateShareImage("badgeShareCard");
      downloadImage(dataUrl);
      showToast("Image saved to device");
    } catch (err) {
      console.error("[BadgeShare] Save error:", err);
      showToast("Could not save image");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Image";
    }
  });

  copyBtn?.addEventListener("click", async () => {
    if (copyBtn.disabled) return;
    try {
      copyBtn.disabled = true;
      copyBtn.textContent = "Copying...";
      const dataUrl = await generateShareImage("badgeShareCard");
      const copied = await copyImage(dataUrl);
      showToast(copied ? "Image copied to clipboard" : "Image saved to device");
      if (!copied) downloadImage(dataUrl);
    } catch (err) {
      console.error("[BadgeShare] Copy error:", err);
      showToast("Could not copy image");
    } finally {
      copyBtn.disabled = false;
      copyBtn.textContent = "Copy Image";
    }
  });
}

/**
 * Ensure badge share modal is closed on page load.
 */
export function ensureBadgeShareModalClosedOnLoad() {
  const modal = document.getElementById("badgeShareModal");
  if (modal) {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }
  badgeShareModalOpen = false;
}

/**
 * Open badge share modal.
 * @param {Object} profile - User profile
 * @param {{ id: string; name: string; icon: string; description?: string }} badge
 */
export function openBadgeShareModal(profile, badge) {
  const modal = document.getElementById("badgeShareModal");
  if (!modal) return;

  // Only one modal at a time — close achievement modal if open
  closeShareModalExported();

  initBadgeShareListeners();
  populateBadgeCard(profile || {}, badge);

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  badgeShareModalOpen = true;
  window.addEventListener("keydown", handleBadgeShareEscape);
}

// Ensure modal is closed on page load
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureBadgeShareModalClosedOnLoad);
  } else {
    ensureBadgeShareModalClosedOnLoad();
  }
}
