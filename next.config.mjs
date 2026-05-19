const isDev = process.env.NODE_ENV !== "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com https://hcaptcha.com https://*.hcaptcha.com`,
              "connect-src 'self' https://api.stripe.com https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com https://hcaptcha.com https://*.hcaptcha.com",
              "frame-src https://checkout.stripe.com https://js.stripe.com https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com https://hcaptcha.com https://*.hcaptcha.com",
              "img-src 'self' data: https://img.clerk.com https://*.clerk.com https://hcaptcha.com https://*.hcaptcha.com",
              "style-src 'self' 'unsafe-inline'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'"
            ].join("; ")
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" }
        ]
      }
    ];
  }
};

export default nextConfig;
