'use client'

import { Navbar } from '@/components/site/navbar'
import { Hero } from '@/components/site/hero'
import { Stats } from '@/components/site/stats'
import { About } from '@/components/site/about'
import { Services } from '@/components/site/services'
import { PhotoCarousel } from '@/components/site/photo-carousel'
import { VideoShowcase } from '@/components/site/video-showcase'
import { Projects } from '@/components/site/projects'
import { Contact } from '@/components/site/contact'
import { Footer } from '@/components/site/footer'
import { EditPanel } from '@/components/site/edit-panel'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Stats />
        <About />
        <Services />
        <PhotoCarousel />
        <VideoShowcase />
        <Projects />
        <Contact />
      </main>
      <Footer />
      <EditPanel />
    </div>
  )
}
