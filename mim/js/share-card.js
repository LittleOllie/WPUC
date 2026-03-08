/**
 * Unified share card generator for achievement and badge share images.
 * 1080x1080, JPG export, same rendering as Share Achievement.
 */
const CARD_SIZE = 1080;

function formatShareDate() {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Populate achievement share card (shareCard).
 */
export function populateAchievementCard(data) {
  const name = data?.displayName || data?.name || data?.email || "Someone";
  const photoURL = data?.photoURL ?? null;
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
      img.onerror = () => { avatarEl.textContent = initial; };
      img.onload = () => { avatarEl.classList.add("avatar--img"); };
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
    progressEl.textContent = total > 0 ? `${completed} / ${total} Habits Finished` : "";
    progressEl.hidden = total === 0;
  }
  if (dateEl) dateEl.textContent = formatShareDate();
  if (streakEl) {
    streakEl.textContent = streak > 0 ? `🔥 ${streak} Day Streak` : "";
    streakEl.hidden = streak === 0;
  }
}

/**
 * Populate challenge share card (challengeShareCard).
 * Layout: Challenge Completed, challenge name, subtitle (e.g. "7 Days Hydrated").
 */
export function populateChallengeCard(profile, challenge) {
  const name = profile?.displayName || profile?.name || profile?.email || "Someone";
  const photoURL = profile?.photoURL ?? null;
  const challengeName = challenge?.name ?? "Challenge";
  const icon = challenge?.icon ?? "🎯";
  const durationDays = Number(challenge?.durationDays) ?? 7;
  const subtitle = `${durationDays} Days Complete`;

  const avatarEl = document.getElementById("challengeShareCardAvatar");
  const nameEl = document.getElementById("challengeShareCardName");
  const iconEl = document.getElementById("challengeShareCardIcon");
  const badgeEl = document.getElementById("challengeShareCardBadge");
  const headlineEl = document.getElementById("challengeShareCardHeadline");
  const subtitleEl = document.getElementById("challengeShareCardSubtitle");

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
      img.onerror = () => { avatarEl.textContent = initial; };
      img.onload = () => { avatarEl.classList.add("avatar--img"); };
      img.src = photoURL;
      avatarEl.appendChild(img);
      if (img.complete) avatarEl.classList.add("avatar--img");
    } else {
      avatarEl.textContent = initial;
    }
  }

  if (nameEl) nameEl.textContent = name;
  if (iconEl) iconEl.textContent = icon;
  if (badgeEl) badgeEl.textContent = "CHALLENGE COMPLETED";
  if (headlineEl) headlineEl.textContent = challengeName;
  if (subtitleEl) subtitleEl.textContent = subtitle;
}

/**
 * Populate badge share card (badgeShareCard).
 */
export function populateBadgeCard(profile, badge) {
  const name = profile?.displayName || profile?.name || profile?.email || "Someone";
  const photoURL = profile?.photoURL ?? null;

  const avatarEl = document.getElementById("badgeShareCardAvatar");
  const nameEl = document.getElementById("badgeShareCardName");
  const iconEl = document.getElementById("badgeShareCardIcon");
  const badgeEl = document.getElementById("badgeShareCardBadge");
  const headlineEl = document.getElementById("badgeShareCardHeadline");
  const subtitleEl = document.getElementById("badgeShareCardSubtitle");

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
      img.onerror = () => { avatarEl.textContent = initial; };
      img.onload = () => { avatarEl.classList.add("avatar--img"); };
      img.src = photoURL;
      avatarEl.appendChild(img);
      if (img.complete) avatarEl.classList.add("avatar--img");
    } else {
      avatarEl.textContent = initial;
    }
  }

  if (nameEl) nameEl.textContent = name;
  if (iconEl) iconEl.textContent = badge?.icon ?? "🏅";
  if (badgeEl) badgeEl.textContent = "BADGE UNLOCKED";
  if (headlineEl) headlineEl.textContent = badge?.name ?? "Badge";
  if (subtitleEl) {
    subtitleEl.textContent = badge?.description ?? "";
    subtitleEl.hidden = !(badge?.description);
  }
}

async function waitForShareCardReady(cardEl) {
  if (!cardEl) return;
  const imgPromises = Array.from(cardEl.querySelectorAll("img")).map((img) =>
    img.complete ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r; })
  );
  await Promise.all([...(document.fonts?.ready ? [document.fonts.ready] : []), ...imgPromises]);
  await new Promise((r) => setTimeout(r, 50));
}

/**
 * Generate share image from card. Same method for achievement and badge.
 * 1080x1080, JPG export.
 * @param {string} cardId - "shareCard" or "badgeShareCard"
 * @returns {Promise<string>} Data URL (image/jpeg)
 */
export async function generateShareImage(cardId) {
  const card = document.getElementById(cardId);
  if (!card) throw new Error(`Share card not found: ${cardId}`);

  const html2canvas = window.html2canvas;
  if (!html2canvas) throw new Error("html2canvas not loaded");

  await waitForShareCardReady(card);

  const clone = card.cloneNode(true);
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:fixed;left:-9999px;top:0;width:1080px;height:1080px;z-index:-1;pointer-events:none;";
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);
  await new Promise((r) => setTimeout(r, 100));

  try {
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: CARD_SIZE,
      height: CARD_SIZE,
    });
    const out = document.createElement("canvas");
    out.width = CARD_SIZE;
    out.height = CARD_SIZE;
    const ctx = out.getContext("2d");
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, CARD_SIZE, CARD_SIZE);
    return out.toDataURL("image/jpeg", 0.9);
  } finally {
    document.body.removeChild(wrapper);
  }
}
