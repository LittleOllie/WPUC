/**
 * Web3House — shared “New to Web3?” FAQ content + accordion renderer
 */
(function (global) {
  "use strict";

  var NEW_TO_WEB3_TOPICS = [
    {
      icon: "✨",
      title: "What is an NFT?",
      intro:
        "NFT stands for “non-fungible token” — a fancy name for a one-of-a-kind digital item you can own, collect, or use online.",
      sections: [
        {
          heading: "Think of it like this",
          text:
            "A concert ticket with your seat number, a signed baseball card, or a piece of art in a gallery — each is unique. NFTs work the same way on the internet. Your ownership is recorded on a public ledger (usually a blockchain), so everyone can see it is yours without a middleman holding the item for you.",
        },
        {
          heading: "What people actually do with them",
          text:
            "Collect art and PFPs (profile pictures), join Discord communities, get event access, play games, vote on project decisions, or simply support artists they believe in. The value is often the culture and friendships around the collection — not just the image file.",
        },
        {
          heading: "What an NFT is not",
          text:
            "It is not automatic money, not a guaranteed investment, and not something you must buy to enjoy Web3House. You can browse communities here without owning anything.",
        },
      ],
      tips: [
        "Right-clicking and saving an image does not give you the NFT — ownership lives on-chain.",
        "Two NFTs from the same collection can look similar but have different traits and rarity.",
        "Many communities welcome collectors and curious visitors alike.",
      ],
    },
    {
      icon: "🔑",
      title: "What is a wallet?",
      intro:
        "A crypto wallet is your personal keyring for the internet — it holds the keys to your digital items, not the items themselves in a bank vault.",
      sections: [
        {
          heading: "How it works",
          text:
            "When you “connect” a wallet to a website, you are proving you control an address — like showing ID at a club door. You approve each action (signing a message or transaction). You can disconnect anytime.",
        },
        {
          heading: "Hot vs cold wallets",
          text:
            "Hot wallets (browser extensions, mobile apps) are convenient for everyday use. Cold wallets (hardware devices) stay offline and are better for long-term storage of valuable items. Many people use both.",
        },
        {
          heading: "You do not need one to browse",
          text:
            "Web3House, official community sites, and most social channels work without a wallet. You only need a wallet when you want to buy, sell, mint, or claim something on-chain.",
        },
      ],
      tips: [
        "Write down your recovery phrase on paper — never in a screenshot or DM.",
        "Start with a well-known wallet app and download only from the official site.",
        "Use a separate wallet for experiments if you are just learning.",
      ],
    },
    {
      icon: "🛡️",
      title: "Staying safe online",
      intro:
        "Web3 can feel wild at first. A few simple habits protect you more than any fancy tool.",
      sections: [
        {
          heading: "Your recovery phrase is sacred",
          text:
            "Anyone with your 12- or 24-word seed phrase owns everything in that wallet forever. No real company will ever ask for it — not support, not founders, not “verification bots.” If someone asks, it is a scam.",
        },
        {
          heading: "Slow down before you sign",
          text:
            "Wallet pop-ups can approve transfers, permissions, or access to all your NFTs. Read what the site is asking for. If you do not understand it, close the window and ask in an official Discord channel.",
        },
        {
          heading: "Protect your identity",
          text:
            "Use strong passwords and 2FA on email and Discord. Be careful linking your real name to your wallet address if privacy matters to you. It is okay to use a nickname in communities.",
        },
      ],
      tips: [
        "Bookmark official sites — do not trust Google ads or random reply links.",
        "If an offer feels urgent, it is often designed to stop you thinking.",
        "When in doubt, ask a mod in the official server before clicking.",
      ],
    },
    {
      icon: "🚨",
      title: "Avoiding scams",
      intro:
        "Scammers copy logos, websites, and founder names. Learning their patterns keeps you ahead of them.",
      sections: [
        {
          heading: "Common tricks",
          text:
            "Fake mint sites, “claim your airdrop” links, impersonator DMs, hacked founder accounts, and Discord bots that DM you first. They create fear (“your wallet will be locked”) or greed (“free double your ETH”).",
        },
        {
          heading: "Red flags",
          text:
            "Unsolicited DMs, misspelled URLs, requests for your seed phrase, pressure to act in the next few minutes, and projects with no verifiable history. Real teams announce in official channels — not random DMs.",
        },
        {
          heading: "If something goes wrong",
          text:
            "Revoke suspicious token approvals using a trusted tool, move remaining assets to a new wallet if needed, and report the scam URL. You cannot reverse most on-chain transactions — prevention matters most.",
        },
      ],
      tips: [
        "Compare the URL character-by-character with the link on the project’s official X bio.",
        "Never install browser extensions someone sends you in Discord.",
        "“Support” that contacts you first is almost never real support.",
      ],
    },
    {
      icon: "🔗",
      title: "Official links only",
      intro:
        "The safest path to a community is through links the team controls — not through hype posts or search results.",
      sections: [
        {
          heading: "What to trust on Web3House",
          text:
            "Each community page lists verified website, X/Twitter, Discord, and OpenSea buttons we have checked. Use those as your starting point instead of typing the project name into Google during a busy drop.",
        },
        {
          heading: "Building your own bookmark habit",
          text:
            "When you find a project you like, save the official site from their verified X profile. Avoid shortened links in replies unless you know who posted them.",
        },
        {
          heading: "Discord safety",
          text:
            "Turn off DMs from server members if you want fewer scam messages. Only click links in official announcement channels, not general chat.",
        },
      ],
      tips: [
        "Founders rarely announce surprise mints only via DM.",
        "OpenSea collection URLs should match the contract the community shares.",
        "If two sites look identical, check the URL and social verification.",
      ],
    },
    {
      icon: "🎟️",
      title: "What is minting?",
      intro:
        "Minting means claiming a brand-new NFT directly from the project — usually at launch or during a special event.",
      sections: [
        {
          heading: "Why people mint",
          text:
            "Early supporters often mint at a set price before items appear on secondary marketplaces. It can be exciting — like opening night — but prices can go up or down afterward. Nobody can promise profits.",
        },
        {
          heading: "Before you mint",
          text:
            "Confirm the official mint page, understand the total cost (mint price + network “gas” fees), and know what chain you are on (Ethereum mainnet is most common for the collections here). Have only what you are willing to spend in that wallet.",
        },
        {
          heading: "After you mint",
          text:
            "Your NFT shows in your wallet and usually on OpenSea within minutes. Join the community Discord to learn utility, events, and how holders connect.",
        },
      ],
      tips: [
        "Gas fees spike when the network is busy — you can wait or try later.",
        "Allowlist / presale spots come from official announcements, not random forms.",
        "Screenshot your transaction if you need help from mods.",
      ],
    },
    {
      icon: "🌱",
      title: "How to join communities",
      intro:
        "The best Web3 experiences are social. You do not need to be a whale or a developer — curious and kind is enough.",
      sections: [
        {
          heading: "A gentle path in",
          text:
            "Follow the project on X, read their pinned posts, and lurk in Discord until it feels familiar. Many servers have intro channels — say hi when you are ready. Ask beginner questions; good communities answer without shame.",
        },
        {
          heading: "What to look for",
          text:
            "Active art and memes, founders who show up, mods who enforce kindness, and clear rules against harassment and scams. Culture matters more than floor price charts.",
        },
        {
          heading: "How Web3House helps",
          text:
            "Browse collections, read founder notes, and explore verified links in one cozy place. When a community clicks, dive deeper on their page — no wallet required until you choose to participate on-chain.",
        },
      ],
      tips: [
        "Set notifications for announcements only if you want — not every channel.",
        "Fan art and memes are often how you learn the inside jokes.",
        "It is fine to collect zero NFTs and still enjoy the culture.",
      ],
    },
    {
      icon: "💬",
      title: "Words you will hear",
      intro:
        "Quick definitions so Discord and X make more sense on day one.",
      sections: [
        {
          heading: "Community & culture",
          text:
            "Holders — people who own at least one NFT from the collection. Floor price — the cheapest listed item on a marketplace right now (not the same as “value”). PFP — profile picture project. Lore — the story and world-building around the art.",
        },
        {
          heading: "Marketplaces",
          text:
            "OpenSea and similar sites are where people list NFTs for sale. Listings are asks; offers are bids. Always check you are on the right collection contract.",
        },
        {
          heading: "On-chain basics",
          text:
            "Gas — a small network fee paid to process transactions. ETH — Ethereum’s currency. Contract — the code address that defines the collection. DYOR — do your own research; stay curious and skeptical of hype.",
        },
      ],
      tips: [
        "Nobody knows everything on day one — asking is normal.",
        "Glossary posts in official Discords are usually pinned.",
        "Slang varies by community; context beats memorizing.",
      ],
    },
  ];

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderTopicBody(topic, prefix) {
    var html = "";
    if (topic.intro) {
      html += '<p class="' + prefix + '-item__intro">' + esc(topic.intro) + "</p>";
    }
    if (topic.sections && topic.sections.length) {
      html += '<div class="' + prefix + '-item__sections">';
      topic.sections.forEach(function (sec) {
        html +=
          "<h4 class=\"" +
          prefix +
          '-item__subhead">' +
          esc(sec.heading) +
          "</h4><p>" +
          esc(sec.text) +
          "</p>";
      });
      html += "</div>";
    }
    if (topic.tips && topic.tips.length) {
      html += '<p class="' + prefix + '-item__tips-label">Quick tips</p><ul class="' + prefix + '-item__tips">';
      topic.tips.forEach(function (tip) {
        html += "<li>" + esc(tip) + "</li>";
      });
      html += "</ul>";
    }
    return html;
  }

  /**
   * @param {{ prefix?: string, openFirst?: boolean, showIcon?: boolean }} opts
   */
  function renderAccordionHtml(opts) {
    var prefix = (opts && opts.prefix) || "hub-web3";
    var openFirst = !!(opts && opts.openFirst);
    var showIcon = opts && opts.showIcon;

    return NEW_TO_WEB3_TOPICS.map(function (topic, i) {
      var iconHtml = showIcon && topic.icon
        ? '<span class="' + prefix + '-item__icon" aria-hidden="true">' + topic.icon + "</span>"
        : "";
      return (
        '<details class="' +
        prefix +
        "-item\"" +
        (openFirst && i === 0 ? " open" : "") +
        ">" +
        '<summary class="' +
        prefix +
        '-item__summary">' +
        iconHtml +
        "<span class=\"" +
        prefix +
        '-item__title">' +
        esc(topic.title) +
        "</span></summary>" +
        '<div class="' +
        prefix +
        '-item__body">' +
        renderTopicBody(topic, prefix) +
        "</div></details>"
      );
    }).join("");
  }

  function bindExclusiveAccordion(root) {
    if (!root) return;
    root.querySelectorAll("details").forEach(function (detail) {
      detail.addEventListener("toggle", function () {
        if (!detail.open) return;
        root.querySelectorAll("details").forEach(function (other) {
          if (other !== detail) other.open = false;
        });
      });
    });
  }

  function mountHubAccordion() {
    var root = document.getElementById("hubWeb3Accordion");
    if (!root) return;
    root.innerHTML = renderAccordionHtml({ prefix: "hub-web3", showIcon: true });
    bindExclusiveAccordion(root);
  }

  global.Web3HouseNewToWeb3 = {
    TOPICS: NEW_TO_WEB3_TOPICS,
    renderAccordionHtml: renderAccordionHtml,
    mountHubAccordion: mountHubAccordion,
    bindExclusiveAccordion: bindExclusiveAccordion,
  };
})(window);
