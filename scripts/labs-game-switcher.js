import {
  LABS_PLAYGROUND_GAMES,
  detectCurrentGameId,
  hrefForGame,
} from "./labs-games.js";

function buildSwitcher(currentId) {
  const wrap = document.createElement("div");
  wrap.className = "labs-game-switcher";
  wrap.dataset.labsGameSwitcher = "true";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "labs-game-switcher__arrow";
  prevBtn.dataset.labsGamePrev = "true";
  prevBtn.setAttribute("aria-label", "Previous game");
  prevBtn.textContent = "‹";

  const drop = document.createElement("div");
  drop.className = "labs-game-switcher__drop";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "labs-game-switcher__trigger";
  trigger.id = "labsGameSwitcherBtn";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  const label = document.createElement("span");
  label.className = "labs-game-switcher__label";
  const current = LABS_PLAYGROUND_GAMES.find((g) => g.id === currentId);
  label.textContent = current?.title || "Games";

  const chev = document.createElement("span");
  chev.className = "labs-game-switcher__chev";
  chev.setAttribute("aria-hidden", "true");
  chev.textContent = "▾";

  trigger.append(label, chev);

  const menu = document.createElement("ul");
  menu.className = "labs-game-switcher__menu";
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-labelledby", "labsGameSwitcherBtn");
  menu.hidden = true;

  for (const game of LABS_PLAYGROUND_GAMES) {
    const item = document.createElement("li");
    item.setAttribute("role", "presentation");

    const option = document.createElement("button");
    option.type = "button";
    option.className = "labs-game-switcher__option";
    option.setAttribute("role", "option");
    option.dataset.gameId = game.id;
    option.textContent = game.title;
    if (game.id === currentId) {
      option.classList.add("is-active");
      option.setAttribute("aria-selected", "true");
    } else {
      option.setAttribute("aria-selected", "false");
    }

    item.appendChild(option);
    menu.appendChild(item);
  }

  drop.append(trigger, menu);

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "labs-game-switcher__arrow";
  nextBtn.dataset.labsGameNext = "true";
  nextBtn.setAttribute("aria-label", "Next game");
  nextBtn.textContent = "›";

  wrap.append(prevBtn, drop, nextBtn);
  return wrap;
}

function setMenuOpen(menu, trigger, open) {
  menu.hidden = !open;
  trigger.setAttribute("aria-expanded", open ? "true" : "false");
}

function navigateTo(gameId) {
  if (gameId === detectCurrentGameId()) return;
  const href = hrefForGame(gameId);
  if (href) location.assign(href);
}

function navigateBy(delta) {
  const currentId = detectCurrentGameId();
  const idx = LABS_PLAYGROUND_GAMES.findIndex((g) => g.id === currentId);
  if (idx < 0) return;
  const next =
    LABS_PLAYGROUND_GAMES[
      (idx + delta + LABS_PLAYGROUND_GAMES.length) % LABS_PLAYGROUND_GAMES.length
    ];
  navigateTo(next.id);
}

function findSwitcherMount() {
  const shell = document.querySelector(".labs-game-shell");
  if (!shell) return null;
  return shell.querySelector(".lo-playground__card");
}

function initLabsGameSwitcher() {
  const mount = findSwitcherMount();
  if (!mount || mount.querySelector("[data-labs-game-switcher]")) return;

  const currentId = detectCurrentGameId();
  if (!currentId) return;

  const switcher = buildSwitcher(currentId);
  mount.insertBefore(switcher, mount.firstChild);

  const menu = switcher.querySelector(".labs-game-switcher__menu");
  const trigger = switcher.querySelector(".labs-game-switcher__trigger");

  switcher.querySelector("[data-labs-game-prev]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    navigateBy(-1);
  });

  switcher.querySelector("[data-labs-game-next]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    navigateBy(1);
  });

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    setMenuOpen(menu, trigger, menu.hidden);
  });

  menu.querySelectorAll(".labs-game-switcher__option").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      navigateTo(btn.dataset.gameId);
    });
  });

  document.addEventListener("click", (e) => {
    if (!switcher.contains(e.target)) {
      setMenuOpen(menu, trigger, false);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      setMenuOpen(menu, trigger, false);
    }
  });
}

export { initLabsGameSwitcher };

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLabsGameSwitcher);
} else {
  initLabsGameSwitcher();
}
