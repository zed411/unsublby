import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const rateLimitWindowMs = 60_000;
const maxRequestsPerWindow = 30;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

export function getAppUrl() {
  return process.env.APP_URL || "http://127.0.0.1:4174";
}

export function getAllowedOrigins() {
  return new Set((process.env.ALLOWED_ORIGINS || getAppUrl()).split(",").map((origin) => origin.trim()));
}

export function isAllowedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || getAllowedOrigins().has(origin);
}

export function isRateLimited(request: NextRequest) {
  const now = Date.now();
  const ip = request.headers.get("x-forwarded-for") || "local";
  const key = `${ip}:${request.nextUrl.pathname}`;
  const current = rateLimits.get(key);

  if (!current || now > current.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
    return false;
  }

  current.count += 1;
  return current.count > maxRequestsPerWindow;
}

export function sanitizeReferenceId(value: unknown) {
  return String(value || "anonymous")
    .trim()
    .slice(0, 120)
    .replace(/[^a-zA-Z0-9@._:-]/g, "_");
}

export function hashIdentity(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function parseStripeSignature(signatureHeader: string | null) {
  return Object.fromEntries(
    String(signatureHeader || "")
      .split(",")
      .map((part) => part.split("="))
      .filter(([key, value]) => key && value)
  );
}

export function verifyStripeSignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return false;

  const parts = parseStripeSignature(signatureHeader);
  if (!parts.t || !parts.v1) return false;

  const expected = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(parts.v1, "hex");

  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}
