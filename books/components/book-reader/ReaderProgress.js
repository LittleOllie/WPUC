(function (global) {
  "use strict";
  var LoBookReader = (global.LoBookReader = global.LoBookReader || {});

  LoBookReader.ReaderProgress = {
    create: function (root) {
      var wrap = document.createElement("div");
      wrap.className = "book-reader__progress-wrap";

      var label = document.createElement("p");
      label.className = "book-reader__progress-label";
      label.id = "book-reader-progress-label";

      var bar = document.createElement("div");
      bar.className = "book-reader__progress";
      bar.setAttribute("role", "progressbar");
      bar.setAttribute("aria-valuemin", "0");
      bar.setAttribute("aria-valuemax", "100");
      bar.setAttribute("aria-valuenow", "0");
      bar.setAttribute("aria-labelledby", "book-reader-progress-label");

      var fill = document.createElement("div");
      fill.className = "book-reader__progress-fill";
      bar.appendChild(fill);

      wrap.appendChild(label);
      wrap.appendChild(bar);
      root.appendChild(wrap);

      var live = document.createElement("div");
      live.className = "book-reader__sr-status";
      live.setAttribute("role", "status");
      live.setAttribute("aria-live", "polite");
      live.setAttribute("aria-atomic", "true");
      root.appendChild(live);

      return {
        el: wrap,
        label: label,
        fill: fill,
        bar: bar,
        live: live,
        update: function (text, ratio) {
          label.textContent = text;
          var pct = Math.round(ratio * 100);
          fill.style.width = pct + "%";
          bar.setAttribute("aria-valuenow", String(pct));
        },
        announce: function (text) {
          live.textContent = text;
        },
      };
    },
  };
})(window);
