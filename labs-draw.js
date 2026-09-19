(function () {
  "use strict";

  var siteRoot = document.querySelector(".labs-site");
  var drawUi = document.querySelector("[data-labs-draw]");
  var canvas = document.querySelector("[data-labs-draw-canvas]");
  if (!siteRoot || !drawUi || !canvas) return;

  var toggleBtn = drawUi.querySelector("[data-labs-draw-toggle]");
  var toolbar = drawUi.querySelector("[data-labs-draw-toolbar]");
  var clearBtn = drawUi.querySelector("[data-labs-draw-clear]");
  var hint = drawUi.querySelector("[data-labs-draw-hint]");
  var toolBtns = drawUi.querySelectorAll("[data-labs-draw-tool]");
  var colorBtns = drawUi.querySelectorAll("[data-labs-draw-color]");
  if (!toggleBtn || !toolbar) return;

  var ctx = canvas.getContext("2d");
  var isOpen = false;
  var isDrawing = false;
  var activeTool = "draw";
  var activeColor = "#f4a8c8";
  var lastPoint = null;
  var activePointerId = null;
  var strokes = [];
  var currentStroke = null;
  var strokeWidth = 11;
  var eraserWidth = 26;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hintKey = "labs-draw-hint-seen";
  var resizeFrame = null;

  function getSiteSize() {
    return {
      width: Math.max(siteRoot.scrollWidth, siteRoot.offsetWidth, document.documentElement.clientWidth),
      height: Math.max(siteRoot.scrollHeight, siteRoot.offsetHeight),
    };
  }

  function getDocPointFromClient(clientX, clientY) {
    var rect = siteRoot.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function getDocPoint(e) {
    return getDocPointFromClient(e.clientX, e.clientY);
  }

  function isUiTarget(el) {
    return !!(el && el.closest("[data-labs-draw], .labs-form-modal, .labs-menu"));
  }

  function setCanvasInteractive(on) {
    canvas.classList.toggle("labs-draw__canvas--interactive", !!on);
  }

  function resizeCanvas() {
    var size = getSiteSize();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(size.width * dpr);
    canvas.height = Math.floor(size.height * dpr);
    canvas.style.width = size.width + "px";
    canvas.style.height = size.height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    redrawAll();
  }

  function scheduleResize() {
    if (resizeFrame) return;
    resizeFrame = window.requestAnimationFrame(function () {
      resizeFrame = null;
      resizeCanvas();
    });
  }

  function clearBitmap() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function renderSegment(from, to, stroke) {
    if (stroke.tool === "eraser") {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = eraserWidth;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = strokeWidth;
    ctx.globalAlpha = 0.82;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    ctx.globalAlpha = 0.38;
    ctx.lineWidth = strokeWidth * 1.35;
    ctx.beginPath();
    ctx.moveTo(from.x + 0.6, from.y + 0.4);
    ctx.lineTo(to.x + 0.6, to.y + 0.4);
    ctx.stroke();
    ctx.restore();
  }

  function renderStroke(stroke) {
    if (!stroke || !stroke.points.length) return;
    if (stroke.points.length === 1) {
      renderSegment(stroke.points[0], stroke.points[0], stroke);
      return;
    }
    for (var i = 1; i < stroke.points.length; i++) {
      renderSegment(stroke.points[i - 1], stroke.points[i], stroke);
    }
  }

  function redrawAll() {
    clearBitmap();
    strokes.forEach(renderStroke);
    if (currentStroke) renderStroke(currentStroke);
  }

  function startStroke(point) {
    currentStroke = {
      tool: activeTool,
      color: activeColor,
      points: [point],
    };
    isDrawing = true;
    lastPoint = point;
    renderSegment(point, point, currentStroke);
  }

  function extendStroke(point) {
    if (!currentStroke || !lastPoint) return;
    currentStroke.points.push(point);
    renderSegment(lastPoint, point, currentStroke);
    lastPoint = point;
  }

  function finishStroke() {
    if (currentStroke && currentStroke.points.length) {
      strokes.push(currentStroke);
    }
    currentStroke = null;
    isDrawing = false;
    lastPoint = null;
    activePointerId = null;
  }

  function beginPointerStroke(e) {
    activePointerId = e.pointerId;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
    startStroke(getDocPoint(e));
  }

  function onPointerDown(e) {
    if (!isOpen || e.button > 0) return;
    if (isUiTarget(e.target)) return;

    beginPointerStroke(e);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!isOpen || !isDrawing || e.pointerId !== activePointerId) return;

    extendStroke(getDocPoint(e));
    e.preventDefault();
  }

  function onPointerUp(e) {
    if (!isOpen || e.pointerId !== activePointerId) return;

    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }

    finishStroke();
    e.preventDefault();
  }

  function preventTouchScrollWhileOpen(e) {
    if (!isOpen) return;
    if (isUiTarget(e.target)) return;
    e.preventDefault();
  }

  function setTool(tool) {
    activeTool = tool;
    toolBtns.forEach(function (btn) {
      var isActive = btn.getAttribute("data-labs-draw-tool") === tool;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function setColor(color) {
    activeColor = color;
    setTool("draw");
    colorBtns.forEach(function (btn) {
      var isActive = btn.getAttribute("data-labs-draw-color") === color;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function hideHint() {
    if (!hint) return;
    hint.classList.add("is-hidden");
    try {
      sessionStorage.setItem(hintKey, "1");
    } catch (err) {
      /* ignore */
    }
  }

  function clearAllStrokes() {
    strokes = [];
    currentStroke = null;
    isDrawing = false;
    lastPoint = null;
    activePointerId = null;
    clearBitmap();
  }

  function openDraw() {
    isOpen = true;
    drawUi.classList.add("is-open");
    siteRoot.classList.add("labs-draw-active");
    toggleBtn.setAttribute("aria-expanded", "true");
    toggleBtn.setAttribute("aria-label", "Close drawing mode");
    toolbar.hidden = false;
    hideHint();
    scheduleResize();
    setCanvasInteractive(true);
  }

  function closeDraw() {
    isOpen = false;
    if (isDrawing) finishStroke();
    drawUi.classList.remove("is-open");
    canvas.classList.remove("is-clearing");
    siteRoot.classList.remove("labs-draw-active");
    toggleBtn.setAttribute("aria-expanded", "false");
    toggleBtn.setAttribute("aria-label", "Draw on the site");
    toolbar.hidden = true;
    setCanvasInteractive(false);
  }

  function toggleDraw() {
    if (isOpen) closeDraw();
    else openDraw();
  }

  function runClear() {
    if (reduceMotion) {
      clearAllStrokes();
      return;
    }
    canvas.classList.add("is-clearing");
    window.setTimeout(function () {
      clearAllStrokes();
      canvas.classList.remove("is-clearing");
    }, 160);
  }

  toggleBtn.addEventListener("click", function () {
    toggleDraw();
  });

  toggleBtn.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleDraw();
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      runClear();
    });
  }

  toolBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setTool(btn.getAttribute("data-labs-draw-tool") || "draw");
    });
  });

  colorBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setColor(btn.getAttribute("data-labs-draw-color") || activeColor);
    });
  });

  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  canvas.addEventListener("pointermove", onPointerMove, { passive: false });
  canvas.addEventListener("pointerup", onPointerUp, { passive: false });
  canvas.addEventListener("pointercancel", onPointerUp, { passive: false });

  document.addEventListener("touchmove", preventTouchScrollWhileOpen, { passive: false, capture: true });

  window.addEventListener("resize", scheduleResize, { passive: true });

  window.addEventListener(
    "orientationchange",
    function () {
      window.setTimeout(scheduleResize, 120);
    },
    { passive: true }
  );

  if ("ResizeObserver" in window) {
    var resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(siteRoot);
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen) {
      closeDraw();
      toggleBtn.focus();
    }
  });

  document.addEventListener(
    "selectstart",
    function (e) {
      if (isOpen) e.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "dragstart",
    function (e) {
      if (isOpen) e.preventDefault();
    },
    { passive: false }
  );

  var modalObserver = new MutationObserver(function () {
    if (
      isOpen &&
      (siteRoot.classList.contains("labs-site--modal-open") ||
        siteRoot.classList.contains("labs-site--menu-open"))
    ) {
      closeDraw();
    }
  });
  modalObserver.observe(siteRoot, { attributes: true, attributeFilter: ["class"] });

  try {
    if (sessionStorage.getItem(hintKey)) hideHint();
    else window.setTimeout(hideHint, 4500);
  } catch (err) {
    window.setTimeout(hideHint, 4500);
  }

  scheduleResize();
})();
