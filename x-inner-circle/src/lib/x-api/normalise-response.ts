import type { XApiResponse, XPost, XUser } from "@/lib/x-api/types";

export function usersFromIncludes(includes?: XApiResponse<unknown>["includes"]): XUser[] {
  return includes?.users ?? [];
}

export function mergeUsers(existing: Map<string, XUser>, users: XUser[]): Map<string, XUser> {
  const map = new Map(existing);
  for (const u of users) map.set(u.id, u);
  return map;
}

export function mergePosts(a: XPost[], b: XPost[]): XPost[] {
  const seen = new Set<string>();
  const out: XPost[] = [];
  for (const p of [...a, ...b]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

export function normalisePostsResponse(res: XApiResponse<XPost[]>): { posts: XPost[]; users: XUser[] } {
  return {
    posts: res.data ?? [],
    users: usersFromIncludes(res.includes),
  };
}

export function normaliseUserResponse(res: XApiResponse<XUser>): XUser | null {
  return res.data ?? null;
}
