export { XApiClient, POST_FIELDS, USER_FIELDS, EXPANSIONS } from "@/lib/x-api/client";

/** Endpoint-specific helpers live here so permission differences can be isolated later. */
export async function lookupTargetUser(client: import("@/lib/x-api/client").XApiClient, username: string) {
  return client.getUserByUsername(username);
}

export async function fetchTargetActivity(
  client: import("@/lib/x-api/client").XApiClient,
  userId: string,
) {
  const [postsPack, mentionsPack] = await Promise.all([
    client.getUserPosts(userId),
    client.getMentions(userId),
  ]);
  return { postsPack, mentionsPack };
}
