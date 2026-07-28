import { describe, expect, it } from "vitest";
import { buildCuratedVisuals } from "@/hooks/useCuratedVisuals";
import { runAnalysisFromData } from "@/lib/wallet-dna/analysis/run-analysis";
import { buildFixtureData } from "@/lib/wallet-dna/providers/fixture-data";
import { collectionKey } from "@/lib/wallet-dna/utils/collection-key";

const WALLET = "0x1111111111111111111111111111111111111111";

describe("buildCuratedVisuals", () => {
  it("removes hidden collections from gallery without changing underlying result", () => {
    const { nfts, transfers, coverage } = buildFixtureData("diamond", WALLET);
    const { result } = runAnalysisFromData(WALLET, null, nfts, transfers, coverage);
    const scoresBefore = result.scores.collector.value;

    const top = result.visuals.collectionShowcase[0];
    expect(top).toBeTruthy();
    const hiddenKey = collectionKey(top!.chain, top!.contractAddress);

    const curated = buildCuratedVisuals(result, [hiddenKey]);
    expect(
      curated.collectionShowcase.every(
        (c) => collectionKey(c.chain, c.contractAddress) !== hiddenKey,
      ),
    ).toBe(true);
    expect(result.scores.collector.value).toBe(scoresBefore);
  });
});
