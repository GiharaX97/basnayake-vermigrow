'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ---------- Types ----------
export interface SlideItem {
  id: string
  type: 'video' | 'image'
  src: string
  poster?: string
  title?: string
  subtitle?: string
}

export interface PhotoItem {
  id: string
  src: string
  caption: string
  category: string
}

export interface VideoCard {
  id: string
  src: string
  poster: string
  title: string
  description: string
  duration: string
}

export interface ServiceItem {
  id: string
  icon: string
  title: string
  description: string
}

export interface StatItem {
  id: string
  value: string
  label: string
}

export interface ProjectItem {
  id: string
  image: string
  title: string
  category: string
  year: string
}

export interface SiteContent {
  brand: string
  tagline: string
  heroSlides: SlideItem[]
  aboutTitle: string
  aboutBody: string
  aboutImage: string
  mission: string
  vision: string
  stats: StatItem[]
  services: ServiceItem[]
  photos: PhotoItem[]
  videos: VideoCard[]
  projects: ProjectItem[]
  contactEmail: string
  contactPhone: string
  contactAddress: string
  socials: { id: string; label: string; url: string }[]
}

// ---------- Default content ----------
export const defaultContent: SiteContent = {
  brand: 'MakeFarm',
  tagline: 'Where craft meets cultivation',
  heroSlides: [
    {
      id: 'h1',
      type: 'video',
      src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      poster: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1920&q=80',
      title: 'Crafting stories from the soil up',
      subtitle: 'A creative farm for film, photo & design',
    },
    {
      id: 'h2',
      type: 'image',
      src: 'https://images.unsplash.com/photo-1500076656116-558758c991c1?w=1920&q=80',
      title: 'Grown with intention',
      subtitle: 'Every frame, every pixel, every harvest',
    },
    {
      id: 'h3',
      type: 'image',
      src: 'https://images.unsplash.com/photo-1469224974493-4f068aafee69?w=1920&q=80',
      title: 'From field to frame',
      subtitle: 'Capturing the rhythm of the land',
    },
  ],
  aboutTitle: 'We are MakeFarm',
  aboutBody:
    'MakeFarm is a creative collective rooted in the rhythms of the land. We blend documentary film, photography, and brand design into stories that feel honest, textured, and alive. From sunrise harvests to launch-day screens, we cultivate every project the same way a farmer tends a field — patiently, deliberately, and with deep respect for the craft. Our team of directors, growers, designers, and editors works side-by-side with brands and communities who care about where things come from and how they are made. Over the past decade we have shipped more than 200 films, 40 brand systems, and a dozen long-form documentaries, all driven by the same belief: that good work, like good soil, takes time.',
  aboutImage: 'https://images.unsplash.com/photo-1523741543316-beb7fc7023d8?w=1200&q=80',
  mission:
    'To grow honest stories that connect people to the land, the makers, and the moments that matter.',
  vision:
    'A world where every brand, farm, and maker has the tools to tell its own story with craft and care.',
  stats: [
    { id: 's1', value: '200+', label: 'Films delivered' },
    { id: 's2', value: '40+', label: 'Brand systems' },
    { id: 's3', value: '12', label: 'Documentaries' },
    { id: 's4', value: '10y', label: 'In the field' },
  ],
  services: [
    {
      id: 'sv1',
      icon: 'Film',
      title: 'Film & Documentary',
      description:
        'End-to-end direction, shooting, and editing for short films, brand documentaries, and series. We handle everything from script to color.',
    },
    {
      id: 'sv2',
      icon: 'Camera',
      title: 'Photography',
      description:
        'Editorial, product, and field photography. On-location shoots with natural light and a documentary eye for authentic detail.',
    },
    {
      id: 'sv3',
      icon: 'Palette',
      title: 'Brand & Design',
      description:
        'Identity systems, packaging, and web design for makers, farms, and food brands. Built to grow with you over the long haul.',
    },
    {
      id: 'sv4',
      icon: 'Sprout',
      title: 'Strategy & Story',
      description:
        'Narrative strategy, content planning, and creative direction. We help you find the through-line that holds every channel together.',
    },
  ],
  photos: [
    { id: 'p1', src: 'https://images.unsplash.com/photo-1500076656116-558758c991c1?w=1200&q=80', caption: 'Morning harvest', category: 'Field' },
    { id: 'p2', src: 'https://images.unsplash.com/photo-1469224974493-4f068aafee69?w=1200&q=80', caption: 'Golden hour', category: 'Field' },
    { id: 'p3', src: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&q=80', caption: 'Barn light', category: 'Studio' },
    { id: 'p4', src: 'https://images.unsplash.com/photo-1523741543316-beb7fc7023d8?w=1200&q=80', caption: 'Studio still life', category: 'Studio' },
    { id: 'p5', src: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80', caption: 'Open sky', category: 'Field' },
    { id: 'p6', src: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=1200&q=80', caption: 'Tools of the trade', category: 'Detail' },
  ],
  videos: [
    {
      id: 'v1',
      src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      poster: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80',
      title: 'Joyrides',
      description: 'A short documentary about the small machines that move us.',
      duration: '2:18',
    },
    {
      id: 'v2',
      src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
      poster: 'https://images.unsplash.com/photo-1469224974493-4f068aafee69?w=1200&q=80',
      title: 'Bigger Fun',
      description: 'Brand film exploring play, craft, and the people behind it.',
      duration: '1:12',
    },
    {
      id: 'v3',
      src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      poster: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&q=80',
      title: 'Blazes',
      description: 'A field study of fire, season, and regeneration.',
      duration: '1:05',
    },
  ],
  projects: [
    { id: 'pr1', image: 'https://images.unsplash.com/photo-1500076656116-558758c991c1?w=800&q=80', title: 'Hollowfield Farm', category: 'Brand & Film', year: '2024' },
    { id: 'pr2', image: 'https://images.unsplash.com/photo-1469224974493-4f068aafee69?w=800&q=80', title: 'Sunroot Co-op', category: 'Photography', year: '2024' },
    { id: 'pr3', image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80', title: 'Field Notes', category: 'Documentary', year: '2023' },
    { id: 'pr4', image: 'https://images.unsplash.com/photo-1523741543316-beb7fc7023d8?w=800&q=80', title: 'Barn Raising', category: 'Brand', year: '2023' },
    { id: 'pr5', image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80', title: 'Open Sky Dairy', category: 'Film', year: '2023' },
    { id: 'pr6', image: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800&q=80', title: 'Heirloom Seed Co.', category: 'Packaging', year: '2022' },
  ],
  contactEmail: 'hello@makefarm.studio',
  contactPhone: '+1 (555) 234-9087',
  contactAddress: 'Old Mill Road 14, Greenfield Valley',
  socials: [
    { id: 'so1', label: 'Instagram', url: 'https://instagram.com' },
    { id: 'so2', label: 'Vimeo', url: 'https://vimeo.com' },
    { id: 'so3', label: 'YouTube', url: 'https://youtube.com' },
  ],
}

// ---------- Store ----------
interface ContentState {
  content: SiteContent
  editMode: boolean
  setContent: (c: SiteContent) => void
  updateField: <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => void
  toggleEditMode: () => void
  resetContent: () => void
}

export const useContentStore = create<ContentState>()(
  persist(
    (set) => ({
      content: defaultContent,
      editMode: false,
      setContent: (c) => set({ content: c }),
      updateField: (key, value) =>
        set((state) => ({ content: { ...state.content, [key]: value } })),
      toggleEditMode: () => set((state) => ({ editMode: !state.editMode })),
      resetContent: () => set({ content: defaultContent }),
    }),
    {
      name: 'makefarm-content',
    }
  )
)
