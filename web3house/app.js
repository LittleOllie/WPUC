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
      tagline:
        "Building stories, characters, apps, and friendships — one little adventure at a time.",
      description:
        "Little Ollie is a creative Web3 world built around stories, characters, games, apps, collectibles, and community. What started as a small father-and-son idea slowly evolved into an ongoing builder journey focused on creativity, experimentation, fun, and genuine connection.",
      tags: ["Art", "Community", "Builders", "Storytelling", "Gaming", "Family", "Creativity", "Web3"],
      why: [
        "A welcoming community focused on creativity and good vibes.",
        "Ongoing games, tools, experiments, and fun Web3 apps.",
        "A growing world of original Little Ollie characters and stories.",
        "A genuine builder journey shared openly with the community.",
        "Strong focus on collaboration and supporting other communities.",
      ],
      logo: "assets/logos/LOLogo.png",
      logoInitials: "LO",
      theme: { primary: "#6de0ff", background: "#14121c" },
      banner:
        "linear-gradient(155deg, rgba(255, 221, 85, 0.32) 0%, rgba(109, 224, 255, 0.22) 38%, #14121c 72%)",
      website: "https://littleollielabs.com/links/",
      twitter: "https://x.com/LittleOllieNFT",
      featured: true,
      communityPick: true,
      /* Studio brand — no on-chain collection; use local character art */
      staticArt: [
        { tokenId: "11", name: "Little Ollie #11", imageUrl: "assets/logos/LO11.png" },
        { tokenId: "22", name: "Little Ollie #22", imageUrl: "assets/logos/LO22.png" },
        { tokenId: "33", name: "Little Ollie #33", imageUrl: "assets/logos/LO33.png" },
        { tokenId: "44", name: "Little Ollie #44", imageUrl: "assets/logos/LO44.png" },
      ],
      showcase: {
        connectedIds: ["ogenies", "space-riders", "quirkies", "ddg"],
        stats: {
          founded: "2020",
          chain: "Web3",
          collectionSize: "Growing universe",
          holders: "Community-first",
          twitterFollowing: "Active on X/Twitter",
          discordMembers: "—",
        },
        about: {
          paragraphs: [
            "Little Ollie is a creative Web3 world built around stories, characters, games, apps, collectibles, and community. What started as a small father-and-son idea slowly evolved into an ongoing builder journey focused on creativity, experimentation, fun, and genuine connection.",
            "This is a builder-led space — not the loudest project in Web3, but one that genuinely loves creating, learning, and sharing the journey with kind people along the way.",
          ],
          quote: {
            text:
              "Building stories, characters, apps, and friendships — one little adventure at a time.",
            attribution: "— Little Ollie",
          },
        },
        founder: {
          name: "Little Ollie Labs",
          title: "Creators · Little Ollie",
          avatarInitials: "LO",
          paragraphs: [
            "Hey everyone 👋",
            "Welcome to Little Ollie.",
            "What started as a small father-and-son idea slowly grew into a creative little world full of stories, characters, games, experiments, apps, collectibles, and amazing people. We've never really tried to be the loudest project in Web3 — we just genuinely love building, learning, creating, and having fun with good people around us.",
            "Our community is made up of artists, collectors, builders, parents, gamers, and genuinely kind humans who enjoy creativity and supporting each other. Whether you're completely new to Web3 or have been around for years, we just want this to feel like a relaxed place where you can hang out, explore, and be part of the journey.",
            "We're still learning every day, still experimenting, and still building things together. Thanks for being here 💛",
          ],
        },
        whyStay: [
          {
            title: "Creativity",
            text: "There's always a new idea, story, character, app, or experiment being built and shared with the community.",
          },
          {
            title: "Friendships",
            text: "People genuinely connect here beyond NFTs and support each other through both Web3 and real life.",
          },
          {
            title: "Fun",
            text: "Little Ollie has always focused on keeping things enjoyable, playful, and welcoming instead of overly serious.",
          },
          {
            title: "Building Together",
            text: "The community gets to watch ideas evolve in real time and often helps shape what gets created next.",
          },
        ],
      },
    },
    {
      id: "ogenies",
      collectionId: "ogenies",
      logoEdgeFill: true,
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
      name: "DropDed Gorgez",
      tagline: "Beauty fades. Legends don't.",
      description:
        "DropDed Gorgez is a bold collector community built around striking skeleton art, ritual aesthetics, and premium Web3 identity — partnered with OG Triple Media and Little Ollie Labs.",
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
      logoEdgeFill: true,
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
      logoEdgeFill: true,
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
      logoEdgeFill: true,
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
      logoEdgeFill: true,
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
      logoEdgeFill: true,
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
    {
      id: "ghost-labs",
      collectionId: "ghost-lab",
      logoEdgeFill: true,
      contract: "0x375dfbe7ebdf082276fc0cb9447932dc1bb6e306",
      theme: { primary: "#a5b4fc", background: "#0a0c12" },
      name: "Ghost Labs",
      tagline: "Pixel ghosts. Tools & lore.",
      description:
        "Ghost Labs is a verified Ethereum collection of pixelated ghosts — empowering the community with useful tools, creative lore, and holder-first culture.",
      tags: ["Pixel art", "Tools", "Ethereum"],
      why: [
        "Distinctive pixel ghost art with a cohesive lab identity.",
        "Community-built tools and lore — utility with personality.",
        "Verified collection — confirm links on ghost-lab.xyz, X, and Discord before you engage.",
        "A welcoming room for newcomers who like retro art and creative communities.",
      ],
      logo: "assets/logos/GLLogo.png",
      logoInitials: "GL",
      banner: "linear-gradient(135deg, #c4b5fd, #6366f1 42%, #0a0c12)",
      website: "https://ghost-lab.xyz/",
      twitter: "https://x.com/GhostLabNFT",
      discord: "https://discord.gg/QeCMSE6HfE",
      openSea: "https://opensea.io/collection/ghost-lab-collection",
      featured: true,
      communityPick: true,
      showcase: {
        stats: {
          founded: "2021",
          chain: "Ethereum",
          collectionSize: "8,201",
          holders: "1,150+",
        },
        founder: {
          name: "Ghost Lab Team",
          title: "Founders · Ghost Labs",
          avatarInitials: "GL",
          message:
            "We built Ghost Labs for collectors who want more than PFPs — useful tools, creative lore, and a community that actually shows up. Whether you're brand new to Web3 or you've been collecting for years, you're welcome to haunt the lab with us.",
        },
      },
    },
    {
      id: "less-than-three",
      collectionId: "lessthanthree",
      logoEdgeFill: true,
      contract: "0x4ef6f6a7ee7d1cf7f1f7bfad2ba56baab868de48",
      theme: { primary: "#f472b6", background: "#1a0a14" },
      name: "Less Than Three",
      tagline: "Stories for every heart.",
      description:
        "Less Than Three expresses the human condition through 5,555 characters — a verified Ethereum collection rooted in growth, community, and a brand building across Web3 and beyond.",
      tags: ["Story", "Art", "Ethereum"],
      why: [
        "Character-driven art with a clear emotional, story-first identity.",
        "Active community across official Linktree, X, and Discord.",
        "Verified collection — easy to confirm before you mint or join chats.",
        "Strong crossover appeal if you love culture, creativity, and long-term brand building.",
      ],
      logo: "assets/logos/LT3Logo.png",
      logoInitials: "LT3",
      banner: "linear-gradient(135deg, #f472b6, #fb7185 40%, #1a0a14)",
      website: "https://linktr.ee/lt3nft",
      twitter: "https://x.com/LT3NFT",
      discord: "https://discord.gg/LT3NFT",
      openSea: "https://opensea.io/collection/lessthanthree",
      featured: true,
      communityPick: true,
      showcase: {
        stats: {
          founded: "2022",
          chain: "Ethereum",
          collectionSize: "5,555",
          holders: "2,000+",
        },
        founder: {
          name: "LT3 Team",
          title: "Founders · Less Than Three",
          avatarInitials: "LT3",
          message:
            "Less Than Three is built on supporting each heart's path — art, community, and real-world storytelling woven together. Whether you're new to Web3 or you've been here for years, we invite you to grow with us.",
        },
      },
    },
    {
      id: "rug-dollz",
      collectionId: "officialrugdollz",
      logoEdgeFill: true,
      contract: "0x291ac379af66e25bd8488b3154f076b27b9f9e36",
      theme: { primary: "#f9a8d4", background: "#1a1020" },
      name: "Rug Dollz",
      tagline: "Every stitch starts with imagination.",
      description:
        "Rug Dollz is the original stitched-companion collection that sparked the Dollz culture — 5,555 characters, cozy lore, and a community that grew into games, staking, and the wider Dollz World ecosystem.",
      tags: ["Art", "Community", "Ethereum"],
      why: [
        "The founding drop of the Dollz universe — lore and culture that kept growing.",
        "Distinct stitched-companion art with a warm, collectible identity.",
        "Verified collection — use official Linktree, X, and Discord before you engage.",
        "Great entry point if you love creative communities with games and world-building.",
      ],
      logo: "assets/logos/RDLogo.png",
      logoInitials: "RD",
      banner: "linear-gradient(135deg, #f9a8d4, #c084fc 42%, #1a1020)",
      website: "https://linktr.ee/RugDollzOfficial",
      twitter: "https://x.com/RugDollzNFT",
      discord: "https://discord.gg/gDbKRcfewN",
      openSea: "https://opensea.io/collection/officialrugdollz",
      featured: true,
      communityPick: true,
      showcase: {
        stats: {
          founded: "2021",
          chain: "Ethereum",
          collectionSize: "5,555",
          holders: "900+",
        },
        founder: {
          name: "Rug Dollz Team",
          title: "Founders · Rug Dollz",
          avatarInitials: "RD",
          message:
            "Rug Dollz was our very first collection — the spark that started Dollz culture. Whether you're brand new to Web3 or you've been collecting for years, you're welcome to stitch your story into our community with us.",
        },
      },
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

  function applyCardWatermark(cardEl, logoSrc) {
    const wm = cardEl?.querySelector(".community-card__watermark");
    if (!wm) return;
    if (logoSrc) {
      wm.style.backgroundImage =
        'url("' + String(logoSrc).replace(/"/g, "%22") + '")';
      wm.classList.add("is-visible");
    } else {
      wm.style.backgroundImage = "";
      wm.classList.remove("is-visible");
    }
  }

  function usesLogoEdgeFill(c) {
    return Boolean(c?.logoEdgeFill);
  }

  function applyCardLogo(cardEl, c, logoSrc) {
    const wrap = cardEl?.querySelector(".community-card__logo-wrap");
    if (!wrap || !logoSrc) return;
    wrap.classList.toggle("community-card__logo-wrap--edge", usesLogoEdgeFill(c));
    applyCardWatermark(cardEl, logoSrc);
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
    const logoWrap = document.querySelector(".detail__logo-wrap");
    if (logoWrap) logoWrap.classList.toggle("detail__logo-wrap--edge", usesLogoEdgeFill(c));
    if (!logoEl || !logoSrc) return;
    logoEl.src = logoSrc;
    logoEl.alt = c.name;
    logoEl.hidden = false;
    logoEl.onerror = () => {
      logoEl.hidden = true;
    };
    if (window.Web3HouseShowcase) {
      window.Web3HouseShowcase.setWatermark($("#detailWatermark"), logoSrc);
    }
  }

  function hydrateCommunityBrand(c, cardEl) {
    if (c.logo || !c.contract || !window.Web3HouseApi?.fetchCollectionBrand) {
      return Promise.resolve();
    }
    const key = c.contract.toLowerCase();
    if (brandCache[key]) {
      c.logo = brandCache[key];
      if (cardEl) {
        applyCardLogo(cardEl, c, brandCache[key]);
        applyCardWatermark(cardEl, brandCache[key]);
      }
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
        if (cardEl) {
          applyCardLogo(cardEl, c, url);
          applyCardWatermark(cardEl, url);
        }
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
    const edgeWrap = usesLogoEdgeFill(c) ? " community-card__logo-wrap--edge" : "";
    const logo = c.logo
      ? `<img class="community-card__logo" src="${esc(c.logo)}" alt="" loading="lazy" decoding="async" />`
      : `<span class="community-card__logo community-card__logo--placeholder">${esc(c.logoInitials || c.name.charAt(0))}</span>`;

    const el = document.createElement("article");
    el.className = "community-card";
    el.dataset.communityId = c.id;
    el.setAttribute("role", "listitem");
    el.innerHTML = `
      <div class="community-card__watermark" aria-hidden="true"></div>
      <div class="community-card__frame">
        <div class="community-card__logo-wrap${edgeWrap}">${logo}</div>
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
        applyCardWatermark(el, null);
      });
    }

    if (c.logo) applyCardWatermark(el, c.logo);

    if (window.Web3HouseSamples && (c.contract || c.staticArt)) {
      window.Web3HouseSamples.hydrateCardStrip(el, c);
    }

    hydrateCommunityBrand(c, el);

    el.querySelector(".community-card__explore").addEventListener("click", () => openDetail(c.id));
    return el;
  }

  function mountCards() {
    const discoverGrid = $("#discoverGrid");
    if (!discoverGrid) return;
    discoverGrid.innerHTML = "";
    COMMUNITIES.forEach((c) => discoverGrid.appendChild(renderCard(c)));
  }

  function openRecommendMailto() {
    const subject = encodeURIComponent("Web3House community recommendation");
    const body = encodeURIComponent(
      "Hi Little Ollie Labs,\n\nI'd like to recommend a community for Web3House:\n\nName:\nLink:\nWhy:\n\nThanks!"
    );
    window.location.href = "mailto:" + MAILTO + "?subject=" + subject + "&body=" + body;
  }

  var currentCommunity = null;

  function scrollDetailToTop() {
    const scrollRoot = $("#detailScroll");
    if (!scrollRoot) return;
    scrollRoot.scrollTop = 0;
    scrollRoot.scrollLeft = 0;
    requestAnimationFrame(() => {
      scrollRoot.scrollTop = 0;
      requestAnimationFrame(() => {
        scrollRoot.scrollTop = 0;
      });
    });
  }

  function loadDetailArt(c) {
    if (!window.Web3HouseSamples) return;
    window.Web3HouseSamples.loadCarousel(
      c,
      $("#detailNftCarousel"),
      $("#detailNftBand")
    );
    window.Web3HouseSamples.loadFooterGallery(c, $("#detailNftFooter"));
  }

  function openDetail(id) {
    const c = COMMUNITIES.find((x) => x.id === id);
    const detailModal = $("#detailModal");
    const panel = $("#detailPanel");
    if (!c || !detailModal || !panel) return;

    const wasOpen = detailModal.open || detailModal.hasAttribute("open");
    currentCommunity = c;

    scrollDetailToTop();

    if (window.Web3HouseShowcase) {
      window.Web3HouseShowcase.populate({
        community: c,
        panel: panel,
        allCommunities: COMMUNITIES,
        ensureHttps: ensureHttps,
        onExplore: openDetail,
      });
    }

    hydrateCommunityBrand(c, null);
    loadDetailArt(c);

    scrollDetailToTop();

    if (!wasOpen) {
      if (typeof detailModal.showModal === "function") {
        detailModal.showModal();
      } else {
        detailModal.setAttribute("open", "");
      }
    }

    scrollDetailToTop();

    history.replaceState(null, "", "#community-" + c.id);
  }

  function closeDetail() {
    window.Web3HouseShowcase?.closeJoinModal?.();
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

  function enterHub(opts) {
    const instant = opts && opts.instant;
    const afterTransition = opts && opts.afterTransition;
    document.body.classList.add("hub-visible", "hub-active");
    const hub = $("#hub");
    if (hub) {
      if (afterTransition) {
        window.Web3HouseEntry?.scrollPageToTop?.();
      } else {
        hub.scrollIntoView({ behavior: instant ? "auto" : "smooth", block: "start" });
      }
      hub.focus({ preventScroll: true });
    }
    history.replaceState(null, "", "#hub");
    if (window.Web3HouseSamples) {
      window.Web3HouseSamples.prefetchAll(COMMUNITIES);
    }
    prefetchCollectionBrands();
  }

  function handleEnterClick() {
    const btn = $("#enterBtn");
    if (btn?.disabled) return;

    const entryApi = window.Web3HouseEntry;
    if (!entryApi?.playEnterTransition) {
      enterHub();
      return;
    }

    btn.disabled = true;

    entryApi.playEnterTransition(() => enterHub({ afterTransition: true }), { cinematic: true });
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
    document.querySelectorAll('a.hub-nav__link[href^="#"]').forEach((link) => {
      const href = link.getAttribute("href");
      link.classList.toggle("is-active", href === activeId);
    });
  }

  function bindHubNav() {
    const links = document.querySelectorAll('a.hub-nav__link[href^="#"]');
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
    $("#enterBtn")?.addEventListener("click", handleEnterClick);
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
    const hubSectionHashes = ["#hub", "#spotlight", "#discover", "#new-to-web3", "#featured"];
    if (hubSectionHashes.includes(hash) || hash.startsWith("#community-")) {
      document.body.classList.add("hub-visible", "hub-active", "entry-done");
      window.Web3HouseEntry?.markVisited?.();
      if (hash !== "#hub" && hubSectionHashes.includes(hash)) {
        const scrollTarget = hash === "#featured" ? "#spotlight" : hash;
        requestAnimationFrame(() => scrollToSection(scrollTarget));
      }
      const id = hash.replace("#community-", "");
      if (id && COMMUNITIES.some((c) => c.id === id)) {
        requestAnimationFrame(() => openDetail(id));
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.Web3HouseEntry?.init?.();
    window.Web3HouseEntryHero?.init?.();
    mountCards();
    bindEvents();
    if (window.Web3HouseAtmosphere) {
      window.Web3HouseAtmosphere.init({
        communities: COMMUNITIES,
        openDetail: openDetail,
        openRecommend: openRecommendMailto,
      });
    }
    window.Web3HouseQuiz?.init?.({
      communities: COMMUNITIES,
      onEnterHub: handleEnterClick,
    });
  });
})();
