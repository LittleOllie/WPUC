"use client";

import { useEffect, useRef, useState } from "react";
import type {
  NormalizedNFT,
  WalletBadge,
  WalletCollectionVisualSummary,
  WalletDNAResult,
  WalletDNAScores,
  WalletNFTHighlight,
} from "@/lib/wallet-dna/types";
import { SCORE_DESCRIPTIONS, SCORE_LABELS } from "@/lib/wallet-dna/constants";
import { accentForPersonality, EXPLORER_URLS } from "@/lib/wallet-dna/theme";
import { collectionKey } from "@/lib/wallet-dna/utils/collection-key";
import { shortenAddress, formatStatDate } from "@/lib/wallet-dna/utils/helpers";
import { getOllieHeroClassName, getOllieImageExportSrc, getOllieImageSrc } from "@/lib/wallet-dna/ollie-images";
import {
  createWalletPassportNumber,
  createWalletPassportSeed,
} from "@/lib/wallet-dna/passport/passport-number";
import { useVisualPreferences } from "@/hooks/useVisualPreferences";
import { useCuratedVisuals } from "@/hooks/useCuratedVisuals";
import { NFTImage } from "@/components/wallet-dna/NFTImage";
import { WalletShareStudio } from "@/components/wallet-dna/WalletShareStudio";
import { WalletCollapsibleSection } from "@/components/wallet-dna/WalletCollapsibleSection";
import { AchievementBadge } from "@/components/wallet-dna/AchievementBadge";
import { ScoreInfoGuide } from "@/components/wallet-dna/ScoreInfoGuide";

type Props = {
  result: WalletDNAResult;
  onRerun: () => void;
  onAnalyseNew: () => void;
};

function chainLeanLabel(ethCount: number, baseCount: number): string | null {
  const total = ethCount + baseCount;
  if (total === 0 || ethCount === 0 || baseCount === 0) return null;
  const ethShare = ethCount / total;
  if (ethShare >= 0.7) return "Ethereum-leaning · also active on Base";
  if (ethShare <= 0.3) return "Base-leaning · also active on Ethereum";
  return "Collects across Ethereum & Base";
}

function strongestTrait(scores: WalletDNAScores): { label: string; value: number } {
  const keys = Object.keys(SCORE_LABELS) as Array<keyof typeof SCORE_LABELS>;
  let bestKey: keyof typeof SCORE_LABELS = "collector";
  let bestValue = scores.collector.value;
  for (const k of keys) {
    if (scores[k].value > bestValue) {
      bestKey = k;
      bestValue = scores[k].value;
    }
  }
  return { label: SCORE_LABELS[bestKey], value: bestValue };
}

export function WalletDNAResultView({ result, onRerun, onAnalyseNew }: Props) {
  const prefs = useVisualPreferences(result.walletAddress);
  const curated = useCuratedVisuals(result, prefs.hiddenCollections);
  const accent = accentForPersonality(result.personality.id);
  const trait = strongestTrait(result.scores);
  const [galleryLimit, setGalleryLimit] = useState(12);
  const [selectedNft, setSelectedNft] = useState<NormalizedNFT | null>(null);
  const [showCollLimit, setShowCollLimit] = useState(6);
  const [profileCardOpen, setProfileCardOpen] = useState(false);
  const [passportNumber, setPassportNumber] = useState(() => createWalletPassportNumber());
  const [dnaIdSeed, setDnaIdSeed] = useState(() => createWalletPassportSeed());
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPassportNumber(createWalletPassportNumber());
    setDnaIdSeed(createWalletPassportSeed());
  }, [result]);

  const refreshPassportIdentity = () => {
    setPassportNumber(createWalletPassportNumber());
    setDnaIdSeed(createWalletPassportSeed());
  };

  const scrollToShare = () => {
    setProfileCardOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        shareRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  };

  const dominantChain =
    result.stats.ethereumNftCount >= result.stats.baseNftCount ? "Ethereum" : "Base";
  const chainLean = chainLeanLabel(result.stats.ethereumNftCount, result.stats.baseNftCount);

  return (
    <div className="wdna-result">
      {/* Identity header — compact */}
      <header className="wdna-identity">
        <div className="wdna-identity__row">
          <div className="wdna-identity__primary">
            <div className="wdna-identity__facts">
              <div className="wdna-identity__fact">
                <p className="wdna-identity__label">Wallet address</p>
                <p className="wdna-identity__address">{result.walletAddress}</p>
                {result.ensName ? (
                  <p className="wdna-identity__ens">{result.ensName}</p>
                ) : null}
              </div>
              <div className="wdna-identity__fact">
                <p className="wdna-identity__label">Card ID</p>
                <p className="wdna-identity__card-id">{passportNumber}</p>
              </div>
            </div>
            <p className="wdna-identity__meta">
              {result.chainsAnalysed.join(" · ")}{" "}
              · {new Date(result.generatedAt).toLocaleDateString()}
            </p>
          </div>
          <div className="wdna-identity__actions">
            <button type="button" className="wdna-btn" onClick={onAnalyseNew}>
              Analyse new wallet
            </button>
            <button
              type="button"
              className="wdna-btn wdna-btn--ghost"
              onClick={() => navigator.clipboard?.writeText(result.walletAddress)}
            >
              Copy address
            </button>
            <button type="button" className="wdna-btn wdna-btn--ghost" onClick={onRerun}>
              Re-analyse
            </button>
          </div>
        </div>
        <details className="wdna-identity__privacy">
          <summary>Privacy &amp; ownership</summary>
          <p>
            Wallet DNA reads public blockchain records only. Anyone can analyse a public address.
            A result does not prove you own this wallet.
          </p>
        </details>
      </header>

      {result.warnings.length > 0 ? (
        <aside className="wdna-warnings" role="status">
          {result.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </aside>
      ) : null}

      {/* Personality hero */}
      <section
        className="wdna-hero"
        style={{ "--wdna-accent": accent.accent, "--wdna-glow": accent.glow } as React.CSSProperties}
      >
        <div className="wdna-hero__grid">
          <div className={`wdna-hero__ollie${getOllieHeroClassName(result.personality.id)}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getOllieImageSrc(result.personality.id)}
              data-export-src={getOllieImageExportSrc(result.personality.id)}
              alt="Little Ollie"
              width={220}
              height={280}
            />
          </div>
          <div className="wdna-hero__copy">
            <p className="wdna-hero__eyebrow">You&apos;re a</p>
            <h2 className="wdna-hero__title">{result.personality.name}</h2>
            <p className="wdna-hero__desc">{result.personality.shortDescription}</p>
            <p className="wdna-hero__narrative">{result.narrative}</p>
            <p className="wdna-hero__trait">
              Strongest trait: <strong>{trait.label}</strong> · {trait.value}
            </p>
            {chainLean && <p className="wdna-hero__chain-lean">{chainLean}</p>}
            <div className="wdna-hero__badges">
              {result.badges
                .filter((b) => b.unlocked)
                .slice(0, 3)
                .map((b) => (
                  <span key={b.id} className="wdna-hero__badge">
                    {b.name}
                  </span>
                ))}
            </div>
            <button type="button" className="wdna-btn wdna-hero__share" onClick={scrollToShare}>
              Share Result
            </button>
          </div>
        </div>
      </section>

      <div ref={shareRef}>
        <WalletCollapsibleSection
          title="Wallet DNA Profile Card"
          titleAccent="DNA"
          lead="Your shareable collector identity — one recognisable card, every time. Not proof of ownership."
          open={profileCardOpen}
          onOpenChange={setProfileCardOpen}
          className="wdna-collapse--profile-card"
        >
          <WalletShareStudio
            result={result}
            hideHeader
            passportNumber={passportNumber}
            dnaIdSeed={dnaIdSeed}
            onPassportRefresh={refreshPassportIdentity}
          />
          <ScoreInfoGuide />
        </WalletCollapsibleSection>
      </div>

      {/* Highlights */}
      <WalletCollapsibleSection
        title="Your Wallet Highlights"
        titleAccent="Highlights"
        lead="A few standout moments from the NFTs currently held in this wallet."
        defaultOpen={false}
      >
        <div className="wdna-highlights">
          {curated.highlights.map((h) => (
            <HighlightCard
              key={h.id}
              highlight={h}
              ethCount={result.stats.ethereumNftCount}
              baseCount={result.stats.baseNftCount}
              showcase={curated.collectionShowcase}
            />
          ))}
        </div>
      </WalletCollapsibleSection>

      {/* Gallery */}
      <WalletCollapsibleSection
        title="Inside This Wallet"
        titleAccent="Wallet"
        lead="A visual sample of the NFTs currently held across Ethereum and Base."
        defaultOpen={false}
      >
        {curated.galleryNFTs.length === 0 ? (
          <p className="wdna-empty">
            {prefs.hiddenCollections.length
              ? "Your showcase is currently empty. Restore hidden collections below."
              : "We found NFT activity, but no supported artwork was available to build the gallery."}
          </p>
        ) : (
          <>
            <div className="wdna-gallery">
              {curated.galleryNFTs.slice(0, galleryLimit).map((nft) => (
                <button
                  key={`${nft.chain}:${nft.contractAddress}:${nft.tokenId}`}
                  type="button"
                  className="wdna-gallery__item"
                  onClick={() => setSelectedNft(nft)}
                >
                  <NFTImage nft={nft} className="wdna-gallery__img" />
                  <span className="wdna-gallery__label">{nft.title ?? `#${nft.tokenId}`}</span>
                  <span className="wdna-gallery__chain">{nft.chain}</span>
                </button>
              ))}
            </div>
            {galleryLimit < curated.galleryNFTs.length && (
              <button
                type="button"
                className="wdna-btn wdna-btn--ghost wdna-show-more"
                onClick={() => setGalleryLimit(24)}
              >
                Show more
              </button>
            )}
          </>
        )}
      </WalletCollapsibleSection>

      {/* Scores */}
      <WalletCollapsibleSection
        title="Wallet DNA Scores"
        titleAccent="DNA"
        lead="Five traits scored 0–100 from your public NFT activity. Expand the guide for what each number means."
        defaultOpen={false}
      >
        <ScoreInfoGuide defaultOpen />
        <ScoreSection scores={result.scores} />
      </WalletCollapsibleSection>

      <WalletCollapsibleSection title="Snapshot" titleAccent="Snapshot" defaultOpen={false}>
        <div className="wdna-metrics">
          <Metric label="NFTs held" value={String(result.stats.nftsCurrentlyHeld)} />
          <Metric label="Collections" value={String(result.stats.uniqueCurrentCollections)} />
          <Metric label="Identified mints" value={String(result.stats.identifiedMints)} />
          <Metric label="Inbound transfers" value={String(result.stats.inboundTransfers)} />
          <Metric
            label="NFTs transferred out"
            value={String(result.stats.outboundTransfers)}
          />
          <Metric label="Spam excluded" value={String(result.stats.spamExcluded)} />
          <Metric
            label="Longest hold"
            value={
              result.stats.longestCurrentHoldDays != null
                ? `${result.stats.longestCurrentHoldDays}d`
                : "Not enough history"
            }
          />
          <Metric label="Dominant chain" value={dominantChain} />
        </div>
      </WalletCollapsibleSection>

      <WalletCollapsibleSection title="Achievements" titleAccent="Achievements" defaultOpen={false}>
        <BadgeSection badges={result.badges} />
      </WalletCollapsibleSection>

      <WalletCollapsibleSection
        title="Collection Breakdown"
        titleAccent="Breakdown"
        lead="See which collections make up the largest parts of this wallet."
        defaultOpen={false}
      >
        <div className="wdna-collections">
          {curated.collectionShowcase.slice(0, showCollLimit).map((c) => (
            <CollectionCard
              key={collectionKey(c.chain, c.contractAddress)}
              collection={c}
              onHide={() => prefs.hideCollection(collectionKey(c.chain, c.contractAddress))}
            />
          ))}
        </div>
        {showCollLimit < curated.collectionShowcase.length && (
          <button
            type="button"
            className="wdna-btn wdna-btn--ghost wdna-show-more"
            onClick={() => setShowCollLimit(curated.collectionShowcase.length)}
          >
            Show more collections
          </button>
        )}
      </WalletCollapsibleSection>

      {prefs.hiddenCollections.length > 0 && (
        <WalletCollapsibleSection
          title="Hidden From Showcase"
          titleAccent="Showcase"
          lead="Hiding a collection only changes what appears in your visual showcase and share card. It does not change your Wallet DNA scores."
          defaultOpen={false}
        >
          <ul className="wdna-hidden-list">
            {prefs.hiddenCollections.map((key) => {
              const c = (result.visuals?.collectionShowcase ?? []).find(
                (col) => collectionKey(col.chain, col.contractAddress) === key,
              );
              return (
                <li key={key}>
                  <span>{c?.collectionName ?? key}</span>
                  <button type="button" onClick={() => prefs.restoreCollection(key)}>
                    Restore
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" className="wdna-btn wdna-btn--ghost" onClick={prefs.restoreAll}>
            Restore all
          </button>
        </WalletCollapsibleSection>
      )}

      {selectedNft && (
        <NftDetailModal nft={selectedNft} onClose={() => setSelectedNft(null)} />
      )}

      <div className="wdna-sticky-share">
        <button type="button" className="wdna-btn" onClick={scrollToShare}>
          Share Result
        </button>
      </div>
    </div>
  );
}

function HighlightCard({
  highlight,
  ethCount,
  baseCount,
  showcase,
}: {
  highlight: WalletNFTHighlight;
  ethCount: number;
  baseCount: number;
  showcase: WalletCollectionVisualSummary[];
}) {
  if (highlight.type === "most-active-chain") {
    const total = ethCount + baseCount;
    const ethPct = total > 0 ? Math.round((ethCount / total) * 100) : 0;
    const basePct = total > 0 ? 100 - ethPct : 0;
    return (
      <article className="wdna-highlight wdna-highlight--chain">
        <p className="wdna-highlight__kicker">{highlight.title}</p>
        <div className="wdna-chain-split">
          <div className="wdna-chain-split__bar">
            <span style={{ width: `${ethPct}%` }} className="wdna-chain-split__eth" />
            <span style={{ width: `${basePct}%` }} className="wdna-chain-split__base" />
          </div>
          <div className="wdna-chain-split__stats">
            <div>
              <strong>Ethereum</strong>
              <span>
                {ethCount} NFTs · {ethPct}%
              </span>
            </div>
            <div>
              <strong>Base</strong>
              <span>
                {baseCount} NFTs · {basePct}%
              </span>
            </div>
          </div>
        </div>
        <p className="wdna-highlight__sub">{highlight.subtitle}</p>
      </article>
    );
  }

  if (highlight.type === "most-held-collection" && highlight.collection) {
    const c = highlight.collection;
    const visual = showcase.find(
      (col) =>
        col.chain === c.chain &&
        col.contractAddress.toLowerCase() === c.contractAddress.toLowerCase(),
    );
    return (
      <article className="wdna-highlight wdna-highlight--collection">
        <p className="wdna-highlight__kicker">{highlight.title}</p>
        <h4 className="wdna-highlight__name">{c.collectionName}</h4>
        <p className="wdna-highlight__main">{highlight.supportingText}</p>
        {visual && visual.representativeNFTs.length > 0 && (
          <div className="wdna-highlight__thumbs">
            {visual.representativeNFTs.slice(0, 4).map((n) => (
              <NFTImage key={n.tokenId} nft={n} className="wdna-highlight__thumb" />
            ))}
          </div>
        )}
        <p className="wdna-highlight__sub">{highlight.subtitle}</p>
      </article>
    );
  }

  if (highlight.nft) {
    const visual = showcase.find(
      (col) =>
        col.chain === highlight.nft!.chain &&
        col.contractAddress.toLowerCase() === highlight.nft!.contractAddress.toLowerCase(),
    );

    return (
      <article className="wdna-highlight wdna-highlight--nft">
        <NFTImage
          nft={highlight.nft}
          fallbackNfts={visual?.representativeNFTs ?? []}
          className="wdna-highlight__img"
          eager
        />
        <div>
          <p className="wdna-highlight__kicker">{highlight.title}</p>
          <h4 className="wdna-highlight__name">{highlight.nft.title ?? `#${highlight.nft.tokenId}`}</h4>
          <p className="wdna-highlight__main">{highlight.supportingText}</p>
          <p className="wdna-highlight__sub">{highlight.subtitle}</p>
        </div>
      </article>
    );
  }

  return null;
}

function CollectionCard({
  collection,
  onHide,
}: {
  collection: WalletCollectionVisualSummary;
  onHide: () => void;
}) {
  return (
    <article className="wdna-collection-card">
      <div className="wdna-collection-card__collage">
        {collection.representativeNFTs.slice(0, 4).map((n) => (
          <NFTImage key={`${n.tokenId}`} nft={n} className="wdna-collection-card__thumb" />
        ))}
      </div>
      <div className="wdna-collection-card__body">
        <h4>{collection.collectionName}</h4>
        <p>
          {collection.currentQuantity} held · {collection.percentageOfCurrentHoldings}% ·{" "}
          {collection.chain}
        </p>
        {collection.currentOldestHoldDays != null && (
          <p className="wdna-collection-card__hold">
            Oldest current hold: {collection.currentOldestHoldDays} days
          </p>
        )}
        <button type="button" className="wdna-link-btn" onClick={onHide}>
          Hide from showcase
        </button>
      </div>
    </article>
  );
}

function ScoreSection({ scores }: { scores: WalletDNAScores }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setVisible(true);
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const keys = Object.keys(SCORE_LABELS) as Array<keyof typeof SCORE_LABELS>;

  return (
    <div ref={ref} className={`wdna-scores ${visible ? "wdna-scores--visible" : ""}`}>
      {keys.map((k) => (
        <article key={k} className="wdna-score-card">
          <div className="wdna-score-card__value">{scores[k].value}</div>
          <h4>
            {SCORE_LABELS[k]}
            <span className="wdna-score-card__range">0–100</span>
          </h4>
          {scores[k].confidence !== "high" ? (
            <p className="wdna-score-card__confidence">{scores[k].confidence} confidence</p>
          ) : null}
          <div className="wdna-score-bar">
            <div
              className="wdna-score-fill"
              style={{ width: visible ? `${scores[k].value}%` : "0%" }}
            />
          </div>
          <p>{SCORE_DESCRIPTIONS[k]}</p>
          <details>
            <summary>How calculated</summary>
            <ul>
              {scores[k].factors.map((f) => (
                <li key={f.label}>
                  {f.label}: {f.value}
                </li>
              ))}
            </ul>
          </details>
        </article>
      ))}
    </div>
  );
}

function BadgeSection({ badges }: { badges: WalletBadge[] }) {
  const unlocked = badges.filter((b) => b.unlocked);
  const locked = badges.filter((b) => !b.unlocked);
  return (
    <>
      <div className="wdna-badges">
        {unlocked.map((b) => (
          <AchievementBadge key={b.id} badge={b} />
        ))}
      </div>
      {locked.length > 0 && (
        <details className="wdna-badges-locked">
          <summary>Badges still to discover</summary>
          <div className="wdna-badges wdna-badges--locked">
            {locked.map((b) => (
              <AchievementBadge key={b.id} badge={b} size="sm" />
            ))}
          </div>
        </details>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="wdna-metric">
      <div className="wdna-metric__value">{value}</div>
      <div className="wdna-metric__label">{label}</div>
    </div>
  );
}

function NftDetailModal({ nft, onClose }: { nft: NormalizedNFT; onClose: () => void }) {
  const explorer =
    nft.chain === "ethereum"
      ? EXPLORER_URLS.ethereum(nft.contractAddress, nft.tokenId)
      : EXPLORER_URLS.base(nft.contractAddress, nft.tokenId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="wdna-modal" role="dialog" aria-modal="true" aria-labelledby="nft-modal-title">
      <button type="button" className="wdna-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="wdna-modal__panel">
        <button type="button" className="wdna-modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <NFTImage nft={nft} className="wdna-modal__img" eager />
        <h3 id="nft-modal-title">{nft.title ?? `Token #${nft.tokenId}`}</h3>
        <p>{nft.collectionName ?? "Unnamed collection"}</p>
        <p>
          #{nft.tokenId} · {nft.chain}
        </p>
        {nft.acquiredAt && <p>Current hold since {formatStatDate(nft.acquiredAt)}</p>}
        <p className="wdna-modal__contract">{shortenAddress(nft.contractAddress)}</p>
        <a
          href={explorer}
          target="_blank"
          rel="noopener noreferrer"
          className="wdna-btn wdna-btn--ghost"
        >
          View on explorer
        </a>
      </div>
    </div>
  );
}
