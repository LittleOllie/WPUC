document.addEventListener("DOMContentLoaded", function () {
  const enterCurtain = document.getElementById("playground-enter-curtain");
  let fromHome = false;

  try {
    fromHome = sessionStorage.getItem("lo-playground-enter") === "1";
    if (fromHome) sessionStorage.removeItem("lo-playground-enter");
  } catch {
    /* ignore */
  }

  if (enterCurtain) {
    if (fromHome) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      enterCurtain.hidden = false;

      const removeCurtain = () => enterCurtain.remove();

      if (reduced) {
        removeCurtain();
      } else {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            enterCurtain.classList.add("is-fading");
            enterCurtain.classList.add("playground-enter-curtain--fade");
          });
        });
        enterCurtain.addEventListener("transitionend", removeCurtain, { once: true });
        setTimeout(removeCurtain, 900);
      }
    } else {
      enterCurtain.remove();
    }
  }

  const categoryButtons = document.querySelectorAll("[data-category]");
  const categoryPanels = document.querySelectorAll("[data-category-panel]");
  const validCategories = new Set(["games", "nft", "creative", "community"]);

  function setActiveCard(categoryId) {
    categoryButtons.forEach((btn) => {
      const isActive = categoryId && btn.dataset.category === categoryId;
      btn.setAttribute("aria-expanded", isActive ? "true" : "false");
      btn.classList.toggle("lab-card--active", isActive);
      btn.classList.toggle("lo-playground__lab--active", isActive);
    });
  }

  function openCategory(categoryId, opts) {
    const options = opts || {};
    const panel = document.querySelector(`[data-category-panel="${categoryId}"]`);
    if (!panel) return;

    const alreadyOpen = !panel.hidden;
    const forceOpen = options.forceOpen === true;
    const skipHash = options.skipHash === true;

    categoryPanels.forEach((p) => {
      p.hidden = true;
    });

    if (alreadyOpen && !forceOpen) {
      setActiveCard(null);
      if (!skipHash && window.history && window.history.replaceState) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      return;
    }

    panel.hidden = false;
    setActiveCard(categoryId);

    if (!skipHash && window.history && window.history.replaceState) {
      window.history.replaceState(null, "", "#" + categoryId);
    }

    if (options.scroll !== false) {
      panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function openFromHash() {
    const hash = (window.location.hash || "").replace(/^#/, "").toLowerCase();
    if (!hash || !validCategories.has(hash)) return;
    openCategory(hash, { forceOpen: true, scroll: true, skipHash: true });
  }

  categoryButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const categoryId = btn.dataset.category;
      if (categoryId) openCategory(categoryId);
    });
  });

  window.addEventListener("hashchange", openFromHash);
  openFromHash();
});
