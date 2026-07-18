(function (global) {
  "use strict";
  var LoBookReader = (global.LoBookReader = global.LoBookReader || {});

  LoBookReader.ReaderControls = {
    create: function (root) {
      var controls = document.createElement("div");
      controls.className = "book-reader__controls";

      var prev = document.createElement("button");
      prev.type = "button";
      prev.className = "book-reader__nav book-reader__nav--prev home-btn home-btn--primary";
      prev.innerHTML = "<span aria-hidden=\"true\">←</span> Previous";
      prev.setAttribute("aria-label", "Previous page");

      var next = document.createElement("button");
      next.type = "button";
      next.className = "book-reader__nav book-reader__nav--next home-btn home-btn--primary";
      next.innerHTML = "Next <span aria-hidden=\"true\">→</span>";
      next.setAttribute("aria-label", "Next page");

      controls.appendChild(prev);
      controls.appendChild(next);
      root.appendChild(controls);

      return {
        el: controls,
        prev: prev,
        next: next,
        setDisabled: function (which, disabled) {
          var btn = which === "prev" ? prev : next;
          btn.disabled = disabled;
          btn.setAttribute("aria-disabled", disabled ? "true" : "false");
        },
      };
    },
  };
})(window);
