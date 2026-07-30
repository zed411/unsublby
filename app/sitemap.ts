import type { MetadataRoute } from "next";
import { getAppUrl } from "../lib/security";

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = getAppUrl();
  return [
    { url: `${appUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${appUrl}/privacy`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${appUrl}/terms`, changeFrequency: "monthly", priority: 0.4 }
  ];
}
