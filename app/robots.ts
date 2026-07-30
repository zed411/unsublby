import type { MetadataRoute } from "next";
import { getAppUrl } from "../lib/security";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/sign-in", "/sign-up"]
    },
    sitemap: `${getAppUrl()}/sitemap.xml`
  };
}
