import { SCHEMA_VERSION, SCORING_VERSION } from "@/lib/wallet-dna/constants";
import { getWalletDNAEnv } from "@/lib/wallet-dna/env";
import { getRequestId } from "@/lib/wallet-dna/api/request-id";

export function handleHealthRequest(
  req: Request,
  rawEnv: Record<string, string | undefined>,
): Response {
  const requestId = getRequestId(req);
  const env = getWalletDNAEnv({ ...rawEnv, NODE_ENV: rawEnv.NODE_ENV ?? "production" });
  const alchemyConfigured = Boolean(env.alchemyApiKey);

  const body = {
    success: alchemyConfigured,
    service: "wallet-dna-api",
    status: alchemyConfigured ? ("ok" as const) : ("misconfigured" as const),
    scoringVersion: SCORING_VERSION,
    schemaVersion: SCHEMA_VERSION,
    alchemyConfigured,
    deploymentVersion: rawEnv.DEPLOYMENT_VERSION ?? null,
    requestId,
  };

  return Response.json(body, { status: alchemyConfigured ? 200 : 503 });
}
