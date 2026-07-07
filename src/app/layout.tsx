import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MakeFarm — Where craft meets cultivation",
  description:
    "MakeFarm is a creative collective rooted in the rhythms of the land. Film, photography, and brand design for makers, farms, and food brands.",
  keywords: [
    "MakeFarm",
    "portfolio",
    "film",
    "photography",
    "brand design",
    "documentary",
    "creative studio",
  ],
  authors: [{ name: "MakeFarm Studio" }],
  openGraph: {
    title: "MakeFarm — Where craft meets cultivation",
    description:
      "A creative farm for film, photo & design. Crafting stories from the soil up.",
    siteName: "MakeFarm",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MakeFarm — Where craft meets cultivation",
    description:
      "A creative farm for film, photo & design. Crafting stories from the soil up.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <SonnerToaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
