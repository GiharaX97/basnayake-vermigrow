import { Navbar } from '@/components/site/navbar'
import { NoticeTicker } from '@/components/site/notice-ticker'
import { NoticeBoard } from '@/components/site/notice-board'
import { Hero } from '@/components/site/hero'
import { Stats } from '@/components/site/stats'
import { About } from '@/components/site/about'
import { Services } from '@/components/site/services'
import { MapSection } from '@/components/site/map-section'
import { PhotoCarousel } from '@/components/site/photo-carousel'
import { EventGallery } from '@/components/site/event-gallery'
import { TrainingGallery } from '@/components/site/training-gallery'
import { VideoShowcase } from '@/components/site/video-showcase'
import { TrainingVideos } from '@/components/site/training-videos'
import { Projects } from '@/components/site/projects'
import { Founder } from '@/components/site/founder'
import { Contact } from '@/components/site/contact'
import { Footer } from '@/components/site/footer'
import { readSiteContent } from '@/lib/content-service'
import { buildSiteJsonLd, serializeJsonLd } from '@/lib/structured-data'

/**
 * A server component on purpose.
 *
 * This page used to be `'use client'` and fetched its content in a `useEffect`,
 * which meant the HTML crawlers received contained the hardcoded `defaultContent`
 * — every edit made in `/admin/content` reached the browser only after hydration.
 * Rendering on the server puts the CMS content in the HTML itself.
 *
 * The sections are all still client components (they use effects, carousels and
 * maps); a server component is free to render them, so no client boundary moved.
 */
export default async function Home() {
  const content = await readSiteContent()
  const origin = process.env.NEXTAUTH_URL || 'https://basnayakavermigrow.lk'

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildSiteJsonLd(content, origin)),
        }}
      />
      <NoticeTicker />
      <Navbar />
      <main className="flex-1">
        <Hero />
        <NoticeBoard />
        <Stats />
        <About />
        <Services />
        <MapSection />
        <PhotoCarousel />
        <EventGallery />
        <TrainingGallery />
        <VideoShowcase />
        <TrainingVideos />
        <Projects />
        <Founder />
        <Contact />
      </main>
      <Footer />
    </div>
  )
}
