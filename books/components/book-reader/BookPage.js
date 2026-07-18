(function (global) {
  "use strict";
  var LoBookReader = (global.LoBookReader = global.LoBookReader || {});

  LoBookReader.BookPage = {
    create: function (opts) {
      var page = document.createElement("div");
      page.className = "book-page" + (opts.extraClass ? " " + opts.extraClass : "");
      page.dataset.pageIndex = String(opts.index);

      var stack = document.createElement("div");
      stack.className = "book-page__stack";

      var under = document.createElement("div");
      under.className = "book-page__under";
      under.hidden = true;
      under.setAttribute("aria-hidden", "true");

      var underImg = document.createElement("img");
      underImg.className = "book-page__under-img";
      underImg.alt = "";
      underImg.draggable = false;
      underImg.decoding = "async";
      under.appendChild(underImg);

      var frame = document.createElement("div");
      frame.className = "book-page__frame";

      var img = document.createElement("img");
      img.className = "book-page__img";
      img.alt = opts.alt || "";
      img.draggable = false;
      img.decoding = "async";
      if (opts.src) img.src = opts.src;

      var loading = document.createElement("div");
      loading.className = "book-page__loading";
      loading.hidden = !!opts.src;
      loading.textContent = "Opening your book…";

      var error = document.createElement("div");
      error.className = "book-page__error";
      error.hidden = true;
      error.innerHTML =
        '<p>This page could not be loaded. Please try again.</p>' +
        '<button type="button" class="home-btn home-btn--secondary book-page__retry">Retry</button>';

      frame.appendChild(img);
      frame.appendChild(loading);
      frame.appendChild(error);
      stack.appendChild(under);
      stack.appendChild(frame);
      page.appendChild(stack);

      return {
        el: page,
        stack: stack,
        under: under,
        underImg: underImg,
        img: img,
        loading: loading,
        error: error,
        retryBtn: error.querySelector(".book-page__retry"),
        setSrc: function (src) {
          if (!src) return;
          loading.hidden = false;
          error.hidden = true;
          img.hidden = true;
          img.src = src;
        },
        markLoaded: function () {
          loading.hidden = true;
          error.hidden = true;
          img.hidden = false;
        },
        markError: function () {
          loading.hidden = true;
          error.hidden = false;
          img.hidden = true;
        },
        showBlank: function () {
          loading.hidden = true;
          error.hidden = true;
          img.hidden = true;
          img.removeAttribute("src");
          page.classList.add("is-blank");
        },
        showPage: function () {
          page.classList.remove("is-blank");
        },
        showUnderlayBlank: function () {
          under.hidden = false;
          under.classList.add("is-blank");
          underImg.hidden = true;
          underImg.removeAttribute("src");
        },
        setUnderlay: function (src, alt) {
          under.hidden = false;
          under.classList.remove("is-blank");
          underImg.alt = alt || "";
          if (src) {
            underImg.hidden = false;
            underImg.src = src;
          } else {
            underImg.hidden = true;
            underImg.removeAttribute("src");
          }
        },
        hideUnderlay: function () {
          under.hidden = true;
          under.classList.remove("is-blank");
          underImg.hidden = true;
          underImg.removeAttribute("src");
        },
      };
    },
  };
})(window);
