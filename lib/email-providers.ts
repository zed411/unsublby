import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAppUrl } from "./security";
import type { Subscription } from "./subscriptions";

const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GOOGLE_OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_PROFILE_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GMAIL_API_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type GmailMessageList = {
  messages?: Array<{ id: string }>;
};

type GmailMessage = {
  id: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
  snippet?: string;
};

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return { clientId, clientSecret, redirectUri: `${getAppUrl()}/api/email/google/callback` };
}

function getStateSecret() {
  return process.env.EMAIL_OAUTH_STATE_SECRET || process.env.CLERK_SECRET_KEY || process.env.STRIPE_SECRET_KEY || "local-dev-state";
}

function base64Url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function signState(payload: string) {
  return createHmac("sha256", getStateSecret()).update(payload).digest("base64url");
}

export function isGoogleEmailConfigured() {
  const { clientId, clientSecret } = getGoogleConfig();
  return Boolean(clientId && clientSecret);
}

export function createGoogleAuthUrl(userId: string) {
  const { clientId, redirectUri } = getGoogleConfig();
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is missing.");

  const payload = base64Url(JSON.stringify({ userId, nonce: randomBytes(16).toString("hex"), createdAt: Date.now() }));
  const state = `${payload}.${signState(payload)}`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: `openid email profile ${GMAIL_READONLY_SCOPE}`,
    access_type: "offline",
    prompt: "consent",
    state
  });

  return `${GOOGLE_OAUTH_URL}?${params.toString()}`;
}

export function verifyGoogleState(state: string, expectedUserId: string) {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return false;

  const expectedSignature = signState(payload);
  const expected = Buffer.from(expectedSignature);
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId?: string; createdAt?: number };
  const isFresh = typeof parsed.createdAt === "number" && Date.now() - parsed.createdAt < 10 * 60 * 1000;
  return parsed.userId === expectedUserId && isFresh;
}

export async function exchangeGoogleCode(code: string) {
  const { clientId, clientSecret, redirectUri } = getGoogleConfig();
  if (!clientId || !clientSecret) throw new Error("Google email connection is not configured.");

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });
  const token = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !token.access_token) {
    throw new Error(token.error_description || token.error || "Google did not return an access token.");
  }

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || null,
    expiresAt: Date.now() + (token.expires_in || 3600) * 1000
  };
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getGoogleConfig();
  if (!clientId || !clientSecret) throw new Error("Google email connection is not configured.");

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  const token = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !token.access_token) {
    throw new Error(token.error_description || token.error || "Google token refresh failed.");
  }

  return {
    accessToken: token.access_token,
    expiresAt: Date.now() + (token.expires_in || 3600) * 1000
  };
}

export async function getGoogleProfile(accessToken: string) {
  const response = await fetch(GOOGLE_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const profile = (await response.json()) as { email?: string };
  if (!response.ok || !profile.email) throw new Error("Could not read Google profile email.");
  return profile.email;
}

function headerValue(message: GmailMessage, name: string) {
  return message.payload?.headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function hostName(value: string) {
  const match = value.match(/@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
  return match?.[1]?.replace(/^mail\./, "") || "unknown sender";
}

function displayName(value: string) {
  const clean = value.replace(/<.*?>/g, "").replace(/["']/g, "").trim();
  if (clean) return clean.slice(0, 42);
  return hostName(value).split(".")[0] || "Subscription";
}

function subscriptionFromMessage(message: GmailMessage, index: number): Subscription | null {
  const subject = headerValue(message, "Subject");
  const from = headerValue(message, "From");
  const listUnsubscribe = headerValue(message, "List-Unsubscribe");
  const lowerText = `${subject} ${from} ${message.snippet || ""} ${listUnsubscribe}`.toLowerCase();
  const looksRelevant =
    Boolean(listUnsubscribe) ||
    lowerText.includes("unsubscribe") ||
    lowerText.includes("subscription") ||
    lowerText.includes("receipt") ||
    lowerText.includes("renewal") ||
    lowerText.includes("newsletter") ||
    lowerText.includes("notification");

  if (!looksRelevant) return null;

  const fromHost = hostName(from);
  const linkMatch = listUnsubscribe.match(/https?:\/\/[^>,\s]+/);
  return {
    id: `gmail-${message.id || index}`,
    name: displayName(from),
    category: lowerText.includes("receipt") || lowerText.includes("renewal") ? "Paid" : listUnsubscribe ? "Newsletter" : "Notifications",
    source: listUnsubscribe ? "Unsubscribe header found" : "Subscription signal found",
    lastSeen: "Recently",
    confidence: listUnsubscribe ? 94 : 74,
    status: linkMatch ? "ready" : "needs-login",
    action: linkMatch ? "Unsubscribe link found" : "Review this account before removing",
    link: linkMatch?.[0] || `https://${fromHost}`,
    plan: subject || "Email subscription or notification",
    foundBy: "Connected Gmail scan"
  };
}

export async function scanGmail(accessToken: string, limit = 12) {
  const query = "unsubscribe OR subscription OR receipt OR renewal OR newsletter OR notification";
  const listResponse = await fetch(`${GMAIL_API_URL}?${new URLSearchParams({ maxResults: String(limit), q: query })}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const list = (await listResponse.json()) as GmailMessageList;
  if (!listResponse.ok) throw new Error("Gmail scan failed. Reconnect Gmail and try again.");

  const messages = await Promise.all(
    (list.messages || []).map(async (message) => {
      const response = await fetch(`${GMAIL_API_URL}/${message.id}?format=metadata`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!response.ok) return null;
      return (await response.json()) as GmailMessage;
    })
  );

  const subscriptions = messages
    .filter((message): message is GmailMessage => Boolean(message))
    .map(subscriptionFromMessage)
    .filter((subscription): subscription is Subscription => Boolean(subscription));

  return subscriptions;
}
