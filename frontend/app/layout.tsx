import type { Metadata } from "next";
import { getSiteOrigin } from "@/lib/site-origin";
import { JsonLd } from "@/components/seo/json-ld";
import { websiteStructuredData } from "@/lib/structured-data";
import { getRecentPublishedBlogs } from "@/lib/server-blog";
import localFont from "next/font/local";
import { SiteFooter } from "@/components/layout/footer";
import { ToastProvider } from "@/components/ui/toast";
import { SiteLoader } from "@/components/layout/site-loader";
import { BackToTopButton } from "@/components/layout/back-to-top-button";
import { ProfileCompletionPrompt } from "@/components/auth/profile-completion-prompt";
import "./globals.css";

const montserrat = localFont({
  src: "./fonts/Montserrat-Variable.ttf",
  variable: "--font-montserrat",
  weight: "100 900",
  style: "normal",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});

const playfairDisplay = localFont({
  src: "./fonts/PlayfairDisplay-Variable.ttf",
  variable: "--font-playfair-display",
  weight: "400 900",
  style: "normal",
  display: "swap",
  fallback: ["Georgia", "serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteOrigin()),
  title: {
    default: "Ancient Trails",
    template: "%s | Ancient Trails",
  },
  description:
    "Discover India's heritage, history and culture through curated tours.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const recentPosts = await getRecentPublishedBlogs();
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${playfairDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <div id="site-header-slot" />
        <JsonLd id="website-jsonld" data={websiteStructuredData()} />
        <ToastProvider>
          <SiteLoader />
          {children}
          <ProfileCompletionPrompt />
          <SiteFooter recentPosts={recentPosts} />
          <BackToTopButton />
        </ToastProvider>
      </body>
    </html>
  );
}
