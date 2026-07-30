import { getEmailConnection, saveEmailConnection } from "./db";
import { refreshGoogleAccessToken } from "./email-providers";

export async function getFreshAccessToken(userId: string) {
  const connection = await getEmailConnection(userId, "google");
  if (!connection) return null;

  let accessToken = connection.access_token;
  if (connection.expires_at < Date.now() + 60_000 && connection.refresh_token) {
    const refreshed = await refreshGoogleAccessToken(connection.refresh_token);
    accessToken = refreshed.accessToken;
    await saveEmailConnection({
      userId,
      provider: "google",
      email: connection.email,
      accessToken,
      refreshToken: connection.refresh_token,
      expiresAt: refreshed.expiresAt
    });
  }

  return accessToken;
}
