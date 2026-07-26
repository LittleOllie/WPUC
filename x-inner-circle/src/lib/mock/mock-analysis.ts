import { ANALYSIS_CONFIG, APP_CONFIG, SCORING_VERSION } from "@/lib/config";
import { assignRings, flattenRingCandidates } from "@/lib/analysis/assign-rings";
import { calculateOverallConfidence } from "@/lib/analysis/confidence";
import { scoreCandidates } from "@/lib/analysis/calculate-score";
import { dedupeEvents, groupEventsByCounterparty } from "@/lib/analysis/extract-interactions";
import type { AnalysisResult, InteractionEvent, TargetAccount } from "@/lib/analysis/types";
import { generateCircleSvg } from "@/lib/image/svg-generator";
import { profileUrlForUsername } from "@/lib/security/sanitise";
import type { XUser } from "@/lib/x-api/types";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function evt(
  source: string,
  target: string,
  type: InteractionEvent["type"],
  daysBack: number,
  postId: string,
): InteractionEvent {
  return {
    sourceUserId: source,
    targetUserId: target,
    postId,
    conversationId: `conv-${postId}`,
    createdAt: daysAgo(daysBack),
    type,
    weightSource: "mock",
    direction: source === "target" ? "outbound" : "inbound",
  };
}

function buildMockEvents(): {
  users: Map<
    string,
    { username: string; displayName: string; profileImageUrl: string | null; followerCount?: number }
  >;
  events: InteractionEvent[];
} {
  const users = new Map<
    string,
    { username: string; displayName: string; profileImageUrl: string | null; followerCount?: number }
  >();

  const add = (
    id: string,
    username: string,
    displayName: string,
    img: string | null,
    followers = 1200,
  ) => {
    users.set(id, { username, displayName, profileImageUrl: img, followerCount: followers });
  };

  add("u1", "alexdev", "Alex Dev", "https://pbs.twimg.com/profile_images/mock/alex.jpg");
  add("u2", "samcodes", "Sam Codes", "https://pbs.twimg.com/profile_images/mock/sam.jpg");
  add("u3", "mayaart", "Maya Art", null);
  add("u4", "jordannft", "Jordan NFT", "https://pbs.twimg.com/profile_images/mock/jordan.jpg");
  add("u5", "taylorweb", "Taylor Web", "https://pbs.twimg.com/profile_images/mock/taylor.jpg");
  add("u6", "rileydao", "Riley DAO", null);
  add("u7", "casey_eth", "Casey", "https://pbs.twimg.com/profile_images/mock/casey.jpg");
  add("u8", "drewlabs", "Drew Labs", "https://pbs.twimg.com/profile_images/mock/drew.jpg");
  add("u9", "celebrity_x", "Big Celebrity", "https://pbs.twimg.com/profile_images/mock/celebrity.jpg", 2_000_000);

  for (let i = 10; i <= 55; i++) {
    add(`u${i}`, `friend${i}`, `Friend ${i}`, i % 5 === 0 ? null : `https://pbs.twimg.com/profile_images/mock/f${i}.jpg`);
  }

  const events: InteractionEvent[] = [];
  let pid = 1;

  for (let i = 0; i < 12; i++) {
    events.push(evt("target", "u1", "reply_sent", i + 1, `p${pid++}`));
    events.push(evt("u1", "target", "reply_received", i + 2, `p${pid++}`));
  }
  for (let i = 0; i < 8; i++) {
    events.push(evt("target", "u2", "mention_sent", i + 3, `p${pid++}`));
    events.push(evt("u2", "target", "mention_received", i + 4, `p${pid++}`));
  }
  for (let i = 0; i < 6; i++) events.push(evt("target", "u3", "reply_sent", i + 5, `p${pid++}`));
  for (let i = 0; i < 10; i++) {
    events.push(evt("target", "u4", "reply_sent", i + 2, `p${pid++}`));
    events.push(evt("u4", "target", "reply_received", i + 3, `p${pid++}`));
  }

  for (let i = 10; i <= 55; i++) {
    const id = `u${i}`;
    const count = i <= 22 ? 5 : i <= 37 ? 3 : 2;
    for (let j = 0; j < count; j++) {
      events.push(evt("target", id, j % 2 === 0 ? "reply_sent" : "mention_sent", (i % 40) + j, `p${pid++}`));
      if (i % 3 === 0) events.push(evt(id, "target", "reply_received", (i % 35) + j, `p${pid++}`));
    }
  }

  for (let i = 0; i < 40; i++) {
    events.push(evt("target", "u9", "reply_sent", i + 1, `p${pid++}`));
  }

  return { users, events: dedupeEvents(events) };
}

export async function getMockAnalysisResult(username: string): Promise<AnalysisResult> {
  await new Promise((r) => setTimeout(r, 900));

  const target: TargetAccount = {
    id: "target",
    username,
    displayName: username.charAt(0).toUpperCase() + username.slice(1),
    profileImageUrl: "https://pbs.twimg.com/profile_images/mock/target.jpg",
    verified: false,
    profileUrl: profileUrlForUsername(username),
  };

  const { users, events } = buildMockEvents();
  const usersById = new Map<string, XUser>([
    [
      target.id,
      {
        id: target.id,
        name: target.displayName,
        username: target.username,
        profile_image_url: target.profileImageUrl ?? undefined,
      },
    ],
    ...[...users.entries()].map(
      ([id, u]): [string, XUser] => [
        id,
        {
          id,
          name: u.displayName,
          username: u.username,
          profile_image_url: u.profileImageUrl ?? undefined,
          public_metrics: { followers_count: u.followerCount },
        },
      ],
    ),
  ]);

  const grouped = groupEventsByCounterparty(target.id, events, usersById);
  const candidates = scoreCandidates(target, grouped);
  const rings = assignRings(candidates);
  const flat = flattenRingCandidates(rings);

  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - ANALYSIS_CONFIG.analysisDays);

  const limitations: string[] = ["Mock mode — sample data only, not live X activity."];

  const result: AnalysisResult = {
    target,
    analysedAt: now.toISOString(),
    analysisWindow: {
      from: from.toISOString(),
      to: now.toISOString(),
      days: ANALYSIS_CONFIG.analysisDays,
    },
    sourceCounts: {
      postsAnalysed: 86,
      mentionsAnalysed: 42,
      accountsDiscovered: flat.length,
      interactionsCounted: events.length,
    },
    candidates: flat,
    rings,
    confidence: calculateOverallConfidence(events, limitations, 1),
    limitations,
    usage: {
      apiRequests: 0,
      postsRetrieved: 86,
      mentionsRetrieved: 42,
      profilesRetrieved: 56,
      paginationCount: 0,
      durationMs: 900,
      endpoints: ["mock"],
      rateLimitRemaining: null,
    },
    generatedDisclaimer: APP_CONFIG.disclaimer,
    scoringVersion: SCORING_VERSION,
  };

  result.svgMarkup = generateCircleSvg(target, rings, { useInitialsOnly: true });
  return result;
}

export async function simulateMockDelay(stageMs = 180): Promise<void> {
  await new Promise((r) => setTimeout(r, stageMs));
}
