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
  title: "Basnayaka VermiGrow — Organic Fertilizer & Vegetables, Karandeniya, Sri Lanka",
  description:
    "Basnayaka VermiGrow is a family-run organic farm in Karandeniya, Sri Lanka, producing vermicompost from cow dung, chicken dung and fish waste, and growing organic vegetables for the local community.",
  keywords: [
    "Basnayaka VermiGrow",
    "organic fertilizer",
    "vermicompost",
    "Sri Lanka",
    "Karandeniya",
    "cow dung compost",
    "chicken dung compost",
    "fish nutrient",
    "organic vegetables",
  ],
  authors: [{ name: "Basnayaka VermiGrow" }],
  openGraph: {
    title: "Basnayaka VermiGrow — Organic Fertilizer & Vegetables",
    description:
      "Family-run organic farm in Karandeniya, Sri Lanka. Vermicompost, organic fertilizer, and chemical-free vegetables.",
    siteName: "Basnayaka VermiGrow",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Basnayaka VermiGrow — Organic Fertilizer & Vegetables",
    description:
      "Family-run organic farm in Karandeniya, Sri Lanka. Vermicompost, organic fertilizer, and chemical-free vegetables.",
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
