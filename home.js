document.addEventListener("DOMContentLoaded", function () {
  const enterBtn = document.getElementById("enterBtn");
  if (!enterBtn) return;

  enterBtn.addEventListener("click", () => {
    document.body.style.transition = "opacity 0.5s";
    document.body.style.opacity = "0";

    setTimeout(() => {
      window.location.href = "links.html";
    }, 500);
  });
});
