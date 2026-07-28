import type {
  AnalysisCoverage,
  NormalizedNFT,
  NormalizedNFTTransfer,
  SupportedChain,
} from "@/lib/wallet-dna/types";

function nft(
  chain: SupportedChain,
  contract: string,
  tokenId: string,
  name: string,
  acquiredDaysAgo: number,
): NormalizedNFT {
  const d = new Date();
  d.setDate(d.getDate() - acquiredDaysAgo);
  const idx = parseInt(tokenId, 10) % 5;
  const imageUrl = `https://example.com/wallet-dna-fixtures/nft-${idx}.png`;
  return {
    chain,
    contractAddress: contract,
    tokenId,
    tokenType: "ERC721",
    balance: 1,
    title: name,
    collectionName: name.split(" #")[0] ?? name,
    imageUrl,
    thumbnailUrl: imageUrl,
    acquiredAt: d.toISOString(),
    isSpam: false,
  };
}

function mintTransfer(
  chain: SupportedChain,
  contract: string,
  tokenId: string,
  to: string,
  daysAgo: number,
): NormalizedNFTTransfer {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    chain,
    blockNumber: "1",
    transactionHash: `0xmint${tokenId}`,
    contractAddress: contract,
    tokenId,
    tokenType: "ERC721",
    from: "0x0000000000000000000000000000000000000000",
    to: to.toLowerCase(),
    timestamp: d.toISOString(),
    direction: "inbound",
    isMint: true,
    quantity: 1,
    dedupeKey: `${chain}:mint:${contract}:${tokenId}`,
  };
}

export function buildFixtureData(
  kind: string,
  wallet: string,
): { nfts: NormalizedNFT[]; transfers: NormalizedNFTTransfer[]; coverage: AnalysisCoverage } {
  const w = wallet.toLowerCase();
  const fullCoverage = (): AnalysisCoverage => ({
    ethereum: {
      ownershipComplete: true,
      inboundTransfersComplete: true,
      outboundTransfersComplete: true,
      transferCountAnalysed: 100,
      capped: false,
    },
    base: {
      ownershipComplete: true,
      inboundTransfersComplete: true,
      outboundTransfersComplete: true,
      transferCountAnalysed: 80,
      capped: false,
    },
  });

  if (kind === "diamond") {
    const nfts: NormalizedNFT[] = [];
    const transfers: NormalizedNFTTransfer[] = [];
    for (let i = 0; i < 48; i++) {
      const chain: SupportedChain = i % 3 === 0 ? "base" : "ethereum";
      const c = `0x${chain === "base" ? "ba" : "et"}${String(i % 12).padStart(2, "0")}${"a".repeat(36)}`;
      nfts.push(nft(chain, c, String(i), `Legit Collection #${i}`, 400 + (i % 200)));
      transfers.push(mintTransfer(chain, c, String(i), w, 450 + i));
    }
    return { nfts, transfers, coverage: fullCoverage() };
  }

  if (kind === "base") {
    const nfts: NormalizedNFT[] = [];
    const transfers: NormalizedNFTTransfer[] = [];
    for (let i = 0; i < 32; i++) {
      const c = `0xba${String(i % 11).padStart(2, "0")}${"b".repeat(36)}`;
      nfts.push(nft("base", c, String(i), `Base Set #${i}`, 60 + i));
      transfers.push(mintTransfer("base", c, String(i), w, 70 + i));
    }
    for (let i = 0; i < 8; i++) {
      nfts.push(nft("ethereum", `0xet${String(i).padStart(2, "0")}${"c".repeat(36)}`, String(i), `Eth Extra #${i}`, 30));
    }
    return { nfts, transfers, coverage: fullCoverage() };
  }

  if (kind === "mint") {
    const nfts: NormalizedNFT[] = [];
    const transfers: NormalizedNFTTransfer[] = [];
    for (let i = 0; i < 40; i++) {
      const chain: SupportedChain = i % 2 === 0 ? "ethereum" : "base";
      const c = `0x${chain === "base" ? "ba" : "et"}${String(i % 20).padStart(2, "0")}${"d".repeat(36)}`;
      nfts.push(nft(chain, c, String(i), `Mint Proj #${i}`, 20 + (i % 10)));
      transfers.push(mintTransfer(chain, c, String(i), w, 25 + i));
    }
    for (let i = 0; i < 30; i++) {
      transfers.push(mintTransfer("ethereum", `0xmint${String(i % 15).padStart(2, "0")}${"e".repeat(36)}`, String(100 + i), w, 5 + i));
    }
    return { nfts, transfers, coverage: fullCoverage() };
  }

  if (kind === "loyal") {
    const c = `0xloyal${"f".repeat(34)}`;
    const nfts: NormalizedNFT[] = [];
    const transfers: NormalizedNFTTransfer[] = [];
    for (let i = 0; i < 25; i++) {
      nfts.push(nft("ethereum", c, String(i), `Core Crew #${i}`, 600 + i));
      transfers.push(mintTransfer("ethereum", c, String(i), w, 700 + i));
    }
    return { nfts, transfers, coverage: fullCoverage() };
  }

  return { nfts: [], transfers: [], coverage: fullCoverage() };
}
