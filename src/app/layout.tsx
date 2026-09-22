import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/site/error-boundary";
import { ContentProvider } from "@/store/content-store";
import { readSiteContent } from "@/lib/content-service";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Cache the rendered shell and refresh it at most every 5 minutes.
 *
 * The admin's "Save All" does not wait for this window — `POST /api/content`
 * calls `revalidatePath('/', 'layout')`, so an edit shows on the next page load.
 * This is the backstop for changes made any other way.
 */
export const revalidate = 300;

const SITE_URL = process.env.NEXTAUTH_URL || "https://basnayakavermigrow.lk";

/** Used when the CMS fields are blank, so the site never ships an empty title. */
const FALLBACK_TITLE =
  "Basnayaka VermiGrow — Organic Fertilizer & Vegetables, Karandeniya, Sri Lanka";
const FALLBACK_DESCRIPTION =
  "Basnayaka VermiGrow is a family-run organic farm in Karandeniya, Sri Lanka, producing vermicompost from cow dung, chicken dung and fish waste, and growing organic vegetables for the local community.";

/**
 * Metadata is generated from the CMS rather than hardcoded, so the `seoTitle`,
 * `seoDescription` and `ogImage` fields the content model has always declared
 * actually do something. Each falls back independently — a half-filled SEO
 * section still produces a complete, valid tag set.
 */
export async function generateMetadata(): Promise<Metadata> {
  const content = await readSiteContent();

  const title = content.seoTitle?.trim() || FALLBACK_TITLE;
  const description = content.seoDescription?.trim() || FALLBACK_DESCRIPTION;
  const ogImage = content.ogImage?.trim();

  return {
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: "/" },
    title,
    description,
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
    authors: [{ name: content.brand || "Basnayaka VermiGrow" }],
    openGraph: {
      title,
      description,
      siteName: content.brand || "Basnayaka VermiGrow",
      type: "website",
      // Omitted entirely when unset: an empty `images` array is worse than none,
      // and a `summary_large_image` card with no image renders as a blank box.
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read once here and hand it to the provider so every page — not just `/` —
  // renders the CMS brand and socials in its navbar and footer. `readSiteContent`
  // never throws, so a broken content row cannot take down `/admin/login`.
  const content = await readSiteContent();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="icon" href="/logos/logo-main.png" sizes="any" />
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var a=document.querySelectorAll("[bis_skin_checked]");for(var i=0;i<a.length;i++)a[i].removeAttribute("bis_skin_checked")}catch(e){}})()`
        }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <ContentProvider initialContent={content}>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </ContentProvider>
          <SonnerToaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
