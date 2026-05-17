/**
 * Web3House — “Take The Quiz” fullscreen onboarding flow
 */
(function (global) {
  "use strict";

  var data = global.Web3HouseQuizData;
  if (!data) return;

  var dialog = null;
  var stageEl = null;
  var progressFill = null;
  var stepLabel = null;
  var particlesHost = null;

  var phase = "welcome";
  var questionIndex = 0;
  var answers = {};
  var advanceTimer = 0;
  var communities = [];
  var callbacks = {};

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function prefersReducedMotion() {
    return global.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function clearAdvanceTimer() {
    if (advanceTimer) {
      clearTimeout(advanceTimer);
      advanceTimer = 0;
    }
  }

  function lockBody(lock) {
    document.body.classList.toggle("quiz-flow-open", lock);
  }

  function getCommunity(id) {
    return communities.filter(function (c) {
      return c.id === id;
    })[0];
  }

  function progressRatio() {
    if (phase === "welcome") return 0;
    if (phase === "result") return 1;
    return (questionIndex + 1) / data.QUESTIONS.length;
  }

  function updateChrome() {
    if (progressFill) {
      progressFill.style.width = Math.round(progressRatio() * 100) + "%";
    }
    if (stepLabel) {
      if (phase === "welcome") stepLabel.textContent = "Start";
      else if (phase === "result") stepLabel.textContent = "Done";
      else stepLabel.textContent = questionIndex + 1 + " / " + data.QUESTIONS.length;
    }
  }

  function spawnParticles() {
    if (!particlesHost || prefersReducedMotion()) return;
    particlesHost.innerHTML = "";
    for (var i = 0; i < 8; i++) {
      var p = document.createElement("span");
      p.className = "quiz-flow__particle";
      p.style.left = 10 + Math.random() * 80 + "%";
      p.style.top = 15 + Math.random() * 70 + "%";
      p.style.animationDelay = Math.random() * 3 + "s";
      particlesHost.appendChild(p);
    }
  }

  function renderWelcome() {
    return (
      '<div class="quiz-flow__panel is-active" data-panel="welcome">' +
      '<p class="quiz-flow__eyebrow">Clubhouse onboarding</p>' +
      '<h2 class="quiz-flow__title" id="quizFlowTitle">Find your Web3 vibe</h2>' +
      '<p class="quiz-flow__lead">A quick, cozy journey — no wallet, no grades. Discover your style, pick up safety tips, and see which communities might feel like home.</p>' +
      '<div class="quiz-flow__actions">' +
      '<button type="button" class="btn btn--primary quiz-flow__btn-primary" data-quiz-action="start">Begin the journey</button>' +
      "</div>" +
      "</div>"
    );
  }

  function renderQuestion(q) {
    var opts = q.options
      .map(function (opt) {
        var selected = answers[q.id] === opt.id ? " is-selected" : "";
        return (
          '<li><button type="button" class="quiz-flow__option' +
          selected +
          '" data-quiz-option="' +
          esc(opt.id) +
          '" data-question="' +
          esc(q.id) +
          '">' +
          '<span class="quiz-flow__option-emoji" aria-hidden="true">' +
          opt.emoji +
          "</span>" +
          "<span>" +
          esc(opt.label) +
          "</span></button></li>"
        );
      })
      .join("");

    var catLabel =
      q.category === "safety"
        ? "Safety check"
        : q.category === "community"
          ? "Community"
          : q.category === "experience"
            ? "Experience"
            : "Your vibe";

    return (
      '<div class="quiz-flow__panel is-active" data-panel="question">' +
      '<p class="quiz-flow__eyebrow">' +
      esc(catLabel) +
      "</p>" +
      '<h2 class="quiz-flow__question">' +
      esc(q.prompt) +
      "</h2>" +
      '<ul class="quiz-flow__options">' +
      opts +
      "</ul>" +
      '<p class="quiz-flow__tip" id="quizTip" role="status" aria-live="polite"></p>' +
      '<div class="quiz-flow__actions">' +
      (questionIndex > 0
        ? '<button type="button" class="quiz-flow__btn-ghost" data-quiz-action="back">Back</button>'
        : "") +
      "</div>" +
      "</div>"
    );
  }

  function renderResult(outcome) {
    var profile = outcome.profile;
    var picks = (profile.communityIds || [])
      .map(function (id) {
        var c = getCommunity(id);
        if (!c) return "";
        var logo = c.logo
          ? '<img src="' + esc(c.logo) + '" alt="" width="20" height="20" />'
          : "";
        return (
          '<li class="quiz-flow__pick">' + logo + "<span>" + esc(c.name) + "</span></li>"
        );
      })
      .join("");

    var guidance = profile.guidance
      .map(function (g) {
        return "<li>" + esc(g) + "</li>";
      })
      .join("");

    var types = profile.communityTypes
      .map(function (t) {
        return "<li>" + esc(t) + "</li>";
      })
      .join("");

    return (
      '<div class="quiz-flow__panel is-active" data-panel="result">' +
      '<div class="quiz-flow__result-wrap">' +
      '<p class="quiz-flow__result-intro">You belong in…</p>' +
      '<article class="quiz-flow__result-card" style="--quiz-accent:' +
      esc(profile.accent) +
      '">' +
      '<div class="quiz-flow__badge" aria-hidden="true">' +
      profile.badge +
      "</div>" +
      '<h2 class="quiz-flow__result-title">' +
      esc(profile.title) +
      "</h2>" +
      '<p class="quiz-flow__result-tagline">' +
      esc(profile.tagline) +
      "</p>" +
      '<p class="quiz-flow__result-desc">' +
      esc(profile.description) +
      "</p>" +
      "</article>" +
      '<section class="quiz-flow__result-section">' +
      '<h3 class="quiz-flow__result-heading">Beginner guidance</h3>' +
      '<ul class="quiz-flow__result-list">' +
      guidance +
      "</ul>" +
      "</section>" +
      '<section class="quiz-flow__result-section">' +
      '<h3 class="quiz-flow__result-heading">Community types for you</h3>' +
      '<ul class="quiz-flow__result-list">' +
      types +
      "</ul>" +
      "</section>" +
      (picks
        ? '<section class="quiz-flow__result-section">' +
          '<h3 class="quiz-flow__result-heading">Explore on Web3House</h3>' +
          '<ul class="quiz-flow__picks">' +
          picks +
          "</ul></section>"
        : "") +
      '<div class="quiz-flow__actions">' +
      '<button type="button" class="btn btn--primary quiz-flow__btn-primary" data-quiz-action="enter">Enter Web3House</button>' +
      '<button type="button" class="quiz-flow__btn-ghost" data-quiz-action="retake">Retake quiz</button>' +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function setStage(html) {
    if (!stageEl) return;
    var prev = stageEl.querySelector(".quiz-flow__panel.is-active");
    if (prev && !prefersReducedMotion()) {
      prev.classList.remove("is-active");
      prev.classList.add("is-exit");
    }
    stageEl.innerHTML = html;
    updateChrome();
    if (phase === "result") {
      requestAnimationFrame(function () {
        var card = stageEl.querySelector(".quiz-flow__result-card");
        if (card) card.classList.add("is-revealed");
      });
    }
  }

  function goWelcome() {
    phase = "welcome";
    questionIndex = 0;
    answers = {};
    clearAdvanceTimer();
    setStage(renderWelcome());
  }

  function goQuestion(index) {
    phase = "question";
    questionIndex = index;
    clearAdvanceTimer();
    setStage(renderQuestion(data.QUESTIONS[index]));
  }

  function goResult() {
    phase = "result";
    clearAdvanceTimer();
    var outcome = data.computeResult(answers);
    data.saveProfile({
      resultId: outcome.resultId,
      answers: answers,
      scores: outcome.scores,
      safetyScore: outcome.safetyScore,
    });
    setStage(renderResult(outcome));
    spawnParticles();
  }

  function advanceFromQuestion() {
    if (questionIndex >= data.QUESTIONS.length - 1) goResult();
    else goQuestion(questionIndex + 1);
  }

  function onOptionClick(btn) {
    var qid = btn.getAttribute("data-question");
    var oid = btn.getAttribute("data-quiz-option");
    var q = data.QUESTIONS.filter(function (x) {
      return x.id === qid;
    })[0];
    if (!q) return;

    answers[qid] = oid;
    stageEl.querySelectorAll(".quiz-flow__option").forEach(function (el) {
      el.classList.toggle("is-selected", el === btn);
      el.disabled = true;
    });

    var tipEl = document.getElementById("quizTip");
    var delay = prefersReducedMotion() ? 280 : 900;

    if (q.tip && tipEl) {
      tipEl.textContent = q.tip;
      tipEl.classList.add("is-visible");
      delay = prefersReducedMotion() ? 400 : 1600;
    }

    clearAdvanceTimer();
    advanceTimer = setTimeout(function () {
      stageEl.querySelectorAll(".quiz-flow__option").forEach(function (el) {
        el.disabled = false;
      });
      advanceFromQuestion();
    }, delay);
  }

  function onStageClick(e) {
    var action = e.target.closest("[data-quiz-action]");
    if (action) {
      var act = action.getAttribute("data-quiz-action");
      if (act === "start") goQuestion(0);
      if (act === "back" && questionIndex > 0) goQuestion(questionIndex - 1);
      if (act === "retake") goWelcome();
      if (act === "enter") {
        close();
        if (callbacks.onEnterHub) callbacks.onEnterHub();
      }
      return;
    }

    var opt = e.target.closest("[data-quiz-option]");
    if (opt && !opt.disabled) onOptionClick(opt);
  }

  function buildShell() {
    dialog = document.getElementById("quizFlow");
    if (!dialog) return;

    dialog.innerHTML =
      '<article class="quiz-flow__shell">' +
      '<div class="quiz-flow__particles" id="quizParticles" aria-hidden="true"></div>' +
      '<header class="quiz-flow__top">' +
      '<button type="button" class="quiz-flow__close" id="quizCloseBtn" aria-label="Close quiz">×</button>' +
      '<div class="quiz-flow__progress" aria-hidden="true"><span class="quiz-flow__progress-fill" id="quizProgressFill"></span></div>' +
      '<span class="quiz-flow__step-label" id="quizStepLabel">Start</span>' +
      "</header>" +
      '<main class="quiz-flow__main"><div class="quiz-flow__stage" id="quizStage"></div></main>' +
      "</article>";

    stageEl = document.getElementById("quizStage");
    progressFill = document.getElementById("quizProgressFill");
    stepLabel = document.getElementById("quizStepLabel");
    particlesHost = document.getElementById("quizParticles");

    document.getElementById("quizCloseBtn")?.addEventListener("click", close);
    stageEl?.addEventListener("click", onStageClick);
    dialog.addEventListener("cancel", function (e) {
      e.preventDefault();
      close();
    });
    dialog.addEventListener("close", function () {
      lockBody(false);
      clearAdvanceTimer();
    });
  }

  function open() {
    if (!dialog) buildShell();
    if (!dialog) return;
    goWelcome();
    lockBody(true);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function close() {
    if (!dialog) return;
    clearAdvanceTimer();
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    lockBody(false);
  }

  function init(opts) {
    callbacks = opts || {};
    communities = callbacks.communities || [];
    buildShell();

    document.querySelectorAll(".js-quiz-open").forEach(function (btn) {
      btn.addEventListener("click", function () {
        open();
      });
    });

    if (location.hash === "#quiz") {
      requestAnimationFrame(open);
    }
  }

  global.Web3HouseQuiz = {
    init: init,
    open: open,
    close: close,
  };
})(window);
