// No token template, manual Origin header, cookies, retries, or logging.
export async function requestProtected(
  getToken: () => Promise<string | null>,
  domain: string,
  send: typeof fetch = fetch,
) {
  const token = await getToken();
  if (!token) return "No session token";
  try {
    const response = await send(`https://${domain}/api/protected`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    // Do not render arbitrary response bodies or errors.
    return `HTTP ${response.status}`;
  } catch {
    return "Network error";
  }
}
