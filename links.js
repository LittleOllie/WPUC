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

  function setActiveCard(categoryId) {
    categoryButtons.forEach((btn) => {
      const isActive = categoryId && btn.dataset.category === categoryId;
      btn.setAttribute("aria-expanded", isActive ? "true" : "false");
      btn.classList.toggle("lab-card--active", isActive);
    });
  }

  function openCategory(categoryId) {
    const panel = document.querySelector(`[data-category-panel="${categoryId}"]`);
    if (!panel) return;

    const isOpen = !panel.hidden;

    categoryPanels.forEach((p) => {
      p.hidden = true;
    });

    if (isOpen) {
      setActiveCard(null);
      return;
    }

    panel.hidden = false;
    setActiveCard(categoryId);
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  categoryButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const categoryId = btn.dataset.category;
      if (categoryId) openCategory(categoryId);
    });
  });
});
