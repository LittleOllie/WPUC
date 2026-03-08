/**
 * Challenge share modal - uses unified share card generator.
 * 1080x1080 JPG export, same as Share Achievement.
 */
import { showToast } from "./utils.js";
import { populateChallengeCard, generateShareImage } from "./share-card.js";
import { closeShareModalExported } from "./share-achievement.js";

const FILENAME = "mim-challenge.jpg";

let challengeShareModalOpen = false;

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

function closeChallengeShareModal() {
  const modal = document.getElementById("challengeShareModal");
  if (modal) {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  challengeShareModalOpen = false;
  window.removeEventListener("keydown", handleChallengeShareEscape);
}

function handleChallengeShareEscape(e) {
  if (e.key === "Escape") closeChallengeShareModal();
}

let challengeShareListenersInit = false;

function initChallengeShareListeners() {
  if (challengeShareListenersInit) return;
  challengeShareListenersInit = true;

  const modal = document.getElementById("challengeShareModal");
  const backdrop = document.getElementById("challengeShareModalBackdrop");
  const closeBtn = document.getElementById("challengeShareCloseBtn");
  const saveBtn = document.getElementById("challengeShareSaveBtn");
  const copyBtn = document.getElementById("challengeShareCopyBtn");

  backdrop?.addEventListener("click", closeChallengeShareModal);
  closeBtn?.addEventListener("click", closeChallengeShareModal);

  saveBtn?.addEventListener("click", async () => {
    if (saveBtn.disabled) return;
    try {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
      const dataUrl = await generateShareImage("challengeShareCard");
      downloadImage(dataUrl);
      showToast("Image saved to device");
    } catch (err) {
      console.error("[ChallengeShare] Save error:", err);
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
      const dataUrl = await generateShareImage("challengeShareCard");
      const copied = await copyImage(dataUrl);
      showToast(copied ? "Image copied to clipboard" : "Image saved to device");
      if (!copied) downloadImage(dataUrl);
    } catch (err) {
      console.error("[ChallengeShare] Copy error:", err);
      showToast("Could not copy image");
    } finally {
      copyBtn.disabled = false;
      copyBtn.textContent = "Copy Image";
    }
  });
}

/**
 * Open challenge share modal.
 * @param {Object} profile - User profile
 * @param {{ name: string; icon: string; durationDays: number }} challenge
 */
export function openChallengeShareModal(profile, challenge) {
  const modal = document.getElementById("challengeShareModal");
  if (!modal) return;

  if (typeof closeShareModalExported === "function") {
    closeShareModalExported();
  }

  initChallengeShareListeners();
  populateChallengeCard(profile || {}, challenge);

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  challengeShareModalOpen = true;
  window.addEventListener("keydown", handleChallengeShareEscape);
}
