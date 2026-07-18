/**
 * Creative Lab — renders coloring page cards from coloring-pages.json
 */
(function () {
  "use strict";

  var MANIFEST_URL = "coloring-pages.json";
  var gridEl = document.getElementById("creativePagesGrid");
  var statusEl = document.getElementById("creativePagesStatus");

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fileLabel(filePath) {
    var ext = (filePath.split(".").pop() || "").toUpperCase();
    if (ext === "PDF") return "PDF printable";
    if (ext === "PNG" || ext === "JPG" || ext === "JPEG" || ext === "WEBP") return "Image printable";
    return "Download";
  }

  function renderEmpty() {
    if (!gridEl) return;
    gridEl.innerHTML =
      '<li class="creative-lab__empty">' +
      "<strong>Pages coming soon</strong>" +
      "New coloring pages will show up here automatically. " +
      "Drop a PDF or PNG into <code>creative-lab/pages/</code>, " +
      "then add an entry to <code>coloring-pages.json</code>." +
      "</li>";
  }

  function renderError(message) {
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.hidden = false;
    }
    renderEmpty();
  }

  function renderPage(page) {
    if (!page || !page.title || !page.file) return "";

    var file = escapeHtml(page.file);
    var title = escapeHtml(page.title);
    var desc = page.description ? escapeHtml(page.description) : "";
    var meta = fileLabel(page.file);
    var downloadName = page.downloadName ? escapeHtml(page.downloadName) : "";

    var thumbHtml = page.thumb
      ? '<img class="creative-page-card__thumb" src="' +
        escapeHtml(page.thumb) +
        '" alt="" loading="lazy" decoding="async" />'
      : '<span class="creative-page-card__thumb-placeholder" aria-hidden="true">🎨</span>';

    var previewSrc = escapeHtml(page.thumb || page.file);

    return (
      '<li class="creative-page-card">' +
      '<button type="button" class="creative-page-card__preview" data-preview-src="' +
      previewSrc +
      '" data-preview-title="' +
      title +
      '" aria-label="View larger: ' +
      title +
      '">' +
      '<span class="creative-page-card__thumb-wrap">' +
      thumbHtml +
      '<span class="creative-page-card__zoom-hint" aria-hidden="true">Tap to enlarge</span>' +
      "</span>" +
      "</button>" +
      '<div class="creative-page-card__body">' +
      "<h3 class=\"creative-page-card__title\">" +
      title +
      "</h3>" +
      (desc ? '<p class="creative-page-card__desc">' + desc + "</p>" : "") +
      '<p class="creative-page-card__meta">' +
      meta +
      "</p>" +
      '<a class="creative-btn creative-btn--yellow" href="' +
      file +
      '"' +
      (downloadName ? ' download="' + downloadName + '"' : " download") +
      ' target="_blank" rel="noopener">Download</a>' +
      "</div>" +
      "</li>"
    );
  }

  function renderPages(pages) {
    if (!gridEl) return;

    if (!pages.length) {
      renderEmpty();
      return;
    }

    gridEl.innerHTML = pages.map(renderPage).join("");
    if (statusEl) statusEl.hidden = true;
    bindPreviewLightbox();
  }

  var previewEl = null;
  var previewImg = null;
  var previewTitle = null;
  var previewLastFocus = null;

  function getPreviewElements() {
    if (!previewEl) {
      previewEl = document.getElementById("creativePreview");
      previewImg = document.getElementById("creativePreviewImg");
      previewTitle = document.getElementById("creativePreviewTitle");
    }
    return previewEl && previewImg && previewTitle;
  }

  function closePreview() {
    if (!getPreviewElements() || previewEl.classList.contains("hidden")) return;
    previewEl.classList.add("hidden");
    previewEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("creative-preview-open");
    if (previewImg) previewImg.removeAttribute("src");
    if (previewLastFocus && typeof previewLastFocus.focus === "function") {
      try {
        previewLastFocus.focus();
      } catch (_) {}
    }
    previewLastFocus = null;
  }

  function openPreview(src, title) {
    if (!getPreviewElements() || !src) return;
    previewLastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    previewImg.src = src;
    previewImg.alt = title || "Coloring page preview";
    previewTitle.textContent = title || "Coloring page";
    previewEl.classList.remove("hidden");
    previewEl.setAttribute("aria-hidden", "false");
    document.body.classList.add("creative-preview-open");
    var closeBtn = previewEl.querySelector(".creative-preview__close");
    if (closeBtn && typeof closeBtn.focus === "function") {
      closeBtn.focus();
    }
  }

  function bindPreviewLightbox() {
    if (!gridEl || !getPreviewElements()) return;

    gridEl.querySelectorAll("[data-preview-src]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openPreview(btn.getAttribute("data-preview-src"), btn.getAttribute("data-preview-title"));
      });
    });

    previewEl.querySelectorAll("[data-preview-close]").forEach(function (el) {
      el.addEventListener("click", closePreview);
    });

    if (!previewEl.dataset.bound) {
      previewEl.dataset.bound = "true";
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closePreview();
      });
    }
  }

  function loadPages() {
    fetch(MANIFEST_URL, { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("Could not load coloring-pages.json");
        return res.json();
      })
      .then(function (data) {
        var pages = Array.isArray(data && data.pages) ? data.pages : [];
        renderPages(pages.filter(function (p) { return p && p.title && p.file; }));
      })
      .catch(function () {
        renderError("Could not load the coloring page list. Try refreshing.");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadPages);
  } else {
    loadPages();
  }
})();
