'use client'

import { useEffect } from 'react'
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
import { LoadingOverlay } from '@/components/site/loading-overlay'
import { useContentStore } from '@/store/content-store'

export default function Home() {
  const loadFromServer = useContentStore((s) => s.loadFromServer)

  useEffect(() => {
    loadFromServer()
  }, [loadFromServer])

  return (
    <div className="min-h-screen flex flex-col bg-background">
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

      {/* Loading overlay (hidden once content loads from server) */}
      <LoadingOverlay />
    </div>
  )
}
