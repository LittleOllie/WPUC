/**
 * Single group page: name, members, leaderboard, activity, invite (QR + code), group settings, roles.
 */
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  arrayRemove,
  arrayUnion,
  query,
  orderBy,
  limit,
  startAfter,
  addDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db } from "./firebase-init.js";
import { getJoinUrl, generateJoinCode, joinCodeExpiresAt, getWeekStart, escapeHtml, escapeAttr, renderAvatar, showToast } from "./utils.js";
import { HABIT_LIBRARY } from "./habitLibrary.js";
import { IMGBB_API_KEY } from "./firebase-config.js";

let acceptGroupChallengeFn = null;
try {
  const m = await import("./group-challenges.js");
  acceptGroupChallengeFn = m.acceptGroupChallenge;
} catch (e) {
  console.warn("[Group] group-challenges not available:", e?.message);
}

const IMGBB_UPLOAD_URL = "https://api.imgbb.com/1/upload";
const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 800;
const ACTIVITY_PAGE_SIZE = 20;
const USER_COLOR_PALETTE = ["#FC4C02", "#2563EB", "#22C55E", "#9333EA", "#F59E0B"];

let currentUser = null;
let currentGroupId = null;
let currentGroup = null;
let isOwner = false;
let isAdmin = false;
let myRole = "member";
let membersUnsubscribe = null;

function showError(msg) {
  const el = document.getElementById("groupError");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
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
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not resize"))),
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

async function uploadGroupPhotoToImgBB(file) {
  let toUpload = file;
  if (file.size > MAX_SIZE_BYTES) {
    const resized = await resizeImageToBlob(file);
    toUpload = new File([resized], "image.jpg", { type: "image/jpeg" });
  } else if (file.type !== "image/jpeg" && file.type !== "image/png") {
    toUpload = new File([await resizeImageToBlob(file)], "image.jpg", { type: "image/jpeg" });
  }
  const base64 = await fileToBase64(toUpload);
  const form = new FormData();
  form.append("key", IMGBB_API_KEY);
  form.append("image", base64);
  const res = await fetch(IMGBB_UPLOAD_URL, { method: "POST", body: form });
  const json = await res.json();
  if (!res.ok || !json.data || !json.data.url) throw new Error("Upload failed. Please try again.");
  return json.data.url;
}

function getRoleBadgeClass(role) {
  if (role === "owner") return "role-badge role-badge--owner";
  if (role === "admin") return "role-badge role-badge--admin";
  return "role-badge role-badge--member";
}

function getRoleLabel(role) {
  if (role === "owner") return "OWNER";
  if (role === "admin") return "ADMIN";
  return "MEMBER";
}

/** Consistent color for a user (from userId or fallback string). */
function getColorForUserId(uidOrName) {
  if (!uidOrName) return USER_COLOR_PALETTE[0];
  let hash = 0;
  const str = String(uidOrName);
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i);
  const index = Math.abs(hash) % USER_COLOR_PALETTE.length;
  return USER_COLOR_PALETTE[index];
}

let lastActivityDoc = null;
let hasMoreActivity = false;
let activityExpanded = true;

function init() {
  const params = new URLSearchParams(window.location.search);
  const groupId = params.get("id");
  if (!groupId) {
    window.location.href = "groups.html";
    return;
  }
  currentGroupId = groupId;

  const inviteModal = document.getElementById("inviteModal");
  if (inviteModal) {
    inviteModal.hidden = true;
    inviteModal.setAttribute("aria-hidden", "true");
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    currentUser = user;
    await loadGroup();
  });

  function switchToTab(tab) {
    if (!tab) return;
    document.querySelectorAll(".group-tab").forEach((b) => {
      b.classList.toggle("group-tab--active", b.dataset.tab === tab);
      b.setAttribute("aria-selected", b.dataset.tab === tab ? "true" : "false");
    });
    const panelId = "tab" + tab.charAt(0).toUpperCase() + tab.slice(1);
    document.querySelectorAll(".group-tab-panel").forEach((panel) => {
      panel.hidden = panel.id !== panelId;
    });
    if (tab === "activity") loadActivity(false);
    if (tab === "challenges") loadChallenges();
  }

  document.querySelectorAll(".group-tab").forEach((btn) => {
    btn.addEventListener("click", () => switchToTab(btn.dataset.tab));
  });

  document.getElementById("activityToggle")?.addEventListener("click", () => {
    activityExpanded = !activityExpanded;
    const content = document.getElementById("activityContent");
    const toggle = document.getElementById("activityToggle");
    const icon = toggle?.querySelector(".group-activity-toggle-icon");
    if (content) content.hidden = !activityExpanded;
    if (toggle) toggle.setAttribute("aria-expanded", String(activityExpanded));
    if (icon) icon.textContent = activityExpanded ? "▼" : "▶";
  });

  document.getElementById("activityLoadMore")?.addEventListener("click", () => {
    loadActivity(true);
  });

  document.getElementById("inviteBtn")?.addEventListener("click", () => {
    if (!currentGroup || !currentGroup.joinCode) return;
    openInviteModal(currentGroup.joinCode, currentGroup.joinCodeExpires);
  });

  document.getElementById("modalCloseBtn")?.addEventListener("click", closeInviteModal);
  document.querySelector("#inviteModal .modal-backdrop")?.addEventListener("click", closeInviteModal);

  document.getElementById("regenerateCodeBtn")?.addEventListener("click", async () => {
    if (!currentGroupId || !currentUser || !isOwner) return;
    const groupRef = doc(db, "groups", currentGroupId);
    const snap = await getDoc(groupRef);
    if (!snap.exists() || snap.data().owner !== currentUser.uid) return;
    const newCode = generateJoinCode();
    const newExpires = joinCodeExpiresAt();
    await updateDoc(groupRef, { joinCode: newCode, joinCodeExpires: newExpires });
    currentGroup = { ...currentGroup, joinCode: newCode, joinCodeExpires: newExpires };
    openInviteModal(newCode, newExpires);
    document.getElementById("groupJoinCode").textContent = newCode;
  });

  const groupPhotoInput = document.getElementById("groupPhotoInput");
  const triggerGroupPhotoInput = () => groupPhotoInput?.click();
  document.getElementById("updateGroupPhotoBtn")?.addEventListener("click", triggerGroupPhotoInput);
  document.getElementById("updateGroupPhotoSettingBtn")?.addEventListener("click", triggerGroupPhotoInput);
  groupPhotoInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentGroupId || !isOwner && !isAdmin) return;
    e.target.value = "";
    try {
      const photoURL = await uploadGroupPhotoToImgBB(file);
      await updateDoc(doc(db, "groups", currentGroupId), { photoURL, updatedAt: serverTimestamp() });
      currentGroup = { ...currentGroup, photoURL };
      showToast("Group photo updated ✓");
      const groupAvatarEl = document.getElementById("groupAvatar");
      if (groupAvatarEl) renderAvatar(groupAvatarEl, photoURL, currentGroup.name || "Group", "lg");
    } catch (err) {
      showError(err.message || "Upload failed.");
    }
  });

  document.getElementById("updateGroupNameBtn")?.addEventListener("click", async () => {
    if (!currentGroupId || !isOwner && !isAdmin) return;
    const name = window.prompt("New group name", currentGroup?.name || "");
    if (name == null || !name.trim()) return;
    try {
      await updateDoc(doc(db, "groups", currentGroupId), { name: name.trim() });
      currentGroup = { ...currentGroup, name: name.trim() };
      document.getElementById("groupTitle").textContent = name.trim();
      document.getElementById("groupName").textContent = name.trim();
      showToast("Group settings updated ✓");
    } catch (err) {
      showError(err.message || "Could not update name.");
    }
  });

  document.getElementById("updateGroupDescriptionBtn")?.addEventListener("click", async () => {
    if (!currentGroupId || !isOwner && !isAdmin) return;
    const description = window.prompt("Group description (optional)", currentGroup?.description || "");
    if (description == null) return;
    try {
      const value = description.trim();
      await updateDoc(doc(db, "groups", currentGroupId), { description: value || null });
      currentGroup = { ...currentGroup, description: value || null };
      const descEl = document.getElementById("groupDescription");
      if (descEl) {
        descEl.textContent = value || "";
        descEl.style.display = value ? "" : "none";
      }
      showToast("Group settings updated ✓");
    } catch (err) {
      showError(err.message || "Could not update description.");
    }
  });

  document.getElementById("regenerateCodeSettingBtn")?.addEventListener("click", async () => {
    if (!currentGroupId || !currentUser || (!isOwner && !isAdmin)) return;
    const groupRef = doc(db, "groups", currentGroupId);
    const newCode = generateJoinCode();
    const newExpires = joinCodeExpiresAt();
    await updateDoc(groupRef, { joinCode: newCode, joinCodeExpires: newExpires });
    currentGroup = { ...currentGroup, joinCode: newCode, joinCodeExpires: newExpires };
    document.getElementById("groupJoinCode").textContent = newCode;
    showToast("Join code regenerated ✓");
  });

  document.getElementById("deleteGroupBtn")?.addEventListener("click", async () => {
    if (!currentGroupId || !currentUser || !isOwner) return;
    if (!confirm("Are you sure you want to delete this group? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "groups", currentGroupId));
      await updateDoc(doc(db, "users", currentUser.uid), { groupIds: arrayRemove(currentGroupId) });
      window.location.href = "groups.html";
    } catch (err) {
      showError(err.message || "Could not delete group.");
    }
  });

  initActivityLikeDelegation();
  try {
    initCreateChallengeModal();
  } catch (e) {
    console.warn("[Group] Create challenge modal init failed:", e?.message);
  }

  document.getElementById("membersList")?.addEventListener("click", async (e) => {
    const removeBtn = e.target.closest("[data-remove-member]");
    if (removeBtn && (isOwner || isAdmin)) {
      const uid = removeBtn.dataset.removeMember;
      if (uid === currentUser.uid) return;
      if (!confirm("Remove this member from the group?")) return;
      try {
        await deleteDoc(doc(db, "groups", currentGroupId, "members", uid));
        await loadGroup();
      } catch (err) {
        showError(err.message || "Could not remove member.");
      }
      return;
    }
    const promoteBtn = e.target.closest("[data-promote-admin]");
    if (promoteBtn && isOwner) {
      const uid = promoteBtn.dataset.promoteAdmin;
      try {
        await updateDoc(doc(db, "groups", currentGroupId, "members", uid), { role: "admin" });
        await loadGroup();
      } catch (err) {
        showError(err.message || "Could not promote.");
      }
      return;
    }
    const demoteBtn = e.target.closest("[data-demote-member]");
    if (demoteBtn && isOwner) {
      const uid = demoteBtn.dataset.demoteMember;
      try {
        await updateDoc(doc(db, "groups", currentGroupId, "members", uid), { role: "member" });
        await loadGroup();
      } catch (err) {
        showError(err.message || "Could not demote.");
      }
    }
  });
}

async function loadGroup() {
  if (!currentUser || !currentGroupId) return;
  if (membersUnsubscribe) {
    membersUnsubscribe();
    membersUnsubscribe = null;
  }
  const groupRef = doc(db, "groups", currentGroupId);
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) {
    showError("Group not found.");
    return;
  }
  currentGroup = groupSnap.data();
  currentGroup.id = currentGroupId;
  isOwner = currentGroup.owner === currentUser.uid;

  document.getElementById("groupTitle").textContent = currentGroup.name || "Group";
  document.getElementById("groupName").textContent = currentGroup.name || "Group";
  const groupAvatarEl = document.getElementById("groupAvatar");
  if (groupAvatarEl) renderAvatar(groupAvatarEl, currentGroup.photoURL || null, currentGroup.name || "Group", "lg");

  const memberSnap = await getDoc(doc(db, "groups", currentGroupId, "members", currentUser.uid));
  if (!memberSnap.exists()) {
    await updateDoc(doc(db, "users", currentUser.uid), { groupIds: arrayRemove(currentGroupId) });
    window.location.href = "groups.html";
    return;
  }
  const myMemberData = memberSnap.data();
  myRole = myMemberData.role || (isOwner ? "owner" : "member");
  isAdmin = myRole === "admin" || isOwner;
  if (isOwner) myRole = "owner";

  const descEl = document.getElementById("groupDescription");
  if (descEl) {
    descEl.textContent = currentGroup.description || "";
    descEl.style.display = currentGroup.description ? "" : "none";
  }
  document.getElementById("groupJoinCode").textContent = currentGroup.joinCode || "—";
  document.getElementById("memberCount").textContent = "";

  const inviteBtn = document.getElementById("inviteBtn");
  if (inviteBtn) inviteBtn.style.display = isOwner || isAdmin ? "" : "none";
  const createChallengeBtn = document.getElementById("createChallengeBtn");
  if (createChallengeBtn) createChallengeBtn.style.display = isOwner || isAdmin ? "" : "none";
  const updateGroupPhotoBtn = document.getElementById("updateGroupPhotoBtn");
  if (updateGroupPhotoBtn) updateGroupPhotoBtn.style.display = isOwner || isAdmin ? "" : "none";
  const settingsTab = document.querySelector(".group-tab--settings");
  if (settingsTab) settingsTab.style.display = isOwner || isAdmin ? "" : "none";
  const deleteGroupBtn = document.getElementById("deleteGroupBtn");
  if (deleteGroupBtn) deleteGroupBtn.style.display = isOwner ? "" : "none";

  const membersSnap = await getDocs(collection(db, "groups", currentGroupId, "members"));
  const members = [];
  membersSnap.forEach((d) => members.push({ id: d.id, ...d.data() }));
  const ownerId = currentGroup.owner;
  members.sort((a, b) => ((a.role === "owner" || a.id === ownerId) ? -1 : 0) - ((b.role === "owner" || b.id === ownerId) ? -1 : 0));
  document.getElementById("memberCount").textContent = members.length + " member" + (members.length !== 1 ? "s" : "");

  const userSnaps = await Promise.all(members.map((m) => getDoc(doc(db, "users", m.id))));
  const userCache = new Map();
  members.forEach((m, i) => {
    const u = userSnaps[i].exists() ? userSnaps[i].data() : {};
    m.photoURL = u.photoURL || null;
    m.displayName = u.displayName || u.name || m.name || "Member";
    userCache.set(m.id, { photoURL: m.photoURL, displayName: m.displayName });
  });
  const listEl = document.getElementById("membersList");
  listEl.innerHTML = "";
  members.forEach((m) => {
    const role = m.role || (m.id === ownerId ? "owner" : "member");
    const isOwnerMember = role === "owner" || m.id === ownerId;
    const isAdminMember = role === "admin";
    const canRemove = (isOwner || isAdmin) && m.id !== currentUser.uid && !isOwnerMember;
    const canPromoteDemote = isOwner && !isOwnerMember && m.id !== currentUser.uid;
    const name = m.displayName || m.name || "Member";
    const li = document.createElement("li");
    li.className = "group-member-item";
    const avatarLink = document.createElement("a");
    avatarLink.href = "profile.html?uid=" + encodeURIComponent(m.id) + "&groupId=" + encodeURIComponent(currentGroupId);
    avatarLink.className = "group-member-avatar-link";
    avatarLink.setAttribute("aria-label", "View " + name + " profile");
    const avatar = document.createElement("div");
    renderAvatar(avatar, m.photoURL, name, "sm");
    avatarLink.appendChild(avatar);
    const nameSpan = document.createElement("span");
    nameSpan.className = "group-member-name";
    const memberLink = document.createElement("a");
    memberLink.href = "profile.html?uid=" + encodeURIComponent(m.id) + "&groupId=" + encodeURIComponent(currentGroupId);
    memberLink.className = "group-member-link";
    memberLink.textContent = name;
    const badgeSpan = document.createElement("span");
    badgeSpan.className = getRoleBadgeClass(role);
    badgeSpan.textContent = getRoleLabel(role);
    nameSpan.appendChild(memberLink);
    nameSpan.appendChild(document.createTextNode(" "));
    nameSpan.appendChild(badgeSpan);
    const actionsSpan = document.createElement("span");
    actionsSpan.className = "group-member-actions";
    if (canPromoteDemote) {
      if (role === "member") {
        const promoteBtn = document.createElement("button");
        promoteBtn.type = "button";
        promoteBtn.className = "button-small button-ghost";
        promoteBtn.dataset.promoteAdmin = m.id;
        promoteBtn.textContent = "Promote to Admin";
        actionsSpan.appendChild(promoteBtn);
      } else if (role === "admin") {
        const demoteBtn = document.createElement("button");
        demoteBtn.type = "button";
        demoteBtn.className = "button-small button-ghost";
        demoteBtn.dataset.demoteMember = m.id;
        demoteBtn.textContent = "Demote to Member";
        actionsSpan.appendChild(demoteBtn);
      }
    }
    if (canRemove) {
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "button-small button-ghost";
      removeBtn.dataset.removeMember = m.id;
      removeBtn.textContent = "Remove";
      removeBtn.setAttribute("aria-label", "Remove from group");
      actionsSpan.appendChild(removeBtn);
    }
    nameSpan.appendChild(actionsSpan);
    li.appendChild(avatarLink);
    li.appendChild(nameSpan);
    listEl.appendChild(li);
  });

  const leaderboard = members
    .map((m) => ({ name: m.displayName || m.name || "Member", id: m.id, points: Number(m.points) || 0 }))
    .sort((a, b) => b.points - a.points);
  const leaderEl = document.getElementById("leaderboardList");
  leaderEl.innerHTML = "";
  leaderboard.forEach((entry, i) => {
    const cached = userCache.get(entry.id);
    const photoURL = cached ? cached.photoURL : null;
    const li = document.createElement("li");
    li.className = "group-leaderboard-item";
    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    rank.textContent = String(i + 1);
    const profileUrl = "profile.html?uid=" + encodeURIComponent(entry.id) + "&groupId=" + encodeURIComponent(currentGroupId);
    const avatarLink = document.createElement("a");
    avatarLink.href = profileUrl;
    avatarLink.className = "group-member-avatar-link";
    avatarLink.setAttribute("aria-label", "View " + entry.name + " profile");
    const avatar = document.createElement("div");
    renderAvatar(avatar, photoURL, entry.name, "sm");
    avatarLink.appendChild(avatar);
    const nameLink = document.createElement("a");
    nameLink.href = profileUrl;
    nameLink.className = "group-member-link";
    nameLink.textContent = " " + entry.name + " — " + entry.points + " pt" + (entry.points !== 1 ? "s" : "");
    li.appendChild(rank);
    li.appendChild(avatarLink);
    li.appendChild(nameLink);
    leaderEl.appendChild(li);
  });

  lastActivityDoc = null;
  hasMoreActivity = false;
  loadActivity(false);
  loadChallenges();

  membersUnsubscribe = onSnapshot(collection(db, "groups", currentGroupId, "members"), () => {
    refreshMembersAndLeaderboard();
  });
}

async function refreshMembersAndLeaderboard() {
  if (!currentUser || !currentGroupId) return;
  try {
    const membersSnap = await getDocs(collection(db, "groups", currentGroupId, "members"));
    const members = [];
    membersSnap.forEach((d) => members.push({ id: d.id, ...d.data() }));
    const ownerId = currentGroup?.owner;
    members.sort((a, b) => ((a.role === "owner" || a.id === ownerId) ? -1 : 0) - ((b.role === "owner" || b.id === ownerId) ? -1 : 0));

    const userSnaps = await Promise.all(members.map((m) => getDoc(doc(db, "users", m.id))));
    const userCache = new Map();
    members.forEach((m, i) => {
      const u = userSnaps[i].exists() ? userSnaps[i].data() : {};
      m.photoURL = u.photoURL || null;
      m.displayName = u.displayName || u.name || m.name || "Member";
      userCache.set(m.id, { photoURL: m.photoURL, displayName: m.displayName });
    });

    const listEl = document.getElementById("membersList");
    if (listEl) {
      listEl.innerHTML = "";
      members.forEach((m) => {
        const role = m.role || (m.id === ownerId ? "owner" : "member");
        const isOwnerMember = role === "owner" || m.id === ownerId;
        const isAdminMember = role === "admin";
        const canRemove = (isOwner || isAdmin) && m.id !== currentUser.uid && !isOwnerMember;
        const canPromoteDemote = isOwner && !isOwnerMember && m.id !== currentUser.uid;
        const name = m.displayName || m.name || "Member";
        const li = document.createElement("li");
        li.className = "group-member-item";
        const avatarLink = document.createElement("a");
        avatarLink.href = "profile.html?uid=" + encodeURIComponent(m.id) + "&groupId=" + encodeURIComponent(currentGroupId);
        avatarLink.className = "group-member-avatar-link";
        avatarLink.setAttribute("aria-label", "View " + name + " profile");
        const avatar = document.createElement("div");
        renderAvatar(avatar, m.photoURL, name, "sm");
        avatarLink.appendChild(avatar);
        const nameSpan = document.createElement("span");
        nameSpan.className = "group-member-name";
        const memberLink = document.createElement("a");
        memberLink.href = "profile.html?uid=" + encodeURIComponent(m.id) + "&groupId=" + encodeURIComponent(currentGroupId);
        memberLink.className = "group-member-link";
        memberLink.textContent = name;
        const badgeSpan = document.createElement("span");
        badgeSpan.className = getRoleBadgeClass(role);
        badgeSpan.textContent = getRoleLabel(role);
        nameSpan.appendChild(memberLink);
        nameSpan.appendChild(document.createTextNode(" "));
        nameSpan.appendChild(badgeSpan);
        const actionsSpan = document.createElement("span");
        actionsSpan.className = "group-member-actions";
        if (canPromoteDemote) {
          if (role === "member") {
            const promoteBtn = document.createElement("button");
            promoteBtn.type = "button";
            promoteBtn.className = "button-small button-ghost";
            promoteBtn.dataset.promoteAdmin = m.id;
            promoteBtn.textContent = "Promote to Admin";
            actionsSpan.appendChild(promoteBtn);
          } else if (role === "admin") {
            const demoteBtn = document.createElement("button");
            demoteBtn.type = "button";
            demoteBtn.className = "button-small button-ghost";
            demoteBtn.dataset.demoteMember = m.id;
            demoteBtn.textContent = "Demote to Member";
            actionsSpan.appendChild(demoteBtn);
          }
        }
        if (canRemove) {
          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "button-small button-ghost";
          removeBtn.dataset.removeMember = m.id;
          removeBtn.textContent = "Remove";
          removeBtn.setAttribute("aria-label", "Remove from group");
          actionsSpan.appendChild(removeBtn);
        }
        nameSpan.appendChild(actionsSpan);
        li.appendChild(avatarLink);
        li.appendChild(nameSpan);
        listEl.appendChild(li);
      });
    }

    const leaderboard = members
      .map((m) => ({ name: m.displayName || m.name || "Member", id: m.id, points: Number(m.points) || 0 }))
      .sort((a, b) => b.points - a.points);
    const leaderEl = document.getElementById("leaderboardList");
    if (leaderEl) {
      leaderEl.innerHTML = "";
      leaderboard.forEach((entry, i) => {
        const cached = userCache.get(entry.id);
        const photoURL = cached ? cached.photoURL : null;
        const li = document.createElement("li");
        li.className = "group-leaderboard-item";
        const rank = document.createElement("span");
        rank.className = "leaderboard-rank";
        rank.textContent = String(i + 1);
        const profileUrl = "profile.html?uid=" + encodeURIComponent(entry.id) + "&groupId=" + encodeURIComponent(currentGroupId);
        const avatarLink = document.createElement("a");
        avatarLink.href = profileUrl;
        avatarLink.className = "group-member-avatar-link";
        avatarLink.setAttribute("aria-label", "View " + entry.name + " profile");
        const avatar = document.createElement("div");
        renderAvatar(avatar, photoURL, entry.name, "sm");
        avatarLink.appendChild(avatar);
        const nameLink = document.createElement("a");
        nameLink.href = profileUrl;
        nameLink.className = "group-member-link";
        nameLink.textContent = " " + entry.name + " — " + entry.points + " pt" + (entry.points !== 1 ? "s" : "");
        li.appendChild(rank);
        li.appendChild(avatarLink);
        li.appendChild(nameLink);
        leaderEl.appendChild(li);
      });
    }
  } catch (err) {
    console.error("[Group] refreshMembersAndLeaderboard error", err);
  }
}

async function loadChallenges() {
  if (!currentGroupId || !currentUser) return;
  const listEl = document.getElementById("challengesList");
  if (!listEl) return;
  listEl.innerHTML = "<p class=\"muted-text\">Loading…</p>";
  try {
    const challengesRef = collection(db, "groups", currentGroupId, "challenges");
    const snap = await getDocs(challengesRef);
    const challenges = [];
    snap.forEach((d) => challenges.push({ id: d.id, ...d.data() }));

    const habitsRef = collection(db, "users", currentUser.uid, "habits");
    const habitsSnap = await getDocs(habitsRef);
    const acceptedChallengeIds = new Set();
    habitsSnap.forEach((d) => {
      const data = d.data();
      if (data.source === "groupChallenge" && data.challengeId) acceptedChallengeIds.add(data.challengeId);
    });

    const today = new Date().toISOString().split("T")[0];
    listEl.innerHTML = "";
    if (challenges.length === 0) {
      listEl.innerHTML = "<p class=\"muted-text\">No challenges yet. Admins can create one.</p>";
      return;
    }

    for (const c of challenges) {
      if (c.status !== "active") continue;
      if (c.endDate && c.endDate < today) continue;
      if (c.startDate && c.startDate > today) continue;

      const hasAccepted = acceptedChallengeIds.has(c.id);
      const habits = c.habits || [];
      const habitSummary = habits.map((h) => (getLibraryHabitName(h.habitId) || h.habitId || "") + " (+" + (h.points || 0) + " pts)").join(", ");

      const card = document.createElement("div");
      card.className = "group-challenge-card card";
      card.innerHTML =
        `<div class="group-challenge-header">` +
        `<h4 class="group-challenge-name">${escapeHtml(c.name || "Challenge")}</h4>` +
        `<p class="muted-text small-text">${escapeHtml(habitSummary || "No habits")}</p>` +
        `</div>`;
      const actions = document.createElement("div");
      actions.className = "group-challenge-actions";
      if (isOwner || isAdmin) {
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "button-secondary button-small";
        editBtn.textContent = "Edit";
        editBtn.dataset.challengeId = c.id;
        editBtn.dataset.challengeData = JSON.stringify(c);
        editBtn.addEventListener("click", handleEditChallenge);
        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "button-secondary button-small";
        deleteBtn.textContent = "Delete";
        deleteBtn.dataset.challengeId = c.id;
        deleteBtn.addEventListener("click", handleDeleteChallenge);
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
      }
      if (!hasAccepted && habits.length > 0) {
        const acceptBtn = document.createElement("button");
        acceptBtn.type = "button";
        acceptBtn.className = "button-primary button-small";
        acceptBtn.textContent = c.requireAccept ? "Accept" : "Join";
        acceptBtn.dataset.challengeId = c.id;
        acceptBtn.dataset.challengeHabits = JSON.stringify(habits);
        acceptBtn.addEventListener("click", handleAcceptChallenge);
        actions.appendChild(acceptBtn);
        if (c.requireAccept) {
          const declineBtn = document.createElement("button");
          declineBtn.type = "button";
          declineBtn.className = "button-ghost button-small";
          declineBtn.textContent = "Decline";
          declineBtn.dataset.challengeId = c.id;
          declineBtn.addEventListener("click", () => { card.remove(); });
          actions.appendChild(declineBtn);
        }
      }
      card.appendChild(actions);
      if (hasAccepted) {
        const acceptedBadge = document.createElement("span");
        acceptedBadge.className = "group-challenge-accepted muted-text small-text";
        acceptedBadge.textContent = "✓ Accepted";
        card.appendChild(acceptedBadge);
      }
      listEl.appendChild(card);
    }
    if (listEl.children.length === 0) {
      listEl.innerHTML = "<p class=\"muted-text\">No active challenges.</p>";
    }
  } catch (err) {
    console.error("[Group] loadChallenges error", err);
    listEl.innerHTML = "<p class=\"muted-text\">Group challenges coming soon.</p>";
  }
}

async function handleAcceptChallenge(e) {
  const btn = e.target;
  const challengeId = btn.dataset.challengeId;
  let habits;
  try {
    habits = JSON.parse(btn.dataset.challengeHabits || "[]");
  } catch {
    habits = [];
  }
  if (!challengeId || !currentUser || !currentGroupId) return;
  btn.disabled = true;
  try {
    const fn = acceptGroupChallengeFn;
    if (!fn) {
      showToast("Challenges temporarily unavailable.");
      return;
    }
    const added = await fn(currentUser.uid, currentGroupId, challengeId, habits);
    showToast(added > 0 ? "Challenge accepted! " + added + " habit(s) added." : "Already have all habits.");
    loadChallenges();
    loadGroup();
  } catch (err) {
    console.error("[Group] acceptChallenge error", err);
    showError(err.message || "Could not accept challenge.");
  } finally {
    btn.disabled = false;
  }
}

async function handleDeleteChallenge(e) {
  const btn = e.target;
  const challengeId = btn.dataset.challengeId;
  if (!challengeId || !currentGroupId || (!isOwner && !isAdmin)) return;
  if (!confirm("Delete this challenge? Members will keep any habits they already accepted.")) return;
  btn.disabled = true;
  try {
    await deleteDoc(doc(db, "groups", currentGroupId, "challenges", challengeId));
    showToast("Challenge deleted.");
    loadChallenges();
  } catch (err) {
    console.error("[Group] deleteChallenge error", err);
    showError(err.message || "Could not delete challenge.");
  } finally {
    btn.disabled = false;
  }
}

function handleEditChallenge(e) {
  const btn = e.target;
  let challengeData;
  try {
    challengeData = JSON.parse(btn.dataset.challengeData || "{}");
  } catch {
    return;
  }
  if (!challengeData.id || !currentGroupId || (!isOwner && !isAdmin)) return;
  if (openEditChallengeModalFn) openEditChallengeModalFn(challengeData);
}

let editingChallengeId = null;
let openEditChallengeModalFn = null;

function slugify(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "h";
}

/** Look up habit name from Habit Library by habitId (for display). */
function getLibraryHabitName(habitId) {
  if (!habitId) return "";
  const lib = HABIT_LIBRARY.find((h) => h.habitId === habitId);
  return lib ? lib.name : "";
}

function initCreateChallengeModal() {
  const modal = document.getElementById("createChallengeModal");
  const createBtn = document.getElementById("createChallengeBtn");
  const cancelBtn = document.getElementById("createChallengeCancelBtn");
  const submitBtn = document.getElementById("createChallengeSubmitBtn");
  const addHabitBtn = document.getElementById("addChallengeHabitBtn");
  const habitsList = document.getElementById("challengeHabitsList");
  const nameInput = document.getElementById("challengeNameInput");
  const requireAcceptCheck = document.getElementById("challengeRequireAccept");

  if (!modal || !createBtn) return;

  const closeModal = () => {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    editingChallengeId = null;
    if (submitBtn) submitBtn.textContent = "Create Challenge";
  };

  openEditChallengeModalFn = (c) => {
    editingChallengeId = c.id;
    challengeHabits = (c.habits || []).map((h) => ({ habitId: h.habitId || "", points: h.points ?? 1 }));
    if (nameInput) nameInput.value = c.name || "";
    if (requireAcceptCheck) requireAcceptCheck.checked = c.requireAccept !== false;
    if (submitBtn) submitBtn.textContent = "Save Changes";
    renderHabits();
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    nameInput?.focus();
  };

  let challengeHabits = [{ habitId: "", points: 1 }];

  function renderHabits() {
    if (!habitsList) return;
    habitsList.innerHTML = "";
    challengeHabits.forEach((h, i) => {
      const row = document.createElement("div");
      row.className = "challenge-habit-row";
      const selectOptions = HABIT_LIBRARY.map(
        (lib) => `<option value="${escapeAttr(lib.habitId)}" ${h.habitId === lib.habitId ? "selected" : ""}>${escapeHtml(lib.icon + " " + lib.name)}</option>`
      ).join("");
      row.innerHTML =
        `<div class="challenge-habit-select-wrap"><label class="challenge-points-label">Habit</label><select class="input-field challenge-habit-select" data-index="${i}" aria-label="Select habit">` +
        `<option value="">Select habit…</option>${selectOptions}</select></div>` +
        `<div class="challenge-habit-points-wrap"><label class="challenge-points-label">Points</label><input type="number" class="input-field challenge-habit-points" min="1" max="100" data-index="${i}" value="${h.points ?? 1}" aria-label="Points" /></div>` +
        (challengeHabits.length > 1 ? `<button type="button" class="button-ghost button-small remove-habit-btn" data-index="${i}">−</button>` : "");
      habitsList.appendChild(row);
    });
    habitsList.querySelectorAll(".challenge-habit-select").forEach((select) => {
      select.addEventListener("change", (e) => {
        const i = parseInt(e.target.dataset.index, 10);
        if (!isNaN(i) && challengeHabits[i]) challengeHabits[i].habitId = e.target.value || "";
      });
    });
    habitsList.querySelectorAll(".challenge-habit-points").forEach((input) => {
      input.addEventListener("input", (e) => {
        const i = parseInt(e.target.dataset.index, 10);
        const v = parseInt(e.target.value, 10);
        if (!isNaN(i) && challengeHabits[i]) challengeHabits[i].points = isNaN(v) ? 1 : Math.max(1, Math.min(100, v));
      });
    });
    habitsList.querySelectorAll(".remove-habit-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const i = parseInt(e.target.dataset.index, 10);
        if (!isNaN(i) && challengeHabits.length > 1) {
          challengeHabits.splice(i, 1);
          renderHabits();
        }
      });
    });
  }

  addHabitBtn?.addEventListener("click", () => {
    challengeHabits.push({ habitId: "", points: 1 });
    renderHabits();
  });

  createBtn.addEventListener("click", () => {
    editingChallengeId = null;
    challengeHabits = [{ habitId: "", points: 1 }];
    renderHabits();
    if (nameInput) nameInput.value = "";
    if (requireAcceptCheck) requireAcceptCheck.checked = true;
    if (submitBtn) submitBtn.textContent = "Create Challenge";
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    nameInput?.focus();
  });

  cancelBtn?.addEventListener("click", closeModal);
  modal.querySelector(".modal-backdrop")?.addEventListener("click", closeModal);

  submitBtn?.addEventListener("click", async () => {
    const name = (nameInput?.value || "").trim();
    if (!name) {
      showError("Enter a challenge name.");
      return;
    }
    const habits = challengeHabits
      .filter((h) => h.habitId)
      .map((h) => ({
        habitId: h.habitId,
        points: Math.max(1, Math.min(100, parseInt(h.points, 10) || 1)),
      }));
    if (habits.length === 0) {
      showError("Add at least one habit.");
      return;
    }
    if (!currentGroupId || !currentUser || (!isOwner && !isAdmin)) return;
    submitBtn.disabled = true;
    try {
      if (editingChallengeId) {
        await updateDoc(doc(db, "groups", currentGroupId, "challenges", editingChallengeId), {
          name,
          habits,
          requireAccept: requireAcceptCheck?.checked !== false,
        });
        showToast("Challenge updated!");
      } else {
        const today = new Date().toISOString().split("T")[0];
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 14);
        const endDateStr = endDate.toISOString().split("T")[0];
        await addDoc(collection(db, "groups", currentGroupId, "challenges"), {
          name,
          createdBy: currentUser.uid,
          habits,
          requireAccept: requireAcceptCheck?.checked !== false,
          startDate: today,
          endDate: endDateStr,
          status: "active",
        });
        showToast("Challenge created!");
      }
      closeModal();
      loadChallenges();
    } catch (err) {
      console.error("[Group] createChallenge error", err);
      showError(err.message || "Could not create challenge.");
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function formatActivityMessage(a) {
  const msg = a.message || "";
  if (a.type === "habit") return "completed: " + (a.habitName || "Habit");
  if (a.type === "habits") return "completed " + (a.count || 0) + " habit" + ((a.count || 0) !== 1 ? "s" : "") + " 🔥";
  if (a.type === "streak") return "hit a " + (a.count || 0) + " day streak 🏆";
  if (a.type === "identity") return "reinforced \"" + (a.identity || "") + "\" ✔";
  if (a.type === "join") return msg || "joined";
  return msg;
}

function renderActivityItem(a, activityEl) {
  const userName = a.userName || "Someone";
  const uid = a.createdBy || a.userId || "";
  const color = getColorForUserId(uid || userName);
  const likes = Array.isArray(a.likes) ? a.likes : (Array.isArray(a.likedByUsers) ? a.likedByUsers : []);
  const likeCount = typeof a.likesCount === "number" ? a.likesCount : likes.length;
  const isLiked = currentUser && likes.includes(currentUser.uid);

  const li = document.createElement("li");
  li.className = "group-activity-item";
  li.dataset.eventId = a.id;

  const avatarWrap = document.createElement("div");
  avatarWrap.className = "group-activity-avatar";
  renderAvatar(avatarWrap, a.photoURL || null, userName, "sm");

  const contentWrap = document.createElement("div");
  contentWrap.className = "group-activity-content-wrap";

  const nameSpan = document.createElement("span");
  nameSpan.className = "group-activity-user";
  if (uid && currentGroupId) {
    const nameLink = document.createElement("a");
    nameLink.href = "profile.html?uid=" + encodeURIComponent(uid) + "&groupId=" + encodeURIComponent(currentGroupId);
    nameLink.className = "group-activity-user-link";
    nameLink.style.color = color;
    nameLink.textContent = userName + " ";
    nameSpan.appendChild(nameLink);
  } else {
    nameSpan.style.color = color;
    nameSpan.textContent = userName + " ";
  }

  const msgSpan = document.createElement("span");
  msgSpan.className = "group-activity-message";
  msgSpan.textContent = formatActivityMessage(a);

  contentWrap.appendChild(nameSpan);
  contentWrap.appendChild(msgSpan);
  if (a.type === "habit" && a.note) {
    const noteEl = document.createElement("p");
    noteEl.className = "group-activity-habit-note muted-text small-text";
    noteEl.textContent = a.note;
    contentWrap.appendChild(noteEl);
  }

  const likeWrap = document.createElement("span");
  likeWrap.className = "group-activity-like-wrap";
  const likeBtn = document.createElement("button");
  likeBtn.type = "button";
  likeBtn.className = "button-ghost button-small group-activity-like-btn";
  likeBtn.textContent = likeCount > 0 ? "👍 " + likeCount + " like" + (likeCount !== 1 ? "s" : "") : "👍 Like";
  likeBtn.dataset.likeCount = String(likeCount);
  likeBtn.dataset.eventId = a.id;
  likeBtn.dataset.createdBy = uid || "";
  likeBtn.setAttribute("aria-label", isLiked ? "Unlike" : "Like");
  if (isLiked) likeBtn.classList.add("group-activity-like-btn--liked");
  likeWrap.appendChild(likeBtn);
  contentWrap.appendChild(likeWrap);
  li.appendChild(avatarWrap);
  li.appendChild(contentWrap);
  activityEl.appendChild(li);
}

async function loadActivity(append) {
  if (!currentGroupId || !currentUser) return;
  const activityEl = document.getElementById("activityList");
  if (!activityEl) return;
  if (!append) {
    activityEl.innerHTML = "<li class=\"muted-text\">Loading…</li>";
    lastActivityDoc = null;
    hasMoreActivity = false;
  }
  try {
    const activityRef = collection(db, "groups", currentGroupId, "activity");
    let q;
    if (append && lastActivityDoc)
      q = query(activityRef, orderBy("createdAt", "desc"), startAfter(lastActivityDoc), limit(ACTIVITY_PAGE_SIZE));
    else
      q = query(activityRef, orderBy("createdAt", "desc"), limit(ACTIVITY_PAGE_SIZE));
    const snap = await getDocs(q);
    if (!append) activityEl.innerHTML = "";
    const activities = [];
    snap.forEach((d) => activities.push({ id: d.id, ...d.data(), _createdAt: d.data().createdAt }));
    activities.sort((a, b) => {
      const ta = a._createdAt && a._createdAt.toMillis ? a._createdAt.toMillis() : 0;
      const tb = b._createdAt && b._createdAt.toMillis ? b._createdAt.toMillis() : 0;
      return tb - ta;
    });
    activities.forEach((a) => renderActivityItem(a, activityEl));
    if (snap.docs.length > 0) lastActivityDoc = snap.docs[snap.docs.length - 1];
    hasMoreActivity = snap.docs.length === ACTIVITY_PAGE_SIZE;
    const loadMoreBtn = document.getElementById("activityLoadMore");
    if (loadMoreBtn) loadMoreBtn.style.display = hasMoreActivity ? "" : "none";
    if (!append && activities.length === 0) activityEl.innerHTML = "<li class=\"muted-text\">No activity yet.</li>";
  } catch (err) {
    console.error("[Group] loadActivity error", err);
    if (!append) activityEl.innerHTML = "<li class=\"muted-text\">Could not load activity.</li>";
  }
}

function initActivityLikeDelegation() {
  const activityList = document.getElementById("activityList");
  if (!activityList) return;
  activityList.addEventListener("click", async (e) => {
    const btn = e.target.closest(".group-activity-like-btn");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (!currentUser || !currentGroupId) {
      showError("You must be signed in to like.");
      return;
    }
    const eventId = btn.dataset.eventId;
    const createdBy = (btn.dataset.createdBy || "").trim();
    if (!eventId) return;
    const eventRef = doc(db, "groups", currentGroupId, "activity", eventId);
    try {
      btn.disabled = true;
      const snap = await getDoc(eventRef);
      if (!snap.exists()) {
        btn.disabled = false;
        return;
      }
      const data = snap.data();
      const likes = Array.isArray(data.likes) ? [...data.likes] : (Array.isArray(data.likedByUsers) ? [...data.likedByUsers] : []);
      const idx = likes.indexOf(currentUser.uid);
      if (idx >= 0) {
        await updateDoc(eventRef, { likes: arrayRemove(currentUser.uid) });
        likes.splice(idx, 1);
      } else {
        await updateDoc(eventRef, { likes: arrayUnion(currentUser.uid) });
        likes.push(currentUser.uid);
        if (createdBy && createdBy !== currentUser.uid) {
          await addDoc(collection(db, "users", createdBy, "notifications"), {
            type: "activity_like",
            fromUserId: currentUser.uid,
            groupId: currentGroupId,
            eventId,
            createdAt: serverTimestamp(),
          });
        }
      }
      const newCount = likes.length;
      btn.textContent = newCount > 0 ? "👍 " + newCount + " like" + (newCount !== 1 ? "s" : "") : "👍 Like";
      btn.dataset.likeCount = String(newCount);
      btn.classList.toggle("group-activity-like-btn--liked", likes.includes(currentUser.uid));
    } catch (err) {
      console.error("[Group] like error", err);
      showError("Could not update like.");
    } finally {
      btn.disabled = false;
    }
  });
}

function openInviteModal(code, expires) {
  const modal = document.getElementById("inviteModal");
  if (!modal || !code) return;
  document.getElementById("modalJoinCode").textContent = code;
  document.getElementById("modalExpires").textContent =
    expires && expires.toMillis ? "Expires " + new Date(expires.toMillis()).toLocaleString() : "";
  const url = getJoinUrl(code);
  document.getElementById("modalJoinUrl").textContent = url;
  const qrContainer = document.getElementById("modalQrContainer");
  qrContainer.innerHTML = "";
  if (window.QRCode) {
    try {
      new window.QRCode(qrContainer, { text: url, width: 160, height: 160 });
    } catch (err) {
      qrContainer.textContent = "QR unavailable";
    }
  }
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
}

function closeInviteModal() {
  const modal = document.getElementById("inviteModal");
  if (modal) {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
