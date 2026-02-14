document.getElementById("enterBtn").addEventListener("click", () => {
    document.body.style.transition = "opacity 0.5s";
    document.body.style.opacity = "0";
    
    setTimeout(() => {
        window.location.href = "game.html";
    }, 500);
});
