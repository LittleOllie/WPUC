/**
 * Web3House — premium collection showcase (detail modal content)
 */
(function (global) {
  "use strict";

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function defaultStats(c) {
    var hasChain = !!c.contract;
    return {
      founded: c.showcase?.stats?.founded || (hasChain ? "2021" : "2020"),
      chain: c.showcase?.stats?.chain || (hasChain ? "Ethereum" : "Web3"),
      collectionSize: c.showcase?.stats?.collectionSize || (hasChain ? "10,000" : "—"),
      holders: c.showcase?.stats?.holders || (hasChain ? "3,500+" : "Growing"),
      twitterFollowing: c.showcase?.stats?.twitterFollowing || "20K+",
      discordMembers: c.showcase?.stats?.discordMembers || (c.discord ? "5,000+" : "—"),
    };
  }

  function defaultFounder(c) {
    var s = c.showcase?.founder;
    if (s) return s;
    return {
      name: "Community Founder",
      title: "Founder · " + c.name,
      avatarInitials: (c.logoInitials || c.name.charAt(0)).slice(0, 2).toUpperCase(),
      message:
        "Welcome — whether you're brand new to Web3 or you've been collecting for years, we're glad you're here. " +
        c.name +
        " was built as a place to belong: art, friendships, creativity, and memories that last longer than any single market cycle. " +
        "Take your time, explore the gallery, and say hello when you're ready. The door is open.",
      mediaType: "text",
    };
  }

  function defaultTestimonials(c) {
    if (c.showcase?.testimonials?.length) return c.showcase.testimonials;
    var label = c.name.split(" ")[0];
    return [
      {
        handle: "@" + label.toLowerCase() + "_collector",
        role: "Holder since day one",
        quote:
          "I came for the art and stayed for the people. This community genuinely feels like a group chat that never logs off.",
      },
      {
        handle: "@web3_newbie",
        role: "Newcomer · 3 months in",
        quote:
          "Everyone was patient when I had basic questions. No gatekeeping — just vibes and helpful links.",
      },
      {
        handle: "@creative_" + (c.id || "fan").replace(/-/g, ""),
        role: "Fan art & memes",
        quote:
          "The culture here is creative and kind. Events, inside jokes, and art shares keep it fun even on quiet days.",
      },
      {
        handle: "@irl_friend",
        role: "Community mod",
        quote:
          "We show up for each other — celebrations, tough days, and everything between. That's the real utility.",
      },
    ];
  }

  function defaultWhyStay(c) {
    if (c.showcase?.whyStay?.length) return c.showcase.whyStay;
    return [
      { title: "Friendships", text: "Collectors become real friends — DMs, voice chats, and meetups that outlast trends." },
      { title: "Creativity", text: "Fan art, memes, and shared projects keep the culture alive and welcoming." },
      { title: "Events", text: "Spaces, game nights, and IRL moments give everyone something to look forward to." },
      { title: "Support", text: "Questions get answers. Newcomers get guided. Nobody has to figure it out alone." },
      { title: "Collaboration", text: "Cross-community energy with aligned projects — culture over competition." },
      { title: "Fun", text: "Inside jokes, celebrations, and playful energy — seriousness optional." },
    ];
  }

  function buildAbout(c) {
    var s = c.showcase?.about;
    if (s) return s;
    return {
      paragraphs: [
        c.description,
        c.name +
          " is more than artwork on a screen — it's a shared identity. Collectors gather for the visuals, but they stay for the culture: kindness, creativity, and room to grow at your own pace.",
        "Whether you're browsing from the sidelines or ready to dive into Discord, you'll find a community that values people over hype and connection over charts.",
      ],
      quote: {
        text: "Culture is the product. The chain is just where we hang the art.",
        attribution: "— A longtime " + c.name + " collector",
      },
    };
  }

  function getConnected(community, allCommunities) {
    var linked = community.showcase?.connectedIds;
    var pool = allCommunities.filter(function (x) {
      return x.id !== community.id;
    });
    if (linked?.length) {
      return linked
        .map(function (id) {
          return pool.find(function (x) {
            return x.id === id;
          });
        })
        .filter(Boolean);
    }
    var scored = pool.slice().sort(function (a, b) {
      var sa = (a.communityPick === community.communityPick ? 2 : 0) + (a.featured ? 1 : 0);
      var sb = (b.communityPick === community.communityPick ? 2 : 0) + (b.featured ? 1 : 0);
      return sb - sa;
    });
    return scored.slice(0, 4);
  }

  function applyTheme(panel, c) {
    if (!panel) return;
    var primary = c.theme?.primary || "#6de0ff";
    var bg = c.theme?.background || "#0a0a14";
    panel.style.setProperty("--showcase-primary", primary);
    panel.style.setProperty("--showcase-bg", bg);
    panel.style.setProperty(
      "--showcase-hero-gradient",
      c.banner || "linear-gradient(160deg, " + primary + "22 0%, " + bg + " 55%, #050508 100%)"
    );
    panel.dataset.communityId = c.id;
    panel.classList.toggle("detail--little-ollie", c.id === "little-ollie");
  }

  function setWatermark(watermarkEl, logoUrl) {
    if (!watermarkEl) return;
    if (logoUrl) {
      watermarkEl.style.backgroundImage = 'url("' + String(logoUrl).replace(/"/g, "%22") + '")';
      watermarkEl.classList.add("is-visible");
    } else {
      watermarkEl.style.backgroundImage = "";
      watermarkEl.classList.remove("is-visible");
    }
  }

  function getCommunityLinks(c, ensureHttps) {
    var links = [];
    var web = ensureHttps(c.website);
    if (web) {
      links.push({ label: "Official Website", href: web, kind: "website" });
    }
    if (c.twitter) {
      links.push({ label: "Official X/Twitter", href: c.twitter, kind: "twitter" });
    }
    if (c.discord) {
      links.push({ label: "Official Discord", href: c.discord, kind: "discord" });
    }
    return links;
  }

  function renderHeroActions(c, ensureHttps) {
    var parts = [];
    var web = ensureHttps(c.website);
    if (web) {
      parts.push(
        '<a class="showcase-btn showcase-btn--hero showcase-btn--hero-primary" href="' +
          esc(web) +
          '" target="_blank" rel="noopener noreferrer">Website</a>'
      );
    }
    if (c.twitter) {
      parts.push(
        '<a class="showcase-btn showcase-btn--hero showcase-btn--hero-secondary" href="' +
          esc(c.twitter) +
          '" target="_blank" rel="noopener noreferrer" title="X/Twitter">X/Twitter</a>'
      );
    }
    if (c.openSea) {
      parts.push(
        '<a class="showcase-btn showcase-btn--hero showcase-btn--hero-tertiary" href="' +
          esc(c.openSea) +
          '" target="_blank" rel="noopener noreferrer">OpenSea</a>'
      );
    }
    return parts.join("");
  }

  function renderJoinCta() {
    return (
      '<p class="showcase-join__lead">Ready to say hello? Step in through verified channels — no pressure, no hype.</p>' +
      '<button type="button" class="showcase-join__btn" id="detailJoinBtn">Join Community</button>'
    );
  }

  function renderVerifiedLink(link) {
    return (
      '<a class="join-community-link join-community-link--' +
      esc(link.kind) +
      '" href="' +
      esc(link.href) +
      '" target="_blank" rel="noopener noreferrer">' +
      '<span class="join-community-link__icon" aria-hidden="true"></span>' +
      '<span class="join-community-link__text">' +
      '<span class="join-community-link__label">' +
      esc(link.label) +
      "</span>" +
      '<span class="join-community-link__hint">Opens in a new tab</span>' +
      "</span>" +
      "</a>"
    );
  }

  var joinModalBound = false;

  function closeJoinCommunityModal() {
    var modal = document.getElementById("joinCommunityModal");
    if (!modal) return;
    if (typeof modal.close === "function" && modal.open) {
      modal.close();
    } else {
      modal.removeAttribute("open");
    }
  }

  function updateJoinModalBrand(c) {
    var logoWrap = document.getElementById("joinCommunityLogo");
    var logoImg = document.getElementById("joinCommunityLogoImg");
    var logoPh = document.getElementById("joinCommunityLogoPh");
    var taglineEl = document.getElementById("joinCommunityTagline");
    if (!logoWrap || !logoImg || !logoPh) return;

    logoWrap.classList.toggle("join-community-modal__logo-wrap--edge", Boolean(c.logoEdgeFill));

    var logoUrl = c.logo;
    if (!logoUrl) {
      var detailLogo = document.getElementById("detailLogo");
      if (detailLogo && detailLogo.src && !detailLogo.hidden) {
        logoUrl = detailLogo.src;
      }
    }

    if (logoUrl) {
      logoImg.src = logoUrl;
      logoImg.alt = c.name;
      logoImg.hidden = false;
      logoPh.hidden = true;
      logoWrap.classList.remove("join-community-modal__logo-wrap--empty");
    } else {
      logoImg.hidden = true;
      logoImg.removeAttribute("src");
      logoPh.textContent = (c.logoInitials || c.name.charAt(0)).slice(0, 2).toUpperCase();
      logoPh.hidden = false;
      logoWrap.classList.add("join-community-modal__logo-wrap--empty");
    }

    if (taglineEl) {
      taglineEl.textContent = c.tagline || "";
      taglineEl.hidden = !c.tagline;
    }
  }

  function openJoinCommunityModal(c, ensureHttps) {
    var links = getCommunityLinks(c, ensureHttps);
    if (!links.length) return;

    var modal = document.getElementById("joinCommunityModal");
    var linksEl = document.getElementById("joinCommunityLinks");
    var titleEl = document.getElementById("joinCommunityTitle");
    var heroEl = document.getElementById("joinCommunityHero");
    if (!modal || !linksEl) return;

    if (titleEl) titleEl.textContent = "Join " + c.name;
    linksEl.innerHTML = links.map(renderVerifiedLink).join("");
    updateJoinModalBrand(c);

    var primary = c.theme?.primary || "#6de0ff";
    var bg = c.theme?.background || "#0c0e18";
    modal.style.setProperty("--showcase-primary", primary);
    modal.style.setProperty("--showcase-bg", bg);
    if (heroEl) {
      heroEl.style.background =
        c.banner ||
        "linear-gradient(165deg, color-mix(in srgb, " +
          primary +
          " 28%, transparent) 0%, " +
          bg +
          " 72%)";
    }

    if (typeof modal.showModal === "function") {
      modal.showModal();
    } else {
      modal.setAttribute("open", "");
    }
  }

  function bindJoinCommunityModal() {
    if (joinModalBound) return;
    var modal = document.getElementById("joinCommunityModal");
    var closeBtn = document.getElementById("joinCommunityClose");
    if (!modal) return;
    joinModalBound = true;

    closeBtn?.addEventListener("click", closeJoinCommunityModal);
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeJoinCommunityModal();
    });
    modal.addEventListener("cancel", function (e) {
      e.preventDefault();
      closeJoinCommunityModal();
    });
  }

  function bindJoinCta(panel, c, ensureHttps) {
    var joinSection = panel.querySelector("#showcase-join");
    var joinEl = panel.querySelector("#detailJoinCta");
    var links = getCommunityLinks(c, ensureHttps);
    if (!joinSection || !joinEl) return;

    if (!links.length) {
      joinSection.hidden = true;
      return;
    }

    joinSection.hidden = false;
    joinEl.innerHTML = renderJoinCta();

    var btn = joinEl.querySelector("#detailJoinBtn");
    if (!btn) return;
    btn.onclick = function () {
      openJoinCommunityModal(c, ensureHttps);
    };
  }

  function renderBadges(c) {
    if (!c.studio) return "";
    return (
      '<span class="showcase-badge showcase-badge--soft">' + esc(c.studio) + "</span>"
    );
  }

  function renderSnapshot(stats) {
    var items = [
      { label: "Founded", value: stats.founded },
      { label: "Blockchain", value: stats.chain },
      { label: "Collection size", value: stats.collectionSize },
      { label: "Holders", value: stats.holders },
      { label: "X/Twitter following", value: stats.twitterFollowing },
      { label: "Discord members", value: stats.discordMembers },
    ];
    return items
      .map(function (item) {
        return (
          '<div class="showcase-stat">' +
          '<span class="showcase-stat__label">' +
          esc(item.label) +
          "</span>" +
          '<span class="showcase-stat__value">' +
          esc(item.value) +
          "</span>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderTestimonials(list) {
    return list
      .map(function (t) {
        return (
          '<article class="showcase-voice">' +
          '<p class="showcase-voice__quote">“' +
          esc(t.quote) +
          "”</p>" +
          '<footer class="showcase-voice__foot">' +
          '<span class="showcase-voice__handle">' +
          esc(t.handle) +
          "</span>" +
          '<span class="showcase-voice__role">' +
          esc(t.role) +
          "</span>" +
          "</footer>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderWhyStay(items) {
    return items
      .map(function (item) {
        return (
          '<div class="showcase-stay-card">' +
          "<h4>" +
          esc(item.title) +
          "</h4>" +
          "<p>" +
          esc(item.text) +
          "</p>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderConnected(list, onExplore) {
    return list
      .map(function (c) {
        var logo = c.logo
          ? '<img src="' + esc(c.logo) + '" alt="" loading="lazy" decoding="async" />'
          : '<span class="showcase-connected__ph">' + esc(c.logoInitials || c.name.charAt(0)) + "</span>";
        var edgeCls = c.logoEdgeFill ? " showcase-connected__logo--edge" : "";
        return (
          '<button type="button" class="showcase-connected" data-connected-id="' +
          esc(c.id) +
          '">' +
          '<span class="showcase-connected__logo' +
          edgeCls +
          '">' +
          logo +
          "</span>" +
          "<span class=\"showcase-connected__name\">" +
          esc(c.name) +
          "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function renderWeb3Accordion() {
    if (global.Web3HouseNewToWeb3 && global.Web3HouseNewToWeb3.renderAccordionHtml) {
      return global.Web3HouseNewToWeb3.renderAccordionHtml({
        prefix: "showcase-web3",
        showIcon: false,
      });
    }
    return "";
  }

  var navObserver = null;

  function bindShowcaseNav(scrollRoot) {
    var nav = scrollRoot?.closest(".detail")?.querySelector(".detail-showcase-nav");
    if (!nav || !scrollRoot) return;

    nav.querySelectorAll(".detail-showcase-nav__link").forEach(function (link) {
      link.addEventListener("click", function (e) {
        var href = link.getAttribute("href");
        if (!href || href.charAt(0) !== "#") return;
        var target = scrollRoot.querySelector(href);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    if (navObserver) navObserver.disconnect();
    if (!("IntersectionObserver" in global)) return;

    var sectionIds = [].map.call(nav.querySelectorAll("a[href^='#']"), function (a) {
      return a.getAttribute("href");
    });

    navObserver = new IntersectionObserver(
      function (entries) {
        var visible = entries
          .filter(function (e) {
            return e.isIntersecting;
          })
          .sort(function (a, b) {
            return b.intersectionRatio - a.intersectionRatio;
          });
        if (!visible[0]?.target?.id) return;
        var id = "#" + visible[0].target.id;
        nav.querySelectorAll(".detail-showcase-nav__link").forEach(function (link) {
          link.classList.toggle("is-active", link.getAttribute("href") === id);
        });
      },
      { root: scrollRoot, rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.2, 0.4] }
    );

    sectionIds.forEach(function (href) {
      var el = scrollRoot.querySelector(href);
      if (el) navObserver.observe(el);
    });
  }

  function bindConnectedClicks(container, onExplore) {
    if (!container || !onExplore) return;
    container.querySelectorAll("[data-connected-id]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-connected-id");
        if (id) onExplore(id);
      });
    });
  }

  function populate(ctx) {
    var c = ctx.community;
    var panel = ctx.panel;
    var all = ctx.allCommunities || [];
    var ensureHttps = ctx.ensureHttps || function (u) {
      return u;
    };
    var onExplore = ctx.onExplore;

    applyTheme(panel, c);
    if (c.banner) {
      panel.style.setProperty("--showcase-hero-gradient", c.banner);
    }

    var stats = defaultStats(c);
    var about = buildAbout(c);
    var founder = defaultFounder(c);
    var testimonials = defaultTestimonials(c);
    var whyStay = defaultWhyStay(c);
    var connected = getConnected(c, all);

    var watermark = panel.querySelector("#detailWatermark");
    setWatermark(watermark, c.logo || null);

    var logoWrap = panel.querySelector(".detail__logo-wrap");
    if (logoWrap) {
      logoWrap.classList.toggle("detail__logo-wrap--edge", Boolean(c.logoEdgeFill));
    }

    var logoEl = panel.querySelector("#detailLogo");
    if (logoEl) {
      if (c.logo) {
        logoEl.src = c.logo;
        logoEl.alt = c.name;
        logoEl.hidden = false;
      } else {
        logoEl.hidden = true;
        logoEl.removeAttribute("src");
      }
    }

    var titleEl = panel.querySelector("#detailTitle");
    if (titleEl) titleEl.textContent = c.name;

    var taglineEl = panel.querySelector("#detailTagline");
    if (taglineEl) {
      var parts = [];
      if (c.studio) parts.push("Collection from " + c.studio);
      if (c.tagline) parts.push(c.tagline);
      taglineEl.textContent = parts.join(" · ");
      taglineEl.hidden = !parts.length;
    }

    var badgesEl = panel.querySelector("#detailHeroBadges");
    var heroInner = panel.querySelector(".detail__hero-inner");
    if (badgesEl) {
      var badgeHtml = renderBadges(c);
      badgesEl.innerHTML = badgeHtml;
      badgesEl.hidden = !badgeHtml;
      if (heroInner) {
        heroInner.classList.toggle("detail__hero-inner--no-badges", !badgeHtml);
      }
    }

    var actionsEl = panel.querySelector("#detailHeroActions");
    if (actionsEl) actionsEl.innerHTML = renderHeroActions(c, ensureHttps);

    var aboutEl = panel.querySelector("#detailAboutContent");
    if (aboutEl) {
      aboutEl.innerHTML =
        about.paragraphs.map(function (p) {
          return "<p>" + esc(p) + "</p>";
        }).join("") +
        (about.quote
          ? '<blockquote class="showcase-quote"><p>“' +
            esc(about.quote.text) +
            '”</p><cite>' +
            esc(about.quote.attribution) +
            "</cite></blockquote>"
          : "");
    }

    var founderEl = panel.querySelector("#detailFounderCard");
    if (founderEl) {
      var messageHtml = "";
      if (founder.paragraphs && founder.paragraphs.length) {
        messageHtml = founder.paragraphs
          .map(function (p) {
            return "<p>" + esc(p) + "</p>";
          })
          .join("");
      } else {
        messageHtml = "<p>" + esc(founder.message || "") + "</p>";
      }
      founderEl.innerHTML =
        '<div class="showcase-founder__avatar" aria-hidden="true">' +
        esc(founder.avatarInitials) +
        "</div>" +
        '<div class="showcase-founder__meta">' +
        "<h4>" +
        esc(founder.name) +
        "</h4>" +
        "<p>" +
        esc(founder.title) +
        "</p>" +
        "</div>" +
        '<div class="showcase-founder__message" data-media="' +
        esc(founder.mediaType || "text") +
        '">' +
        messageHtml +
        "</div>";
    }

    var voicesEl = panel.querySelector("#detailVoicesTrack");
    if (voicesEl) voicesEl.innerHTML = renderTestimonials(testimonials);

    var stayEl = panel.querySelector("#detailStayGrid");
    if (stayEl) stayEl.innerHTML = renderWhyStay(whyStay);

    bindJoinCommunityModal();
    bindJoinCta(panel, c, ensureHttps);

    var snapshotEl = panel.querySelector("#detailSnapshotGrid");
    if (snapshotEl) snapshotEl.innerHTML = renderSnapshot(stats);

    var connectedEl = panel.querySelector("#detailConnectedRow");
    if (connectedEl) {
      connectedEl.innerHTML = renderConnected(connected);
      bindConnectedClicks(connectedEl, onExplore);
    }

    var web3El = panel.querySelector("#detailWeb3Accordion");
    if (web3El) {
      web3El.innerHTML = renderWeb3Accordion();
      global.Web3HouseNewToWeb3?.bindExclusiveAccordion?.(web3El);
    }

    var scrollRoot = panel.querySelector("#detailScroll");
    bindShowcaseNav(scrollRoot);

    panel.querySelectorAll(".showcase-section").forEach(function (section, i) {
      section.style.animationDelay = i * 0.04 + "s";
    });
  }

  global.Web3HouseShowcase = {
    populate: populate,
    applyTheme: applyTheme,
    setWatermark: setWatermark,
    buildAbout: buildAbout,
    defaultStats: defaultStats,
    closeJoinModal: closeJoinCommunityModal,
  };
})(window);
