(function () {
  "use strict";

  var root = document.querySelector(".labs-site");
  if (!root) return;

  var header = root.querySelector("[data-labs-header]");
  var menuBtn = root.querySelector("[data-labs-menu-btn]");
  var menuPanel = root.querySelector("[data-labs-menu]");
  var form = root.querySelector("[data-labs-enquiry-form]");
  var contactSection = root.querySelector("#contact");

  /* Match snap math to real header height */
  function syncHeaderHeight() {
    if (!header) return;
    document.documentElement.style.setProperty(
      "--labs-header-h",
      header.offsetHeight + "px"
    );
  }

  /* Sticky header shadow */
  if (header) {
    syncHeaderHeight();
    if ("ResizeObserver" in window) {
      new ResizeObserver(syncHeaderHeight).observe(header);
    } else {
      window.addEventListener("resize", syncHeaderHeight, { passive: true });
    }

    var onScroll = function () {
      header.classList.toggle("labs-header--scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* Active section nav highlight */
  var navLinks = root.querySelectorAll("[data-labs-nav-link]");
  var navSectionIds = ["top", "work", "what-we-do", "about", "contact"];

  function getActiveSectionId() {
    var headerOffset = header ? header.offsetHeight + Math.min(window.innerHeight * 0.32, 220) : 120;
    var activeId = navSectionIds[0];

    navSectionIds.forEach(function (id) {
      var section = root.querySelector("#" + id);
      if (!section) return;
      if (section.getBoundingClientRect().top <= headerOffset) {
        activeId = id;
      }
    });

    return activeId;
  }

  function setActiveNav(sectionId) {
    navLinks.forEach(function (link) {
      var href = link.getAttribute("href") || "";
      var linkId = href.charAt(0) === "#" ? href.slice(1) : "";
      var isActive = linkId === sectionId;
      link.classList.toggle("labs-nav__link--active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function updateActiveNav() {
    setActiveNav(getActiveSectionId());
  }

  updateActiveNav();
  window.addEventListener("scroll", updateActiveNav, { passive: true });
  window.addEventListener("resize", updateActiveNav, { passive: true });
  window.addEventListener("hashchange", updateActiveNav);

  /* Mobile menu */
  function setMenuOpen(open) {
    if (!menuBtn || !menuPanel) return;
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    menuBtn.setAttribute(
      "aria-label",
      open ?
        menuBtn.getAttribute("data-labs-menu-label-close") || "Close menu" :
        menuBtn.getAttribute("data-labs-menu-label-open") || "Open menu"
    );
    menuPanel.hidden = !open;
    root.classList.toggle("labs-site--menu-open", open);
    if (open) {
      var first = menuPanel.querySelector("a, button");
      if (first) first.focus();
    }
  }

  if (menuBtn && menuPanel) {
    menuBtn.addEventListener("click", function () {
      var open = menuBtn.getAttribute("aria-expanded") !== "true";
      setMenuOpen(open);
    });

    menuPanel.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        setMenuOpen(false);
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menuBtn.getAttribute("aria-expanded") === "true") {
        setMenuOpen(false);
        menuBtn.focus();
      }
    });
  }

  /* Smooth anchor scroll (respect reduced motion) */
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function scrollToContact(focusForm) {
    if (!contactSection) return;
    if (menuBtn && menuBtn.getAttribute("aria-expanded") === "true") {
      setMenuOpen(false);
    }
    contactSection.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
    history.replaceState(null, "", "#contact");
    updateActiveNav();
    if (focusForm && form) {
      window.setTimeout(function () {
        var firstField = form.querySelector("#labs-form-name");
        if (firstField) firstField.focus();
      }, reduceMotion ? 0 : 320);
    }
  }

  root.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      if (anchor.hasAttribute("data-labs-open-form")) {
        e.preventDefault();
        scrollToContact(true);
        return;
      }
      var id = anchor.getAttribute("href");
      if (!id || id === "#") return;
      var target = root.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
      history.replaceState(null, "", id);
      updateActiveNav();
    });
  });

  /* Contact enquiry form — Formspree-ready (no secrets in repo) */
  var LABS_FORM_ENDPOINT = "";
  if (window.LABS_FORM_CONFIG && window.LABS_FORM_CONFIG.endpoint) {
    LABS_FORM_ENDPOINT = String(window.LABS_FORM_CONFIG.endpoint).trim();
  }

  if (form) {
    var formSuccess = root.querySelector("[data-labs-form-success]");
    var formStatus = root.querySelector("[data-labs-form-status]");
    var formSubmit = form.querySelector("[data-labs-form-submit]");
    var submitLabel =
      (formSubmit && formSubmit.getAttribute("data-labs-form-submit-label")) ||
      "Send the idea →";
    var honeypot = form.querySelector('input[name="_gotcha"]');
    var nameInput = form.querySelector("#labs-form-name");
    var emailInput = form.querySelector("#labs-form-email");
    var ideaInput = form.querySelector("#labs-form-idea");
    var projectChecks = form.querySelectorAll('input[name="Services Selected"]');

    function hideFormStatus() {
      if (!formStatus) return;
      formStatus.hidden = true;
      formStatus.textContent = "";
      formStatus.classList.remove("labs-form__status--error", "labs-form__status--pending");
    }

    function showFormStatus(type, message) {
      if (!formStatus) return;
      formStatus.hidden = false;
      formStatus.textContent = message;
      formStatus.classList.remove("labs-form__status--error", "labs-form__status--pending");
      formStatus.classList.add(type === "error" ? "labs-form__status--error" : "labs-form__status--pending");
    }

    function setSubmitting(isSubmitting) {
      if (!formSubmit) return;
      formSubmit.disabled = isSubmitting;
      formSubmit.textContent = isSubmitting ? "Sending..." : submitLabel;
      formSubmit.setAttribute("aria-busy", isSubmitting ? "true" : "false");
    }

    function clearFieldErrors() {
      form.querySelectorAll(".labs-form__error").forEach(function (el) {
        el.hidden = true;
        el.textContent = "";
      });
      form.querySelectorAll('[aria-invalid="true"]').forEach(function (el) {
        el.removeAttribute("aria-invalid");
      });
      var fieldset = form.querySelector('[data-labs-field="project_type"]');
      if (fieldset) fieldset.removeAttribute("aria-invalid");
    }

    function setFieldError(fieldKey, message) {
      var errorEl = form.querySelector("#labs-form-error-" + fieldKey.replace(/_/g, "-"));
      var fieldWrap = form.querySelector('[data-labs-field="' + fieldKey + '"]');
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = message;
      }
      if (fieldKey === "project_type") {
        if (fieldWrap) {
          fieldWrap.setAttribute("aria-invalid", "true");
          if (errorEl) fieldWrap.setAttribute("aria-describedby", errorEl.id);
        }
        return;
      }
      var input = fieldWrap && fieldWrap.querySelector("input, textarea, select");
      if (input) {
        input.setAttribute("aria-invalid", "true");
        if (errorEl) input.setAttribute("aria-describedby", errorEl.id);
      }
    }

    function isValidEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    function getSelectedProjectTypes() {
      var selected = [];
      projectChecks.forEach(function (check) {
        if (check.checked) selected.push(check.value);
      });
      return selected;
    }

    function validateEnquiryForm() {
      clearFieldErrors();
      hideFormStatus();
      var valid = true;

      var name = nameInput ? nameInput.value.trim() : "";
      var email = emailInput ? emailInput.value.trim() : "";
      var idea = ideaInput ? ideaInput.value.trim() : "";

      if (!name) {
        setFieldError("name", "Please add your name.");
        valid = false;
      }

      if (!email) {
        setFieldError("email", "Please add your email address.");
        valid = false;
      } else if (!isValidEmail(email)) {
        setFieldError("email", "Please enter a valid email address.");
        valid = false;
      }

      if (!getSelectedProjectTypes().length) {
        setFieldError("project_type", "Pick at least one option — or choose Not Sure Yet.");
        valid = false;
      }

      if (!idea) {
        setFieldError("idea", "Tell us a little about what you're thinking.");
        valid = false;
      }

      return valid;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      if (honeypot && honeypot.value.trim()) {
        return;
      }

      if (!validateEnquiryForm()) {
        var firstInvalid = form.querySelector('[aria-invalid="true"]');
        if (firstInvalid) {
          var focusTarget =
            firstInvalid.matches("input, textarea, select") ?
              firstInvalid :
              firstInvalid.querySelector("input, textarea, select");
          if (focusTarget) focusTarget.focus();
        }
        return;
      }

      if (!LABS_FORM_ENDPOINT) {
        showFormStatus("error", "Email delivery still needs to be connected.");
        return;
      }

      setSubmitting(true);
      showFormStatus("pending", "Sending your idea…");

      var formData = new FormData(form);
      formData.set("_replyto", emailInput ? emailInput.value.trim() : "");

      var submissionSucceeded = false;

      fetch(LABS_FORM_ENDPOINT, {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
      })
        .then(function (response) {
          return response
            .json()
            .catch(function () {
              return {};
            })
            .then(function (data) {
              return { ok: response.ok, data: data };
            });
        })
        .then(function (result) {
          if (!result.ok) {
            throw new Error(result.data && result.data.error ? result.data.error : "Submission failed");
          }
          submissionSucceeded = true;
          form.hidden = true;
          hideFormStatus();
          if (formSuccess) {
            formSuccess.hidden = false;
            formSuccess.querySelector(".labs-form-success__title").focus();
          }
        })
        .catch(function () {
          showFormStatus(
            "error",
            "Something didn't quite work. Please try again, or email us directly."
          );
        })
        .finally(function () {
          if (!submissionSucceeded) setSubmitting(false);
        });
    });

    projectChecks.forEach(function (check) {
      check.addEventListener("change", function () {
        if (getSelectedProjectTypes().length) {
          var errorEl = form.querySelector("#labs-form-error-project-type");
          var fieldset = form.querySelector('[data-labs-field="project_type"]');
          if (errorEl) {
            errorEl.hidden = true;
            errorEl.textContent = "";
          }
          if (fieldset) fieldset.removeAttribute("aria-invalid");
        }
      });
    });
  }

  /* Gentle section reveal */
  if (!reduceMotion && "IntersectionObserver" in window) {
    var revealEls = root.querySelectorAll(".labs-reveal");
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("labs-reveal--visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    revealEls.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    root.querySelectorAll(".labs-reveal").forEach(function (el) {
      el.classList.add("labs-reveal--visible");
    });
  }

  /* Work carousel — center focus with side previews */
  var workCarousel = root.querySelector("[data-labs-work-carousel]");
  if (workCarousel) {
    var workTrack = workCarousel.querySelector("[data-labs-work-track]");
    var workPrev = workCarousel.querySelector("[data-labs-work-prev]");
    var workNext = workCarousel.querySelector("[data-labs-work-next]");
    var workCount = workCarousel.querySelector("[data-labs-work-count]");
    var workCards = workTrack ? workTrack.querySelectorAll(".labs-work-card") : [];
    var workIndex = 0;
    var workTouchStartX = 0;

    function setWorkCarouselIndex(nextIndex) {
      if (!workCards.length) return;

      var total = workCards.length;
      workIndex = ((nextIndex % total) + total) % total;

      workCards.forEach(function (card, i) {
        var diff = i - workIndex;

        if (diff > total / 2) diff -= total;
        if (diff < -total / 2) diff += total;

        var state = "off";
        if (diff === 0) state = "active";
        else if (diff === -1) state = "prev";
        else if (diff === 1) state = "next";

        card.setAttribute("data-carousel-state", state);
      });

      if (workCount) workCount.textContent = workIndex + 1 + " / " + total;
    }

    function stepWorkCarousel(direction) {
      setWorkCarouselIndex(workIndex + direction);
    }

    if (workPrev) {
      workPrev.addEventListener("click", function () {
        stepWorkCarousel(-1);
      });
    }

    if (workNext) {
      workNext.addEventListener("click", function () {
        stepWorkCarousel(1);
      });
    }

    workCards.forEach(function (card, i) {
      card.addEventListener("click", function (e) {
        var state = card.getAttribute("data-carousel-state");
        if (state === "prev" || state === "next") {
          e.preventDefault();
          setWorkCarouselIndex(i);
        }
      });
    });

    if (workTrack) {
      workTrack.addEventListener(
        "touchstart",
        function (e) {
          workTouchStartX = e.changedTouches[0].clientX;
        },
        { passive: true }
      );

      workTrack.addEventListener(
        "touchend",
        function (e) {
          var delta = e.changedTouches[0].clientX - workTouchStartX;
          if (Math.abs(delta) < 40) return;
          stepWorkCarousel(delta > 0 ? -1 : 1);
        },
        { passive: true }
      );
    }

    setWorkCarouselIndex(0);
  }

  /* Strip logos — show image when loaded, text fallback until then */
  root.querySelectorAll(".labs-strip__mark").forEach(function (mark) {
    var img = mark.querySelector("img");
    if (!img) return;
    function showLogo() {
      if (img.naturalWidth > 0) mark.classList.add("labs-strip__mark--loaded");
    }
    function hideLogo() {
      mark.classList.remove("labs-strip__mark--loaded");
    }
    if (img.complete) showLogo();
    else img.addEventListener("load", showLogo);
    img.addEventListener("error", hideLogo);
  });

  /* Asset placeholders — show label when image missing */
  root.querySelectorAll("[data-labs-asset]").forEach(function (wrap) {
    var img = wrap.querySelector("img");
    if (!img) return;
    function markMissing() {
      wrap.classList.add("labs-asset--missing");
    }
    if (img.complete && img.naturalWidth === 0) markMissing();
    img.addEventListener("error", markMissing);
  });
})();
