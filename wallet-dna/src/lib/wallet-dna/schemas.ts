import { z } from "zod";

export const analyseRequestSchema = z.object({
  wallet: z.string().min(1).max(200).trim(),
  refresh: z.boolean().optional(),
});

export type AnalyseRequest = z.infer<typeof analyseRequestSchema>;

export const walletDNAScoreSchema = z.object({
  value: z.number().min(0).max(100),
  confidence: z.enum(["high", "medium", "limited"]),
  summary: z.string(),
  factors: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      contribution: z.number().optional(),
    }),
  ),
});

export const walletDNAResultSchema = z.object({
  schemaVersion: z.number(),
  scoringVersion: z.string(),
  walletAddress: z.string(),
  ensName: z.string().nullable(),
  generatedAt: z.string(),
  chainsAnalysed: z.array(z.enum(["ethereum", "base"])),
  personality: z.object({
    id: z.string(),
    name: z.string(),
    shortDescription: z.string(),
    shareSummary: z.string(),
    themeKey: z.string(),
    ollieVariant: z.string(),
    shareSubtitle: z.string(),
  }),
  scores: z.object({
    collector: walletDNAScoreSchema,
    diamondHands: walletDNAScoreSchema,
    explorer: walletDNAScoreSchema,
    discovery: walletDNAScoreSchema,
    loyalty: walletDNAScoreSchema,
  }),
  narrative: z.string(),
  warnings: z.array(z.string()),
});
