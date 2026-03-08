/**
 * Profile page: upload photo via ImgBB, edit displayName, bio, location, website, twitterHandle, discordHandle.
 * users/{uid}: displayName, bio, location, website, twitterHandle, discordHandle, photoURL, updatedAt
 * View mode: profile.html?uid={userId}&groupId={groupId} (groupId optional, for back link)
 */
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db } from "./firebase-init.js";
import { renderAvatar, escapeHtml } from "./utils.js";
import { IMGBB_API_KEY } from "./firebase-config.js";

function getDateId(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

const IMGBB_UPLOAD_URL = "https://api.imgbb.com/1/upload";
const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 800;

function showError(msg) {
  const el = document.getElementById("profileError");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}

function clearError() {
  const el = document.getElementById("profileError");
  if (el) {
    el.textContent = "";
    el.hidden = true;
  }
}

function showPreview(container, blobOrUrl) {
  if (!container) return;
  container.textContent = "";
  container.classList.add("avatar--img");
  const img = document.createElement("img");
  img.src = typeof blobOrUrl === "string" ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  img.alt = "Preview";
  img.className = "avatar-img";
  container.appendChild(img);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = typeof result === "string" && result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function resizeImageToBlob(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Could not resize image"));
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Invalid image"));
    };
    img.src = url;
  });
}

async function uploadToImgBB(file) {
  let toUpload = file;
  if (file.size > MAX_SIZE_BYTES) {
    const resized = await resizeImageToBlob(file);
    if (resized.size > MAX_SIZE_BYTES) {
      throw new Error("Image must be under 2MB. Use a smaller image.");
    }
    toUpload = new File([resized], "image.jpg", { type: "image/jpeg" });
  } else if (file.type !== "image/jpeg" && file.type !== "image/png") {
    toUpload = new File([await resizeImageToBlob(file)], "image.jpg", { type: "image/jpeg" });
  }
  const base64 = await fileToBase64(toUpload);
  const form = new FormData();
  form.append("key", IMGBB_API_KEY);
  form.append("image", base64);
  const res = await fetch(IMGBB_UPLOAD_URL, {
    method: "POST",
    body: form,
  });
  const json = await res.json();
  console.log("[Profile] ImgBB response:", json);
  if (!res.ok) {
    const msg = json.error?.message || json.error || res.statusText || "Upload failed. Please try again.";
    throw new Error(msg);
  }
  if (!json.data || !json.data.url) {
    throw new Error("Upload failed. Please try again.");
  }
  return json.data.url;
}

function init() {
  const uploadBtn = document.getElementById("uploadPhotoBtn");
  const photoInput = document.getElementById("photoInput");
  const profileForm = document.getElementById("profileForm");
  const saveProfileBtn = document.getElementById("saveProfileBtn");
  const profilePhoto = document.getElementById("profilePhoto");

  if (uploadBtn && photoInput) {
    uploadBtn.addEventListener("click", () => {
      console.log("Upload button clicked");
      photoInput.click();
    });
  } else {
    console.warn("[Profile] Upload button or file input missing", { uploadBtn: !!uploadBtn, photoInput: !!photoInput });
  }

  if (!profileForm || !profilePhoto) {
    console.warn("[Profile] init: missing profileForm or profilePhoto", { profileForm: !!profileForm, profilePhoto: !!profilePhoto });
    return;
  }

  if (photoInput) {
    photoInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      console.log("File selected:", file);
      if (!file) return;
      clearError();
      const uid = auth.currentUser?.uid;
      if (!uid) {
        console.warn("[Profile] No authenticated user");
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        showError("Image must be under 2MB. Try a smaller or more compressed image.");
        e.target.value = "";
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      showPreview(profilePhoto, previewUrl);
      if (saveProfileBtn) saveProfileBtn.disabled = true;
      try {
        if (!IMGBB_API_KEY || !String(IMGBB_API_KEY).trim()) {
          throw new Error("Upload failed. Please try again.");
        }
        console.log("[Profile] Uploading to ImgBB");
        const photoURL = await uploadToImgBB(file);
        console.log("[Profile] ImgBB response OK, URL:", photoURL);
        console.log("[Profile] Saving URL to Firestore");
        await updateDoc(doc(db, "users", uid), {
          photoURL,
          updatedAt: serverTimestamp(),
        });
        URL.revokeObjectURL(previewUrl);
        renderAvatar(profilePhoto, photoURL, document.getElementById("profileDisplayName")?.value, "lg");
        console.log("[Profile] Upload complete, avatar refreshed");
      } catch (err) {
        console.error("[Profile] Upload error", err);
        showError(err.message || "Upload failed. Please try again.");
        URL.revokeObjectURL(previewUrl);
        renderAvatar(profilePhoto, null, document.getElementById("profileDisplayName")?.value, "lg");
      } finally {
        if (saveProfileBtn) saveProfileBtn.disabled = false;
        e.target.value = "";
      }
    });
  }

  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const displayName = (document.getElementById("profileDisplayName")?.value || "").trim();
    const bio = (document.getElementById("profileBio")?.value || "").trim();
    const location = (document.getElementById("profileLocation")?.value || "").trim();
    const website = (document.getElementById("profileWebsite")?.value || "").trim();
    const twitterHandle = (document.getElementById("profileTwitter")?.value || "").trim();
    const discordHandle = (document.getElementById("profileDiscord")?.value || "").trim();
    if (saveProfileBtn) saveProfileBtn.disabled = true;
    try {
      await updateDoc(doc(db, "users", uid), {
        displayName: displayName || null,
        name: displayName || null,
        bio: bio || null,
        location: location || null,
        website: website || null,
        twitterHandle: twitterHandle || null,
        discordHandle: discordHandle || null,
        updatedAt: serverTimestamp(),
      });
      const currentPhotoURL = profilePhoto.querySelector("img")?.getAttribute("src") || null;
      renderAvatar(profilePhoto, currentPhotoURL, displayName, "lg");
    } catch (err) {
      console.error("[Profile] Save error", err);
      showError(err.message || "Could not save profile.");
    } finally {
      if (saveProfileBtn) saveProfileBtn.disabled = false;
    }
  });

  async function loadProfile(uid) {
    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      const data = userSnap.exists() ? userSnap.data() : {};
      const name = data.displayName ?? data.name ?? "";
      document.getElementById("profileDisplayName").value = name;
      document.getElementById("profileBio").value = data.bio ?? "";
      document.getElementById("profileLocation").value = data.location ?? "";
      document.getElementById("profileWebsite").value = data.website ?? "";
      document.getElementById("profileTwitter").value = data.twitterHandle ?? "";
      document.getElementById("profileDiscord").value = data.discordHandle ?? "";
      renderAvatar(profilePhoto, data.photoURL || null, name, "lg");
    } catch (err) {
      console.error("[Profile] Load error", err);
      showError("Could not load profile.");
    }
  }

  async function loadProfileView(uid, groupId) {
    const viewMode = document.getElementById("profileViewMode");
    const editMode = document.getElementById("profileEditMode");
    const backLink = document.getElementById("profileBackLink");
    const pageTitle = document.getElementById("profilePageTitle");
    if (!viewMode || !editMode) return;
    viewMode.hidden = false;
    editMode.hidden = true;
    if (backLink) backLink.href = groupId ? "group.html?id=" + encodeURIComponent(groupId) : "groups.html";
    if (pageTitle) pageTitle.textContent = "Profile";

    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      if (!userSnap.exists()) {
        showError("Profile not found.");
        return;
      }
      const user = userSnap.data();
      const name = user.displayName || user.name || user.email || "Member";
      const currentStreak = Number(user.currentStreak) || 0;
      const longestStreak = Number(user.longestStreak) || 0;

      const avatarEl = document.getElementById("profileViewAvatar");
      const nameEl = document.getElementById("profileViewName");
      const streakEl = document.getElementById("profileViewStreak");
      if (avatarEl) renderAvatar(avatarEl, user.photoURL || null, name, "lg");
      if (nameEl) nameEl.textContent = name;
      if (streakEl) streakEl.textContent = "Current Streak: " + currentStreak + " day" + (currentStreak !== 1 ? "s" : "") + " • Longest: " + longestStreak + " day" + (longestStreak !== 1 ? "s" : "");

      const socialLinks = [];
      const website = (user.website || "").trim();
      if (website && (website.startsWith("http://") || website.startsWith("https://"))) {
        socialLinks.push({ label: "Website", href: website, text: website });
      }
      if (user.twitterHandle) {
        const handle = String(user.twitterHandle).replace(/^@/, "");
        socialLinks.push({ label: "Twitter / X", href: "https://twitter.com/" + encodeURIComponent(handle), text: "@" + handle });
      }
      if (user.discordHandle) socialLinks.push({ label: "Discord", href: null, text: user.discordHandle });
      const socialSection = document.getElementById("profileViewSocial");
      const socialContainer = document.getElementById("profileViewSocialLinks");
      if (socialLinks.length > 0 && socialSection && socialContainer) {
        socialSection.hidden = false;
        socialContainer.innerHTML = socialLinks.map((s) =>
          s.href
            ? `<a href="${escapeHtml(s.href)}" target="_blank" rel="noopener" class="profile-social-link">${escapeHtml(s.label)}: ${escapeHtml(s.text)}</a>`
            : `<span class="profile-social-link profile-social-link--text">${escapeHtml(s.label)}: ${escapeHtml(s.text)}</span>`
        ).join("");
      } else if (socialSection) socialSection.hidden = true;

      const habitsSnap = await getDocs(collection(db, "users", uid, "habits"));
      const sharedHabits = [];
      habitsSnap.forEach((d) => {
        const h = d.data();
        if (h.shareWithGroups === true) sharedHabits.push({ id: d.id, name: h.name || "Unnamed" });
      });
      const todayId = getDateId(0);
      const todaySnap = await getDoc(doc(db, "users", uid, "checkins", todayId));
      const todayData = todaySnap.exists() ? todaySnap.data() : {};
      const completedToday = Array.isArray(todayData.habitsCompleted) ? todayData.habitsCompleted : [];

      const habitsSection = document.getElementById("profileViewHabits");
      const habitsList = document.getElementById("profileViewHabitsList");
      if (sharedHabits.length > 0 && habitsSection && habitsList) {
        habitsSection.hidden = false;
        habitsList.innerHTML = sharedHabits.map((h) => {
          const done = completedToday.includes(h.id);
          return `<li class="profile-habit-item">${done ? "✓" : "✗"} ${escapeHtml(h.name)}</li>`;
        }).join("");
      } else if (habitsSection) habitsSection.hidden = true;

      const historySection = document.getElementById("profileViewHistory");
      const dayNav = document.getElementById("profileViewDayNav");
      const dayHabits = document.getElementById("profileViewDayHabits");
      if (sharedHabits.length > 0 && historySection && dayNav && dayHabits) {
        historySection.hidden = false;
        const dayLabels = ["Today", "Yesterday", "2 Days Ago", "3 Days Ago"];
        dayNav.innerHTML = dayLabels.map((_, i) => {
          const dateId = getDateId(i);
          return `<button type="button" class="profile-day-btn" data-days="${i}">${dayLabels[i]}</button>`;
        }).join("");
        const dayBtns = dayNav.querySelectorAll(".profile-day-btn");
        let selectedDay = 0;
        async function renderDay(daysAgo) {
          selectedDay = daysAgo;
          dayBtns.forEach((b) => b.classList.toggle("profile-day-btn--active", Number(b.dataset.days) === daysAgo));
          const dateId = getDateId(daysAgo);
          const snap = await getDoc(doc(db, "users", uid, "checkins", dateId));
          const snapData = snap.exists() ? snap.data() : {};
          const completed = Array.isArray(snapData.habitsCompleted) ? snapData.habitsCompleted : [];
          dayHabits.innerHTML = sharedHabits.map((h) => {
            const done = completed.includes(h.id);
            return `<li class="profile-habit-item">${done ? "✓" : "✗"} ${escapeHtml(h.name)}</li>`;
          }).join("");
        }
        await renderDay(0);
        dayBtns.forEach((btn) => btn.addEventListener("click", () => renderDay(Number(btn.dataset.days))));
      } else if (historySection) historySection.hidden = true;
    } catch (err) {
      console.error("[Profile] loadProfileView error", err);
      showError("Could not load profile.");
    }
  }

  const params = new URLSearchParams(window.location.search);
  const viewUid = params.get("uid");
  const groupId = params.get("groupId") || "";

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    if (viewUid && viewUid !== user.uid) {
      loadProfileView(viewUid, groupId);
    } else {
      document.getElementById("profileViewMode").hidden = true;
      document.getElementById("profileEditMode").hidden = false;
      const backLink = document.getElementById("profileBackLink");
      if (backLink) backLink.href = "index.html";
      loadProfile(user.uid);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
