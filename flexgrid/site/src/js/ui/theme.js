/** Theme toggle (light / dark). */

const THEME_KEY = "lo_theme";

export function initThemeToggle() {
  const wrap = document.getElementById("themeToggleWrap");
  if (!wrap) return;

  const updateState = () => {
    wrap.classList.toggle("dark", document.body.classList.contains("dark"));
    wrap.setAttribute("aria-checked", document.body.classList.contains("dark") ? "true" : "false");
  };

  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark") {
    document.body.classList.add("dark");
  } else if (saved === "light") {
    document.body.classList.remove("dark");
  } else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    document.body.classList.add("dark");
  }
  updateState();

  const toggle = () => {
    document.body.classList.toggle("dark");
    localStorage.setItem(THEME_KEY, document.body.classList.contains("dark") ? "dark" : "light");
    updateState();
  };

  wrap.addEventListener("click", toggle);
  wrap.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggle();
    }
  });
}
