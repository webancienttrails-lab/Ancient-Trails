import type { NextConfig } from "next";

const apiImageUrl = new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000");
const imageOrigins = (process.env.NEXT_PUBLIC_IMAGE_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean).map(value => new URL(value));
const imagePattern = (url: URL, pathname: string) => ({
  protocol: url.protocol.replace(":", "") as "http" | "https",
  hostname: url.hostname, port: url.port, pathname,
});

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://*.razorpay.com https://www.gstatic.com https://apis.google.com https://www.googleapis.com" +
    (process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' https: data: blob:",
  "font-src 'self' https://fonts.gstatic.com data:",
  // The API and Firebase project hosts vary between deployments.
  "connect-src 'self' https: wss:" + (process.env.NODE_ENV === "production" ? "" : " http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*"),
  "frame-src 'self' https://*.razorpay.com https://*.firebaseapp.com https://*.web.app https://accounts.google.com",
  "media-src 'self' https: blob:",
  "worker-src 'self' blob:",
  "form-action 'self' https://*.razorpay.com",
].join("; ");

const nextConfig: NextConfig = {
  // Resolve record-backed metadata before sending headers, including notFound().
  htmlLimitedBots: /.*/,
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Content-Security-Policy", value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'" },
        // Trial resource restrictions without blocking login, payments or hydration.
        { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
      ],
    }, ...["/booking-confirmed/:path*", "/booking-submitted/:path*", "/bank-transfer/:path*", "/booking/recover/:path*"].map(source => ({
      source,
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Cache-Control", value: "private, no-store" },
      ],
    }))];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75],
    imageSizes: [32, 48, 64, 96, 128, 160, 218, 256, 320, 384, 436],
    remotePatterns: [
      imagePattern(apiImageUrl, `${apiImageUrl.pathname.replace(/\/$/, "")}/uploads/**`),
      ...imageOrigins.map(url => imagePattern(url, `${url.pathname.replace(/\/$/, "")}/**`)),
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/v0/b/**" },
    ],
    // The development API uses localhost; production keeps private IPs blocked.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
  },
};

export default nextConfig;
