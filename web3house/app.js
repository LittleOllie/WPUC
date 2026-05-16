/**
 * Web3House — community discovery hub (static, no backend)
 * Little Ollie Labs · /web3house/
 */

(function () {
  "use strict";

  const MAILTO = "hello@littleollielabs.com";

  /**
   * Sample communities — logos use existing repo assets (read-only relative paths).
   */
  const COMMUNITIES = [
    {
      id: "little-ollie",
      name: "Little Ollie",
      tagline: "Games, stories & family-friendly collectibles.",
      description:
        "The heart of Little Ollie Labs — playful characters, arcade games, and a growing universe built for families who create together.",
      tags: ["Family", "Games", "LO Labs"],
      why: [
        "Authentic, family-powered storytelling — not manufactured hype.",
        "Games and collectibles designed for parents and kids to enjoy side by side.",
        "Partners with OG Triple Media, Drop Dead Gorgeous, and communities we proudly showcase here.",
      ],
      logo: "assets/logos/little-ollie.webp",
      banner: "linear-gradient(135deg, #6de0ff, #4c6fff)",
      website: "https://littleollielabs.com/links/",
      twitter: "https://x.com/LittleOllieNFT",
      featured: true,
      /* Studio brand — no on-chain collection; use local character art */
      staticArt: [
        { tokenId: "11", name: "Little Ollie #11", imageUrl: "assets/logos/LO11.png" },
        { tokenId: "22", name: "Little Ollie #22", imageUrl: "assets/logos/LO22.png" },
        { tokenId: "33", name: "Little Ollie #33", imageUrl: "assets/logos/LO33.png" },
        { tokenId: "44", name: "Little Ollie #44", imageUrl: "assets/logos/LO44.png" },
      ],
    },
    {
      id: "ogenies",
      collectionId: "ogenies",
      contract: "0x5b12e009e1b5f14b1e8f3a3b9fb3ca165702dcbd",
      theme: { primary: "#eab308", background: "#0c0618" },
      name: "OGenies",
      studio: "OG Triple Media",
      tagline: "Wish granted. Culture earned.",
      description:
        "OGenies is the flagship NFT collection from OG Triple Media — distinctive genie art, holder culture, and a community built around pairing, lore, and official collector channels.",
      tags: ["Collection", "OG culture", "Ethereum"],
      why: [
        "The collection that defines OG Triple Media's art and holder community.",
        "Recognizable characters with strong pairing and display culture.",
        "Long-running team with clear official links — easy to verify before you engage.",
        "Connected to DDG, Little Ollie Labs, and cross-community collectors we trust.",
      ],
      logo: "assets/logos/ogenies.png",
      logoInitials: "OG",
      banner: "linear-gradient(135deg, #fbbf24, #7c3aed)",
      website: "https://linktr.ee/ogtriplemedia",
      twitter: "https://x.com/OGTripleMedia",
      openSea: "https://opensea.io/collection/ogenienft",
      featured: true,
      communityPick: true,
    },
    {
      id: "quirkies",
      collectionId: "quirkies",
      contract: "0xd4b7d9bb20fa20ddada9ecef8a7355ca983cccb1",
      theme: { primary: "#00d4ff", background: "#061427" },
      name: "Quirkies",
      tagline: "Collectibles. Lifestyle. Community.",
      description:
        "Quirkies is a colourful, energetic NFT community with playful art, big personality, and a strong collector culture.",
      tags: ["Neon", "Playful", "Lifestyle"],
      why: [
        "Colourful, playful PFPs with arcade energy and big personality.",
        "Lifestyle brand meets NFT — community events, culture, and collector pride.",
        "One of the most connected collector communities in the LO Labs orbit.",
        "Official site, X, and OpenSea for art, drops, and holder updates.",
      ],
      logo: "assets/logos/quirkies.png",
      logoInitials: "Q",
      banner: "linear-gradient(135deg, #00d4ff, #ff4fa3 55%, #061427)",
      website: "https://Quirkies.io",
      twitter: "https://x.com/quirkiesnft",
      openSea: "https://opensea.io/collection/quirkiesoriginals",
      featured: true,
      communityPick: true,
    },
    {
      id: "longlost",
      collectionId: "longlost",
      contract: "0x1347a97789cd3aa0b11433e8117f55ab640a0451",
      theme: { primary: "#8b3dff", background: "#07030d" },
      name: "The Long Lost",
      tagline: "Get LOST AF.",
      description:
        "The Long Lost is a mysterious, lore-driven community with underground energy, strong visuals, and a collector-first feel.",
      tags: ["Lore", "Mystery", "Ethereum"],
      why: [
        "Mystery-driven art with portals, conspiracy-wall energy, and an underground vibe.",
        "Lore-first community — every piece is part of a bigger story.",
        "Collectors connected across DDG, Quirkies, and beyond.",
        "Explore the world at longlostnft.com and on OpenSea.",
      ],
      logo: "assets/logos/longlost.png",
      logoInitials: "LL",
      banner: "linear-gradient(135deg, #8b3dff, #39ff88 40%, #07030d)",
      website: "https://longlostnft.com",
      twitter: "https://x.com/LongLostNFT",
      openSea: "https://opensea.io/collection/the-long-lost",
      communityPick: true,
    },
    {
      id: "ddg",
      collectionId: "ddg",
      contract: "0x9c51a3cb5094b26aa1dcb380f3dc7e1a7c681c2d",
      theme: { primary: "#e63cb4", background: "#12051f" },
      name: "Drop Dead Gorgeous",
      tagline: "Beauty fades. Legends don't.",
      description:
        "Drop Dead Gorgeous (DedGorgez) is a bold collector community built around striking skeleton art, ritual aesthetics, and premium Web3 identity — partnered with OG Triple Media and Little Ollie Labs.",
      tags: ["Art", "Partners", "Ethereum"],
      why: [
        "Memorable visual identity with real collector pride.",
        "Active, verified community channels for newcomers.",
        "Official partners with OG Triple Media and Little Ollie Labs — shared events and collector crossover.",
        "Strong friendships across OGenies, Quirkies, and the wider LO Labs orbit.",
      ],
      logo: "assets/logos/ddg.png",
      logoInitials: "DDG",
      banner: "linear-gradient(135deg, #e63cb4, #12051f)",
      website: "http://DedGorgez.com",
      twitter: "https://x.com/DedGorgez",
      discord: "https://discord.gg/u4C6r7d4e6",
      openSea: "https://opensea.io/collection/gorgez",
      hiddenGem: true,
    },
    {
      id: "space-riders",
      collectionId: "spaceriders",
      contract: "0xc9d198089d6c31d0ca5cc5b92c97a57a97bbfde2",
      theme: { primary: "#3b82f6", background: "#030712" },
      name: "Space Riders",
      tagline: "Ride the cosmos.",
      description:
        "Space Riders is a sci-fi NFT community built around cosmic art, rider culture, and collectors who explore the chain together.",
      tags: ["Sci-fi", "Adventure", "Ethereum"],
      why: [
        "Cohesive cosmic art with a clear brand world.",
        "Community-forward updates across official link hubs.",
        "Friendly crossover energy with other supported collections.",
      ],
      logo: "assets/logos/spaceriders.png",
      logoInitials: "SR",
      banner: "linear-gradient(135deg, #3b82f6, #030712)",
      website: "https://spaceriders.xyz/links",
      twitter: "https://x.com/SpaceRidersXYZ",
      openSea: "https://opensea.io/collection/spaceriders",
      featured: true,
      communityPick: true,
    },
    {
      id: "quirklings",
      collectionId: "quirklings",
      contract: "0x8f1b132e9fd2b9a2b210baa186bf1ae650adf7ac",
      theme: { primary: "#c084fc", background: "#0f0a1a" },
      name: "Quirklings",
      tagline: "Small quirks. Big energy.",
      description:
        "Quirklings are playful companions in the Quirkies universe — set-building culture, pastel energy, and collectors who pair pieces across both collections.",
      tags: ["Companion", "Playful", "Set-building"],
      why: [
        "Companion collection with clear pairing lore to Quirkies.",
        "Active set-building and display culture among holders.",
        "Approachable art that still feels premium on the wall.",
      ],
      logo: "assets/logos/quirklings.png",
      logoInitials: "QL",
      banner: "linear-gradient(135deg, #c084fc, #34d399)",
      website: "https://Quirkies.io",
      twitter: "https://x.com/quirkiesnft",
      openSea: "https://opensea.io/collection/quirklings",
      hiddenGem: true,
    },
    {
      id: "killabears",
      collectionId: "killabears",
      contract: "0xc99c679c50033bbc5321eb88752e89a93e9e83c5",
      theme: { primary: "#ef4444", background: "#0a0508" },
      name: "Killabears",
      tagline: "Cute bears. Sharp claws.",
      description:
        "Killabears is a bold PFP collection with playful bear art, strong holder culture, and a community that leans into character and lore.",
      tags: ["PFP", "Art", "Ethereum"],
      why: [
        "Distinctive bear characters with memorable traits and display culture.",
        "Active community across official X and link hubs.",
        "Easy to verify on OpenSea before you engage.",
      ],
      logo: "assets/logos/KBLogo.png",
      logoInitials: "KB",
      banner: "linear-gradient(135deg, #ef4444, #1a0a0f)",
      website: "https://killabears.com/links",
      twitter: "https://x.com/killabearsnft",
      openSea: "https://opensea.io/collection/killabears",
      communityPick: true,
    },
    {
      id: "akidcalledbeast",
      collectionId: "akidcalledbeast",
      contract: "0x77372a4cc66063575b05b44481f059be356964a4",
      theme: { primary: "#f97316", background: "#0c0806" },
      name: "A Kid Called Beast",
      tagline: "Beast mode. Collector pride.",
      description:
        "A Kid Called Beast is a high-energy NFT community built around expressive beast art, lifestyle culture, and collectors who show up for the brand.",
      tags: ["Lifestyle", "PFP", "Ethereum"],
      why: [
        "Recognizable beast characters with a cohesive visual world.",
        "Official site and socials for drops, updates, and holder culture.",
        "Strong crossover energy with collectors exploring new communities.",
      ],
      logo: "assets/logos/AKCBLogo.png",
      logoInitials: "AKCB",
      banner: "linear-gradient(135deg, #f97316, #0c0806)",
      website: "https://akidcalledbeast.com",
      twitter: "https://x.com/akidcalledbeast",
      openSea: "https://opensea.io/collection/akidcalledbeast",
      communityPick: true,
    },
    {
      id: "call-of-the-stars",
      collectionId: "call-of-the-stars",
      contract: "0x11ad9906f148c6b452f9617b350ce5c98660ab1c",
      theme: { primary: "#38bdf8", background: "#030712" },
      name: "Call of the Stars",
      tagline: "Answer the call.",
      description:
        "Call of the Stars is a cosmic NFT collection with stellar art, explorer energy, and a community drawn to space-themed identity and lore.",
      tags: ["Sci-fi", "Cosmic", "Ethereum"],
      why: [
        "Cohesive starfield aesthetic with clear collection identity.",
        "Holder updates and culture on official X.",
        "Worth a closer look if you love cosmic PFP worlds.",
      ],
      logo: "assets/logos/COTSLogo.png",
      logoInitials: "COTS",
      banner: "linear-gradient(135deg, #38bdf8, #030712)",
      twitter: "https://x.com/CallOfTheStarsX",
      openSea: "https://opensea.io/collection/call-of-the-stars",
      hiddenGem: true,
    },
  ];

  const brandCache = {};

  const $ = (sel, root) => (root || document).querySelector(sel);

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureHttps(url) {
    if (!url) return null;
    const s = String(url).trim();
    if (/^https?:\/\//i.test(s)) return s;
    return "https://" + s.replace(/^\/+/, "");
  }

  function applyCardLogo(cardEl, c, logoSrc) {
    const wrap = cardEl?.querySelector(".community-card__logo-wrap");
    if (!wrap || !logoSrc) return;
    let img = wrap.querySelector("img.community-card__logo");
    if (!img) {
      img = document.createElement("img");
      img.className = "community-card__logo";
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      const ph = wrap.querySelector(".community-card__logo--placeholder");
      if (ph) ph.replaceWith(img);
      else wrap.prepend(img);
    }
    img.src = logoSrc;
    img.alt = c.name;
    img.onerror = () => {
      const ph = document.createElement("span");
      ph.className = "community-card__logo community-card__logo--placeholder";
      ph.textContent = c.logoInitials || c.name.charAt(0);
      img.replaceWith(ph);
    };
  }

  function applyDetailLogo(c, logoSrc) {
    const logoEl = $("#detailLogo");
    if (!logoEl || !logoSrc) return;
    logoEl.src = logoSrc;
    logoEl.alt = c.name;
    logoEl.hidden = false;
    logoEl.onerror = () => {
      logoEl.hidden = true;
    };
  }

  function hydrateCommunityBrand(c, cardEl) {
    if (c.logo || !c.contract || !window.Web3HouseApi?.fetchCollectionBrand) {
      return Promise.resolve();
    }
    const key = c.contract.toLowerCase();
    if (brandCache[key]) {
      c.logo = brandCache[key];
      if (cardEl) applyCardLogo(cardEl, c, brandCache[key]);
      if (currentCommunity?.id === c.id) applyDetailLogo(c, brandCache[key]);
      return Promise.resolve();
    }
    return window.Web3HouseApi.fetchCollectionBrand(c.contract)
      .then((data) => {
        const raw = data.imageUrl;
        if (!raw) return;
        const url = window.Web3HouseApi.displayImageUrl(raw);
        if (!url) return;
        brandCache[key] = url;
        c.logo = url;
        if (cardEl) applyCardLogo(cardEl, c, url);
        if (currentCommunity?.id === c.id) applyDetailLogo(c, url);
      })
      .catch(() => {
        /* keep initials placeholder */
      });
  }

  function prefetchCollectionBrands() {
    COMMUNITIES.filter((c) => c.contract && !c.logo).forEach((c) => {
      hydrateCommunityBrand(c, null);
    });
  }

  function renderCard(c) {
    const gem = c.hiddenGem ? '<span class="tag tag--gem">Hidden gem</span>' : "";
    const tags = c.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("");
    const logo = c.logo
      ? `<img class="community-card__logo" src="${esc(c.logo)}" alt="" loading="lazy" decoding="async" />`
      : `<span class="community-card__logo community-card__logo--placeholder">${esc(c.logoInitials || c.name.charAt(0))}</span>`;

    const el = document.createElement("article");
    el.className = "community-card";
    el.setAttribute("role", "listitem");
    el.innerHTML = `
      <div class="community-card__frame">
        <div class="community-card__logo-wrap">${logo}</div>
        <h3 class="community-card__name">${esc(c.name)}</h3>
        ${
          c.studio
            ? `<p class="community-card__studio">by ${esc(c.studio)}</p>`
            : '<p class="community-card__studio community-card__studio--spacer" aria-hidden="true">&nbsp;</p>'
        }
        <p class="community-card__desc">${esc(c.description)}</p>
        <div class="community-card__tags">${gem}${tags}</div>
        <div class="community-card__nft-strip" aria-label="Collection preview">
          <div class="community-card__nft-cell community-card__nft-cell--placeholder"></div>
          <div class="community-card__nft-cell community-card__nft-cell--placeholder"></div>
          <div class="community-card__nft-cell community-card__nft-cell--placeholder"></div>
        </div>
        <button type="button" class="btn btn--secondary community-card__explore" data-id="${esc(c.id)}">
          Explore
        </button>
      </div>
    `;

    const img = el.querySelector("img.community-card__logo");
    if (img) {
      img.addEventListener("error", () => {
        const ph = document.createElement("span");
        ph.className = "community-card__logo community-card__logo--placeholder";
        ph.textContent = c.logoInitials || c.name.charAt(0);
        img.replaceWith(ph);
      });
    }

    if (window.Web3HouseSamples && (c.contract || c.staticArt)) {
      window.Web3HouseSamples.hydrateCardStrip(el, c);
    }

    hydrateCommunityBrand(c, el);

    el.querySelector(".community-card__explore").addEventListener("click", () => openDetail(c.id));
    return el;
  }

  function mountCards() {
    const featuredRow = $("#featuredRow");
    const discoverGrid = $("#discoverGrid");
    const communityGrid = $("#communityGrid");
    const gemsGrid = $("#gemsGrid");

    COMMUNITIES.filter((c) => c.featured).forEach((c) => featuredRow.appendChild(renderCard(c)));
    COMMUNITIES.forEach((c) => discoverGrid.appendChild(renderCard(c)));
    COMMUNITIES.filter((c) => c.communityPick).forEach((c) => communityGrid.appendChild(renderCard(c)));
    COMMUNITIES.filter((c) => c.hiddenGem).forEach((c) => gemsGrid.appendChild(renderCard(c)));
  }

  var currentCommunity = null;

  function openDetail(id) {
    const c = COMMUNITIES.find((x) => x.id === id);
    const detailModal = $("#detailModal");
    if (!c || !detailModal) return;
    currentCommunity = c;

    const banner = $("#detailBanner");
    if (banner) banner.style.background = c.banner;

    const logoEl = $("#detailLogo");
    if (logoEl) {
      if (c.logo) {
        logoEl.src = c.logo;
        logoEl.alt = c.name;
        logoEl.hidden = false;
        logoEl.onerror = () => {
          logoEl.hidden = true;
        };
      } else {
        logoEl.hidden = true;
      }
    }

    $("#detailTitle").textContent = c.name;

    const tagline = $("#detailTagline");
    const taglineParts = [];
    if (c.studio) taglineParts.push("Collection from " + c.studio);
    if (c.tagline) taglineParts.push(c.tagline);
    tagline.textContent = taglineParts.join(" · ");
    tagline.hidden = !taglineParts.length;

    $("#detailDesc").textContent = c.description;
    $("#detailWhy").innerHTML = c.why.map((item) => `<li>${esc(item)}</li>`).join("");

    hydrateCommunityBrand(c, null);

    const linkItems = [];
    const websiteHref = ensureHttps(c.website);
    if (websiteHref) {
      linkItems.push({
        label: c.studio ? c.studio + " links" : "Website",
        href: websiteHref,
      });
    }
    if (c.twitter) linkItems.push({ label: "X / Twitter", href: c.twitter });
    if (c.discord) linkItems.push({ label: "Discord", href: c.discord });
    if (c.openSea) linkItems.push({ label: "OpenSea", href: c.openSea });
    if (c.magicEden) linkItems.push({ label: "Magic Eden", href: c.magicEden });

    $("#detailLinks").innerHTML = linkItems
      .map(
        (l) =>
          `<a class="detail__link" href="${esc(l.href)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a>`
      )
      .join("");

    var galleryRefreshBtn = $("#galleryRefreshBtn");
    if (window.Web3HouseSamples) {
      window.Web3HouseSamples.loadGallery(
        c,
        $("#detailGallery"),
        $("#detailGalleryNote"),
        galleryRefreshBtn
      );
    }

    if (galleryRefreshBtn && !galleryRefreshBtn.dataset.bound) {
      galleryRefreshBtn.dataset.bound = "1";
      galleryRefreshBtn.addEventListener("click", function () {
        galleryRefreshBtn.dataset.force = "1";
        if (window.Web3HouseSamples && currentCommunity) {
          window.Web3HouseSamples.loadGallery(
            currentCommunity,
            $("#detailGallery"),
            $("#detailGalleryNote"),
            galleryRefreshBtn
          );
        }
      });
    }

    if (typeof detailModal.showModal === "function") {
      detailModal.showModal();
    } else {
      detailModal.setAttribute("open", "");
    }

    history.replaceState(null, "", "#community-" + c.id);
  }

  function closeDetail() {
    const detailModal = $("#detailModal");
    if (!detailModal) return;
    if (typeof detailModal.close === "function") {
      detailModal.close();
    } else {
      detailModal.removeAttribute("open");
    }
    if (location.hash.startsWith("#community-")) {
      history.replaceState(null, "", location.pathname + location.search + "#hub");
    }
  }

  function enterHub() {
    document.body.classList.add("hub-visible", "hub-active");
    $("#hub").scrollIntoView({ behavior: "smooth", block: "start" });
    $("#hub").focus({ preventScroll: true });
    history.replaceState(null, "", "#hub");
    if (window.Web3HouseSamples) {
      window.Web3HouseSamples.prefetchAll(COMMUNITIES);
    }
    prefetchCollectionBrands();
  }

  function toggleRecommend(show) {
    const recommendForm = $("#recommendForm");
    const openRecommendBtn = $("#openRecommendBtn");
    recommendForm.hidden = !show;
    openRecommendBtn.hidden = show;
    if (show) recommendForm.querySelector('input[name="name"]')?.focus();
  }

  function handleRecommendSubmit(e) {
    e.preventDefault();
    const form = $("#recommendForm");
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const link = String(fd.get("link") || "").trim();
    const why = String(fd.get("why") || "").trim();
    const contact = String(fd.get("contact") || "").trim();

    const subject = encodeURIComponent("Web3House community recommendation: " + name);
    const body = encodeURIComponent(
      [
        "Web3House — Community Recommendation",
        "",
        "Collection: " + name,
        "Link: " + link,
        "",
        "Why we should check them out:",
        why,
        "",
        contact ? "From: " + contact : "From: (anonymous)",
      ].join("\n")
    );

    window.location.href = "mailto:" + MAILTO + "?subject=" + subject + "&body=" + body;
    form.reset();
    toggleRecommend(false);
  }

  function scrollToSection(id) {
    const target = document.querySelector(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", id);
    updateHubNavActive(id);
  }

  function updateHubNavActive(activeId) {
    document.querySelectorAll(".hub-nav__link").forEach((link) => {
      const href = link.getAttribute("href");
      link.classList.toggle("is-active", href === activeId);
    });
  }

  function bindHubNav() {
    const links = document.querySelectorAll(".hub-nav__link");
    const sectionIds = Array.from(links)
      .map((a) => a.getAttribute("href"))
      .filter(Boolean);

    links.forEach((link) => {
      link.addEventListener("click", (e) => {
        const href = link.getAttribute("href");
        if (!href || !href.startsWith("#")) return;
        e.preventDefault();
        if (!document.body.classList.contains("hub-visible")) {
          document.body.classList.add("hub-visible", "hub-active");
        }
        scrollToSection(href);
      });
    });

    if (!sectionIds.length || !("IntersectionObserver" in window)) return;

    const sections = sectionIds
      .map((id) => document.querySelector(id))
      .filter(Boolean);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          updateHubNavActive("#" + visible[0].target.id);
        }
      },
      { rootMargin: "-40% 0px -45% 0px", threshold: [0, 0.15, 0.35] }
    );

    sections.forEach((el) => observer.observe(el));
  }

  function bindEvents() {
    bindHubNav();
    $("#enterBtn")?.addEventListener("click", enterHub);
    $("#detailClose")?.addEventListener("click", closeDetail);
    $("#detailBackBtn")?.addEventListener("click", closeDetail);

    const detailModal = $("#detailModal");
    detailModal?.addEventListener("click", (e) => {
      if (e.target === detailModal) closeDetail();
    });
    detailModal?.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeDetail();
    });

    $("#openRecommendBtn")?.addEventListener("click", () => toggleRecommend(true));
    $("#closeRecommendBtn")?.addEventListener("click", () => toggleRecommend(false));
    $("#recommendForm")?.addEventListener("submit", handleRecommendSubmit);

    const hash = location.hash;
    const hubSectionHashes = ["#hub", "#featured", "#discover", "#community", "#gems", "#recommend"];
    if (hubSectionHashes.includes(hash) || hash.startsWith("#community-")) {
      document.body.classList.add("hub-visible", "hub-active");
      if (hash !== "#hub" && hubSectionHashes.includes(hash)) {
        requestAnimationFrame(() => scrollToSection(hash));
      }
      const id = hash.replace("#community-", "");
      if (id && COMMUNITIES.some((c) => c.id === id)) {
        requestAnimationFrame(() => openDetail(id));
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    mountCards();
    bindEvents();
  });
})();
