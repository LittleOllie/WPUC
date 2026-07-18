(function (global) {
  "use strict";
  var LoBookReader = (global.LoBookReader = global.LoBookReader || {});

  LoBookReader.ReaderEndScreen = {
    create: function (root, opts) {
      var end = document.createElement("section");
      end.className = "book-reader__end";
      end.hidden = true;
      end.setAttribute("aria-label", "End of book");

      end.innerHTML =
        '<div class="book-reader__end-sparks" aria-hidden="true"></div>' +
        "<h2>You finished the story!</h2>" +
        "<p>Thank you for reading " +
        (opts.title || "this book") +
        ".</p>" +
        '<div class="book-reader__end-actions">' +
        '<button type="button" class="home-btn home-btn--primary" data-end-action="again">Read Again</button>' +
        '<a class="home-btn home-btn--secondary" data-end-action="library" href="' +
        (opts.libraryUrl || "../../index.html#club-library") +
        '">Back to the Library</a>' +
        (opts.amazonUrl
          ? '<a class="home-btn home-btn--ghost" data-end-action="buy" href="' +
            opts.amazonUrl +
            '" rel="noopener noreferrer" target="_blank">Buy the Book</a>'
          : "") +
        '<a class="home-btn home-btn--ghost" data-end-action="activities" href="' +
        (opts.activitiesUrl || "../../index.html#club-activities") +
        '">Explore Activities</a>' +
        "</div>";

      root.appendChild(end);

      return {
        el: end,
        show: function () {
          end.hidden = false;
        },
        hide: function () {
          end.hidden = true;
        },
        againBtn: end.querySelector('[data-end-action="again"]'),
      };
    },
  };
})(window);
