(function (global) {
  "use strict";
  var LoBookReader = (global.LoBookReader = global.LoBookReader || {});

  LoBookReader.BookSpread = {
    create: function (root) {
      var spread = document.createElement("div");
      spread.className = "book-spread";
      spread.hidden = true;

      var shell = document.createElement("div");
      shell.className = "book-spread__shell";

      var leftSlot = document.createElement("div");
      leftSlot.className = "book-spread__page book-spread__page--left";

      var spine = document.createElement("div");
      spine.className = "book-spread__spine";
      spine.setAttribute("aria-hidden", "true");

      var rightSlot = document.createElement("div");
      rightSlot.className = "book-spread__page book-spread__page--right";

      var turnLayer = document.createElement("div");
      turnLayer.className = "book-spread__turn";
      turnLayer.setAttribute("aria-hidden", "true");

      shell.appendChild(leftSlot);
      shell.appendChild(spine);
      shell.appendChild(rightSlot);
      shell.appendChild(turnLayer);
      spread.appendChild(shell);

      root.appendChild(spread);

      return {
        el: spread,
        leftSlot: leftSlot,
        rightSlot: rightSlot,
        turnLayer: turnLayer,
        show: function () {
          spread.hidden = false;
        },
        hide: function () {
          spread.hidden = true;
        },
        setSingleMode: function (single) {
          spread.classList.toggle("is-single", single);
        },
        setLastSpread: function (last) {
          spread.classList.toggle("is-last-spread", last);
        },
      };
    },
  };
})(window);
