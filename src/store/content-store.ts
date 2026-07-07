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
  logo?: string
  title: string
  category: string
  year: string
  description?: string
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

// ---------- Default content: Basnayaka VermiGrow ----------
export const defaultContent: SiteContent = {
  brand: 'Basnayaka VermiGrow',
  tagline: 'Organic fertility, from soil to harvest',
  heroSlides: [
    {
      id: 'h1',
      type: 'image',
      src: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1920&q=80',
      title: 'Growing soil, growing life',
      subtitle: 'Organic fertilizer & vegetables from Karandeniya, Sri Lanka',
    },
    {
      id: 'h2',
      type: 'image',
      src: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1920&q=80',
      title: 'Pure inputs, honest harvest',
      subtitle: 'Cow dung, chicken dung & fish-based composting',
    },
    {
      id: 'h3',
      type: 'image',
      src: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=1920&q=80',
      title: 'From vermi-bed to vegetable',
      subtitle: 'Nourishing the land that nourishes you',
    },
  ],
  aboutTitle: 'We are Basnayaka VermiGrow',
  aboutBody:
    'Basnayaka VermiGrow is a family-run organic farm in Karandeniya, in Sri Lanka’s southern lowlands, where traditional farming knowledge meets modern composting science. We produce premium organic fertilizer by carefully composting cow dung, chicken dung and fish waste, then enriching it through vermicomposting with earthworms. The result is a living soil amendment that restores micro-biology, improves water retention, and feeds plants slowly and naturally. Alongside our fertilizer line, we cultivate a rotating selection of organic vegetables using fish-based nutrients and zero synthetic chemicals, supplying our local community and wholesale buyers with produce that tastes the way vegetables used to taste. Every batch is hand-turned, every bed is hand-graded, and every harvest is a small act of stewardship for the land we have farmed for three generations.',
  aboutImage: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1200&q=80',
  mission:
    'To restore soil health across Sri Lanka by making living, chemical-free fertilizer accessible to every farmer, home gardener, and grower.',
  vision:
    'A future where Sri Lankan farms feed the nation with produce grown in soil that gets richer every season — not poorer.',
  stats: [
    { id: 's1', value: '3', label: 'Generations farming' },
    { id: 's2', value: '100%', label: 'Organic inputs' },
    { id: 's3', value: '12+', label: 'Compost batches / yr' },
    { id: 's4', value: '0', label: 'Synthetic chemicals' },
  ],
  services: [
    {
      id: 'sv1',
      icon: 'Sprout',
      title: 'Vermicompost',
      description:
        'Aged cow dung and chicken dung composted with red earthworms into dark, microbe-rich castings. Slow-release nutrition that builds soil structure and water-holding capacity.',
    },
    {
      id: 'sv2',
      icon: 'Recycle',
      title: 'Compost blending',
      description:
        'Custom blends using cow dung, chicken dung, fish waste and green matter, turned and cured for 60–90 days to stabilise nutrients and kill weed seeds.',
    },
    {
      id: 'sv3',
      icon: 'Leaf',
      title: 'Organic vegetables',
      description:
        'Seasonal vegetables grown in our own beds using fish-based nutrients and vermicompost. Available wholesale and direct to local buyers in Karandeniya.',
    },
    {
      id: 'sv4',
      icon: 'Droplets',
      title: 'Fish ATE nutrients',
      description:
        'Fish-based liquid nutrient blends that feed foliar and soil biology, boosting vegetable flavour, shelf life and resistance without any synthetic additives.',
    },
  ],
  photos: [
    { id: 'p1', src: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1200&q=80', caption: 'Compost rows at dawn', category: 'Compost' },
    { id: 'p2', src: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&q=80', caption: 'Vermi-beds in shade', category: 'Vermicompost' },
    { id: 'p3', src: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=1200&q=80', caption: 'Harvest basket', category: 'Vegetables' },
    { id: 'p4', src: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=1200&q=80', caption: 'Hand sorting', category: 'Process' },
    { id: 'p5', src: 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?w=1200&q=80', caption: 'Curing shed', category: 'Compost' },
    { id: 'p6', src: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=1200&q=80', caption: 'Fresh picked', category: 'Vegetables' },
  ],
  videos: [
    {
      id: 'v1',
      src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      poster: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1200&q=80',
      title: 'Inside the vermi-shed',
      description: 'A walkthrough of our vermicompost beds and turning cycle.',
      duration: '2:18',
    },
    {
      id: 'v2',
      src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
      poster: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&q=80',
      title: 'From dung to soil',
      description: 'How we blend cow dung, chicken dung and fish waste into living compost.',
      duration: '1:12',
    },
    {
      id: 'v3',
      src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      poster: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=1200&q=80',
      title: 'Harvest day',
      description: 'A morning harvest of organic vegetables for our Karandeniya buyers.',
      duration: '1:05',
    },
  ],
  projects: [
    {
      id: 'pr1',
      logo: '/logos/logo-project-1.png',
      image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&q=80',
      title: 'Basnayaka VermiCompost',
      category: 'Flagship fertilizer',
      year: '2018',
      description: 'Our core vermicompost line, made from cow dung, chicken dung and aged fish waste, cured and graded for home gardens and commercial farms.',
    },
    {
      id: 'pr2',
      logo: '/logos/logo-project-2.png',
      image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80',
      title: 'Basnayaka Organic Veg',
      category: 'Vegetable cultivation',
      year: '2020',
      description: 'A rotating plot of seasonal vegetables grown on fish-based nutrients and vermicompost, supplied to local buyers and wholesale markets.',
    },
    {
      id: 'pr3',
      logo: '/logos/logo-project-3.png',
      image: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=800&q=80',
      title: 'Basnayaka Fish Nutrient',
      category: 'Liquid fertilizer',
      year: '2022',
      description: 'A concentrated fish-based liquid nutrient that feeds soil biology and boosts vegetable flavour, shelf life and disease resistance.',
    },
  ],
  contactEmail: 'hello@basnayakavermigrow.lk',
  contactPhone: '+94 77 123 4567',
  contactAddress: 'Karandeniya, Galle District, Southern Province, Sri Lanka',
  socials: [
    { id: 'so1', label: 'Facebook', url: 'https://facebook.com' },
    { id: 'so2', label: 'WhatsApp', url: 'https://whatsapp.com' },
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
      name: 'basnayaka-vermigrow-content',
    }
  )
)
