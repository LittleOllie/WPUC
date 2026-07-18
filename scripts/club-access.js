/**
 * Little Ollie Club access — set PUBLIC to true when the member area is ready to launch.
 */
window.LO_CLUB = {
  PUBLIC: false,
};

window.LO_CLUB.guard = function guardClubAccess() {
  if (window.LO_CLUB.PUBLIC) return;

  var parts = window.location.pathname.split("/");
  var clubIndex = parts.indexOf("little-ollie-club");

  if (clubIndex === -1) {
    document.documentElement.classList.add("club-closed");
    return;
  }

  var afterClub = parts.slice(clubIndex + 1).filter(Boolean);
  var depth = afterClub.length || 1;
  window.location.replace("../".repeat(depth) + "index.html#home");
};

window.LO_CLUB.guard();
