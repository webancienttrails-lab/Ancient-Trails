import type { Metadata } from "next";
import { Montserrat, Playfair_Display } from "next/font/google";
import { SiteFooter } from "@/components/layout/footer";
import { ToastProvider } from "@/components/ui/toast";
import { SiteLoader } from "@/components/layout/site-loader";
import { BackToTopButton } from "@/components/layout/back-to-top-button";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: {
    default: "Ancient Trails",
    template: "%s | Ancient Trails",
  },
  description:
    "Discover India's heritage, history and culture through curated tours.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${playfairDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <SiteLoader />
          {children}
          <SiteFooter />
          <BackToTopButton />
        </ToastProvider>
      </body>
    </html>
  );
}
