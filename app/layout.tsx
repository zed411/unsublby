import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { getAppUrl } from "../lib/security";
import "./globals.css";

const description =
  "Unsubly scans your inbox with read-only permission, finds subscriptions, newsletters, and notification lists, and helps you unsubscribe in one click.";

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: {
    default: "Unsubly — Clean up your inbox subscriptions",
    template: "%s · Unsubly"
  },
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Unsubly",
    title: "Unsubly — Clean up your inbox subscriptions",
    description,
    url: "/"
  },
  twitter: {
    card: "summary",
    title: "Unsubly — Clean up your inbox subscriptions",
    description
  },
  robots: { index: true, follow: true }
};

export const viewport: Viewport = {
  themeColor: "#0c6b78"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  const clerkEnabled = clerkKey.startsWith("pk_") && !clerkKey.includes("replace_me");

  if (!clerkEnabled) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
