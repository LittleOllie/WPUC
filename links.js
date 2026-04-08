// Links hub — one-time wiring for navigation + debug logging
document.addEventListener("DOMContentLoaded", function () {
  const gamesLink = document.getElementById("gamesLink");
  if (gamesLink) {
    gamesLink.addEventListener("click", function () {
      console.log("Game button clicked");
    });
  }
});
