(function () {
  "use strict";

  var root = document.querySelector("[data-labs-draw]");
  if (!root) return;

  var canvas = root.querySelector("[data-labs-draw-canvas]");
  var toggleBtn = root.querySelector("[data-labs-draw-toggle]");
  var toolbar = root.querySelector("[data-labs-draw-toolbar]");
  var clearBtn = root.querySelector("[data-labs-draw-clear]");
  var hint = root.querySelector("[data-labs-draw-hint]");
  var toolBtns = root.querySelectorAll("[data-labs-draw-tool]");
  var colorBtns = root.querySelectorAll("[data-labs-draw-color]");
  var siteRoot = document.querySelector(".labs-site");

  if (!canvas || !toggleBtn || !toolbar) return;

  var ctx = canvas.getContext("2d");
  var isOpen = false;
  var isDrawing = false;
  var activeTool = "draw";
  var activeColor = "#f4a8c8";
  var lastPoint = null;
  var pendingPointer = null;
  var strokeWidth = 11;
  var eraserWidth = 26;
  var drawThreshold = 6;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hintKey = "labs-draw-hint-seen";

  function resizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth;
    var h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  function clearCanvas() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function getPoint(e) {
    return { x: e.clientX, y: e.clientY };
  }

  function isInteractiveTarget(el) {
    if (!el || el === canvas) return false;
    return !!el.closest(
      "a, button, input, textarea, select, label, summary, [contenteditable='true'], .labs-draw, .labs-form-modal, .labs-menu, .labs-header"
    );
  }

  function drawCrayonSegment(from, to) {
    if (activeTool === "eraser") {
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
    ctx.strokeStyle = activeColor;
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

  function beginStroke(point) {
    isDrawing = true;
    lastPoint = point;
    drawCrayonSegment(point, point);
  }

  function onPointerDown(e) {
    if (!isOpen || e.button > 0) return;
    if (isInteractiveTarget(e.target)) return;

    pendingPointer = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      started: false,
    };
  }

  function onPointerMove(e) {
    if (!isOpen) return;

    if (pendingPointer && pendingPointer.id === e.pointerId && !pendingPointer.started) {
      var dx = e.clientX - pendingPointer.x;
      var dy = e.clientY - pendingPointer.y;
      var distSq = dx * dx + dy * dy;

      if (distSq >= drawThreshold * drawThreshold) {
        if (Math.abs(dy) > Math.abs(dx) * 1.35) {
          pendingPointer = null;
          return;
        }
        pendingPointer.started = true;
        beginStroke({ x: pendingPointer.x, y: pendingPointer.y });
      }
    }

    if (!isDrawing || !lastPoint) return;

    var point = getPoint(e);
    drawCrayonSegment(lastPoint, point);
    lastPoint = point;

    if (e.pointerType === "touch") {
      e.preventDefault();
    }
  }

  function onPointerUp(e) {
    if (pendingPointer && e && pendingPointer.id === e.pointerId) {
      if (!pendingPointer.started && !isInteractiveTarget(e.target)) {
        beginStroke(getPoint(e));
      }
      pendingPointer = null;
    }
    isDrawing = false;
    lastPoint = null;
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

  function openDraw() {
    isOpen = true;
    root.classList.add("is-open");
    toggleBtn.setAttribute("aria-expanded", "true");
    toggleBtn.setAttribute("aria-label", "Close drawing mode");
    toolbar.hidden = false;
    hideHint();
    resizeCanvas();
  }

  function closeDraw() {
    isOpen = false;
    isDrawing = false;
    lastPoint = null;
    pendingPointer = null;
    root.classList.remove("is-open", "is-clearing");
    toggleBtn.setAttribute("aria-expanded", "false");
    toggleBtn.setAttribute("aria-label", "Draw on the site");
    toolbar.hidden = true;
    clearCanvas();
  }

  function toggleDraw() {
    if (isOpen) closeDraw();
    else openDraw();
  }

  function runClear() {
    if (reduceMotion) {
      clearCanvas();
      return;
    }
    root.classList.add("is-clearing");
    window.setTimeout(function () {
      clearCanvas();
      root.classList.remove("is-clearing");
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

  clearBtn.addEventListener("click", function () {
    runClear();
  });

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

  window.addEventListener("pointerdown", onPointerDown, { passive: false });
  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp, { passive: true });
  window.addEventListener("pointercancel", onPointerUp, { passive: true });

  window.addEventListener("resize", resizeCanvas, { passive: true });
  window.addEventListener(
    "orientationchange",
    function () {
      window.setTimeout(resizeCanvas, 120);
    },
    { passive: true }
  );

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen) {
      closeDraw();
      toggleBtn.focus();
    }
  });

  if (siteRoot) {
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
  }

  try {
    if (sessionStorage.getItem(hintKey)) hideHint();
    else {
      window.setTimeout(hideHint, 4500);
    }
  } catch (err) {
    window.setTimeout(hideHint, 4500);
  }

  resizeCanvas();
})();
