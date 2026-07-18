(function (global) {
  "use strict";
  var LoBookReader = (global.LoBookReader = global.LoBookReader || {});

  LoBookReader.BookCover = {
    create: function (root) {
      var cover = document.createElement("div");
      cover.className = "book-cover-state";

      var shell = document.createElement("div");
      shell.className = "book-cover-state__shell";

      var front = document.createElement("button");
      front.type = "button";
      front.className = "book-cover-state__front";
      front.setAttribute("aria-label", "Open book");

      var img = document.createElement("img");
      img.className = "book-cover-state__img";
      img.alt = "";
      img.draggable = false;
      img.decoding = "async";

      front.appendChild(img);

      var startBtn = document.createElement("button");
      startBtn.type = "button";
      startBtn.className = "home-btn home-btn--primary book-cover-state__start";
      startBtn.innerHTML =
        '<span class="book-cover-state__start-icon" aria-hidden="true">↑</span>' +
        "<span class=\"book-cover-state__start-text\">Press the cover to start reading</span>";

      shell.appendChild(front);
      cover.appendChild(shell);
      cover.appendChild(startBtn);
      root.appendChild(cover);

      return {
        el: cover,
        front: front,
        startBtn: startBtn,
        img: img,
        setCover: function (src, alt) {
          img.src = src;
          img.alt = alt || "";
        },
        setOpen: function (opening) {
          cover.classList.toggle("is-opening", opening);
          cover.classList.toggle("is-open", false);
          startBtn.hidden = opening;
        },
        hide: function () {
          cover.hidden = true;
        },
        show: function () {
          cover.hidden = false;
        },
      };
    },
  };
})(window);
