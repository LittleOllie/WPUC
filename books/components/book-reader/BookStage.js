(function (global) {
  "use strict";
  var LoBookReader = (global.LoBookReader = global.LoBookReader || {});

  LoBookReader.BookStage = {
    create: function (root) {
      var stage = document.createElement("section");
      stage.className = "book-stage";
      stage.setAttribute("aria-label", "Book pages");

      var glow = document.createElement("div");
      glow.className = "book-stage__glow";
      glow.setAttribute("aria-hidden", "true");

      var desk = document.createElement("div");
      desk.className = "book-stage__desk";
      desk.setAttribute("aria-hidden", "true");

      var book = document.createElement("div");
      book.className = "book-stage__book";

      var shadow = document.createElement("div");
      shadow.className = "book-stage__shadow";
      shadow.setAttribute("aria-hidden", "true");

      book.appendChild(shadow);
      stage.appendChild(glow);
      stage.appendChild(desk);
      stage.appendChild(book);
      root.appendChild(stage);

      var cover = LoBookReader.BookCover.create(book);
      var spread = LoBookReader.BookSpread.create(book);

      var loading = document.createElement("div");
      loading.className = "book-stage__loading";
      loading.innerHTML = '<p>Opening your book…</p>';
      stage.appendChild(loading);

      return {
        el: stage,
        book: book,
        cover: cover,
        spread: spread,
        loading: loading,
        showLoading: function (show) {
          loading.hidden = !show;
        },
      };
    },
  };
})(window);
