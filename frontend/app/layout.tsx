import type { Metadata } from "next";
import { Playfair_Display, Poppins } from "next/font/google";
import { SiteFooter } from "@/components/layout/footer";
import { ToastProvider } from "@/components/ui/toast";
import { SiteLoader } from "@/components/layout/site-loader";
import "./globals.css";

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
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
      className={`${playfairDisplay.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <SiteLoader />
          {children}
          <SiteFooter />
        </ToastProvider>
      </body>
    </html>
  );
}
