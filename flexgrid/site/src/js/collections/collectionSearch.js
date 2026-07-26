/** Collection list search filter. */

export function initCollectionSearch() {
  const list = document.getElementById("collectionsList");
  const search = document.getElementById("collectionSearch");
  if (!search || !list) return;

  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    const grid = list.querySelector(".collection-grid");
    const cards = grid ? Array.from(grid.querySelectorAll(".collection-card")) : [];
    cards.forEach((el) => {
      const txt = (el.innerText || "").toLowerCase();
      el.style.display = !q || txt.includes(q) ? "" : "none";
    });
  });
}
