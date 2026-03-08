/**
 * Share Achievement: modal with preview, JPG generation, Save/Copy/Close.
 * Only shown when completedHabits === totalHabits.
 */

const FILENAME = "mim-achievement.jpg";
const CARD_SIZE = 1080;

function formatDate() {
  const d = new Date();
  const options = { weekday: "long", month: "long", day: "numeric", year: "numeric" };
  return d.toLocaleDateString("en-US", options);
}

/**
 * Populate the share card with user data.
 */
function populateShareCard(profile) {
  const name = profile?.displayName || profile?.name || profile?.email || "Someone";
  const photoURL = profile?.photoURL || null;
  const streak = Number(profile?.currentStreak) || 0;

  const avatarEl = document.getElementById("shareCardAvatar");
  const nameEl = document.getElementById("shareCardName");
  const streakEl = document.getElementById("shareCardStreak");
  const dateEl = document.getElementById("shareCardDate");

  if (avatarEl) {
    avatarEl.textContent = "";
    avatarEl.className = "avatar avatar--lg share-card-avatar";
    avatarEl.style.width = "200px";
    avatarEl.style.height = "200px";
    avatarEl.style.fontSize = "72px";
    const initial = (name || "?").trim().charAt(0).toUpperCase();
    if (photoURL) {
      const img = document.createElement("img");
      img.crossOrigin = "anonymous";
      img.src = photoURL;
      img.alt = name;
      img.className = "avatar-img";
      img.onerror = () => {
        avatarEl.textContent = initial;
      };
      avatarEl.appendChild(img);
      avatarEl.classList.add("avatar--img");
    } else {
      avatarEl.textContent = initial;
    }
  }
  if (nameEl) nameEl.textContent = name;
  if (streakEl) streakEl.textContent = "🔥 " + streak + " day streak";
  if (dateEl) dateEl.textContent = formatDate();
}

/**
 * Generate JPG from share card using html2canvas.
 * @returns {Promise<string>} Data URL (image/jpeg)
 */
async function generateShareImageDataUrl() {
  const card = document.getElementById("shareCard");
  if (!card) throw new Error("Share card not found");

  const html2canvas = window.html2canvas;
  if (!html2canvas) throw new Error("html2canvas not loaded");

  const canvas = await html2canvas(card, {
    scale: 1,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    width: CARD_SIZE,
    height: CARD_SIZE,
  });

  return canvas.toDataURL("image/jpeg", 0.9);
}

/**
 * Download image as mim-achievement.jpg
 */
function downloadImage(dataUrl) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = FILENAME;
  a.click();
}

/**
 * Copy image to clipboard. Falls back to download if unsupported.
 */
async function copyImageToClipboard(dataUrl) {
  if (!navigator.clipboard || !navigator.clipboard.write) {
    return false;
  }
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const item = new ClipboardItem({ "image/jpeg": blob });
    await navigator.clipboard.write([item]);
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

function closeModal() {
  const modal = document.getElementById("shareModal");
  if (modal) {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }
  unlockBodyScroll();
  window.removeEventListener("keydown", handleEscape);
}

function handleEscape(e) {
  if (e.key === "Escape") closeModal();
}

let initialized = false;

function initModalListeners() {
  if (initialized) return;
  initialized = true;

  const modal = document.getElementById("shareModal");
  const backdrop = document.getElementById("shareModalBackdrop");
  const saveBtn = document.getElementById("shareModalSaveBtn");
  const copyBtn = document.getElementById("shareModalCopyBtn");
  const closeBtn = document.getElementById("shareModalCloseBtn");

  backdrop?.addEventListener("click", closeModal);
  closeBtn?.addEventListener("click", closeModal);

  saveBtn?.addEventListener("click", async () => {
    try {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
      const dataUrl = await generateShareImageDataUrl();
      downloadImage(dataUrl);
      saveBtn.textContent = "Saved ✓";
      setTimeout(() => {
        saveBtn.textContent = "Save Image";
        saveBtn.disabled = false;
      }, 1500);
    } catch (err) {
      console.error("[Share] Save error:", err);
      saveBtn.textContent = "Save Image";
      saveBtn.disabled = false;
    }
  });

  copyBtn?.addEventListener("click", async () => {
    try {
      copyBtn.disabled = true;
      copyBtn.textContent = "Copying...";
      const dataUrl = await generateShareImageDataUrl();
      const copied = await copyImageToClipboard(dataUrl);
      if (copied) {
        copyBtn.textContent = "Copied ✓";
      } else {
        downloadImage(dataUrl);
        copyBtn.textContent = "Downloaded ✓";
      }
      setTimeout(() => {
        copyBtn.textContent = "Copy Image";
        copyBtn.disabled = false;
      }, 1500);
    } catch (err) {
      console.error("[Share] Copy error:", err);
      try {
        const dataUrl = await generateShareImageDataUrl();
        downloadImage(dataUrl);
        copyBtn.textContent = "Downloaded ✓";
      } catch {
        copyBtn.textContent = "Copy Image";
      }
      setTimeout(() => {
        copyBtn.textContent = "Copy Image";
        copyBtn.disabled = false;
      }, 1500);
    }
  });
}

/**
 * Open the share achievement modal.
 * Modal stays open until user presses Close.
 * @param {{ displayName?: string, name?: string, email?: string, photoURL?: string | null, currentStreak?: number }} profile
 */
export function openShareModal(profile) {
  initModalListeners();
  const modal = document.getElementById("shareModal");
  if (!modal) return;

  populateShareCard(profile);

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  lockBodyScroll();
  window.addEventListener("keydown", handleEscape);
}

/**
 * @deprecated Use openShareModal instead. Kept for backwards compatibility.
 */
export async function shareAchievement(profile) {
  openShareModal(profile || {});
}
