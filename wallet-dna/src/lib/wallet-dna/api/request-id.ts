export function getRequestId(req: Request): string {
  return req.headers.get("cf-ray") ?? req.headers.get("x-request-id") ?? crypto.randomUUID();
}
