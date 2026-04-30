export type SessionReader = () => Promise<string | null>;

export async function buildAuthenticatedHeaders(
  sessionReader: SessionReader,
  headers?: HeadersInit
) {
  const nextHeaders = new Headers(headers);
  const accessToken = await sessionReader();

  if (accessToken && !nextHeaders.has("authorization")) {
    nextHeaders.set("authorization", `Bearer ${accessToken}`);
  }

  return nextHeaders;
}
