/**
 * Shared default content for Basnayaka Vermigrow.
 * Imported by both the client store and server API to ensure a single source of truth.
 */

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

export interface ProductItem {
  id: string
  icon: string
  title: string
  description: string
  price: string
  unit: string
  featured: boolean
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

export interface FounderAchievement {
  id: string
  text: string
  year: string
}

export interface FounderInfo {
  name: string
  title: string
  image: string
  bio: string
  quote: string
  achievements: FounderAchievement[]
}

export interface SocialItem {
  id: string
  label: string
  url: string
}

export interface MapLocation {
  id: string
  lat: number
  lng: number
  title: string
  contactNo: string
  description: string
  photos: string[]
}

export interface NoticeItem {
  id: string
  title: string
  date: string
  location: string
  description: string
  type: 'event' | 'training'
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
  products: ProductItem[]
  photos: PhotoItem[]
  videos: VideoCard[]
  projects: ProjectItem[]
  founder: FounderInfo
  contactEmail: string
  contactPhone: string
  contactAddress: string
  socials: SocialItem[]
  mapLocations: MapLocation[]
  notices: NoticeItem[]
  eventPhotos: PhotoItem[]
  trainingPhotos: PhotoItem[]
  trainingVideos: VideoCard[]
  /** SEO fields */
  seoTitle?: string
  seoDescription?: string
  ogImage?: string
}

export const defaultContent: SiteContent = {
  brand: 'Basnayaka Vermigrow',
  tagline: 'Organic fertility, from soil to harvest',
  // One slide, because there is one real photograph of the farm. This array
  // previously held three Unsplash images, which the hero rotated through.
  heroSlides: [
    {
      id: 'h1',
      type: 'image',
      src: '/images/farm-hero.jpg',
      title: 'Growing soil, growing life',
      subtitle: 'Organic fertilizer & vegetables from Karandeniya, Sri Lanka',
    },
  ],
  aboutTitle: 'We are Basnayaka Vermigrow',
  aboutBody:
    'Basnayaka Vermigrow is a family-run organic farm in Karandeniya, in Sri Lanka’s southern lowlands, where traditional farming knowledge meets modern composting science. We produce premium organic fertilizer by carefully composting cow dung, chicken dung and fish waste, then enriching it through vermicomposting with earthworms. The result is a living soil amendment that restores micro-biology, improves water retention, and feeds plants slowly and naturally. Alongside our fertilizer line, we cultivate a rotating selection of organic vegetables using fish-based nutrients and zero synthetic chemicals, supplying our local community and wholesale buyers with produce that tastes the way vegetables used to taste. Every batch is hand-turned, every bed is hand-graded, and every harvest is a small act of stewardship for the land we have farmed for three generations.',
  aboutImage: '/images/farm-about.jpg',
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
  products: [
    {
      id: 'sv1',
      icon: 'Sprout',
      title: 'Vermicompost',
      price: 'Rs 350',
      unit: 'per kg',
      featured: true,
      description:
        'Aged cow dung and chicken dung composted with red earthworms into dark, microbe-rich castings. Slow-release nutrition that builds soil structure and water-holding capacity.',
    },
    {
      id: 'sv2',
      icon: 'Recycle',
      title: 'Custom compost blend',
      price: 'Rs 250',
      unit: 'per kg',
      featured: false,
      description:
        'Custom blends using cow dung, chicken dung, fish waste and green matter, turned and cured for 60–90 days to stabilise nutrients and kill weed seeds.',
    },
    {
      id: 'sv3',
      icon: 'Leaf',
      title: 'Organic vegetables',
      price: 'From Rs 80',
      unit: 'per 100g',
      featured: true,
      description:
        'Seasonal vegetables grown in our own beds using fish-based nutrients and vermicompost. Available wholesale and direct to local buyers in Karandeniya.',
    },
    {
      id: 'sv4',
      icon: 'Droplets',
      title: 'Fish ATE nutrients',
      price: 'Rs 600',
      unit: 'per litre',
      featured: false,
      description:
        'Fish-based liquid nutrient blends that feed foliar and soil biology, boosting vegetable flavour, shelf life and resistance without any synthetic additives.',
    },
  ],
  // Only the photographs this farm actually has. The nine frames here were
  // Unsplash stock — sheds, beds and harvests of farms that are not this one —
  // captioned as if they were. The hero is deliberately NOT repeated here: the
  // logo is baked into it, so it reads as a brand graphic rather than a photo.
  photos: [
    { id: 'p1', src: '/images/farm-about.jpg', caption: 'Finished vermicompost, ready to use', category: 'Farm Environment' },
    { id: 'p2', src: '/images/training-day.jpg', caption: 'A training day with local growers', category: 'Training' },
  ],
  // Empty on purpose. These three were Google's gtv-videos-bucket sample clips
  // (ForBiggerJoyrides/ForBiggerFun/ForBiggerBlazes) — demo files shipped with a
  // video-player tutorial, captioned as farm footage. VideoShowcase renders
  // nothing while this is empty; add real clips when they exist.
  videos: [],
  // Renamed to the three real brand marks (Gedavila / Pananala / Pinwantha).
  // Categories are taken from what each logo actually says. DESCRIPTIONS and
  // YEARS are carried over unchanged from the previous cards and still describe
  // the old product lines — they need the client's real copy before launch.
  projects: [
    {
      id: 'pr1',
      logo: '/images/brand-gedavila.png',
      image: '/images/farm-about.jpg',
      title: 'Gedavila',
      category: 'Fertilizer',
      year: '2018',
      description: 'Our core vermicompost line, made from cow dung, chicken dung and aged fish waste, cured and graded for home gardens and commercial farms.',
    },
    {
      id: 'pr2',
      logo: '/images/brand-pananala.png',
      image: '/images/farm-hero.jpg',
      title: 'Pananala',
      category: 'Integrated farming',
      year: '2020',
      description: 'A rotating plot of seasonal vegetables grown on fish-based nutrients and vermicompost, supplied to local buyers and wholesale markets.',
    },
    {
      id: 'pr3',
      logo: '/images/brand-pinwantha.png',
      image: '/images/training-day.jpg',
      title: 'Pinwantha',
      category: 'Project',
      year: '2022',
      description: 'A concentrated fish-based liquid nutrient that feeds soil biology and boosts vegetable flavour, shelf life and disease resistance.',
    },
  ],
  founder: {
    name: 'Lolitha Basnayaka',
    title: 'Founder & Master Composter — Basnayaka Vermigrow',
    image: '/images/founder.jpg',
    bio: 'Lolitha Basnayaka is a third-generation farmer from Karandeniya, Galle District, who turned his family\'s traditional farming knowledge into a science-driven organic fertilizer enterprise. After witnessing the steady degradation of paddy soils in Southern Province from synthetic fertiliser overuse, Lolitha spent five years studying vermicomposting techniques — travelling to composting facilities in Colombo, Kandy and as far as Kerala, India — before establishing Basnayaka Vermigrow in 2018. His method combines cow dung, chicken dung and fish waste with locally-sourced red earthworms (Eudrilus eugeniae), producing a living soil amendment that restores microbial ecology while feeding crops. He is a frequent speaker at the Department of Agrarian Development\'s farmer-training programmes and has been featured in Divaina and Lankadeepa for his work on chemical-free farming in the low-country wet zone.',
    quote: 'The earthworm is the farmer\'s truest partner. Feed the soil biology, and the soil will feed you.',
    achievements: [
      { id: 'fa1', text: 'Certified organic compost producer — Sri Lanka National Organic Control Unit', year: '2019' },
      { id: 'fa2', text: 'Trainer for Department of Agrarian Development farmer programmes, Southern Province', year: '2020' },
      { id: 'fa3', text: 'Developed region-specific vermicompost formula for low-country wet-zone soils', year: '2021' },
      { id: 'fa4', text: 'Featured in Divaina and Lankadeepa for chemical-free farming advocacy', year: '2022' },
      { id: 'fa5', text: 'Supplies vermicompost to 200+ home gardens and 15 commercial farms across Galle, Matara and Hambantota', year: '2023' },
    ],
  },
  contactEmail: 'hello@basnayakavermigrow.lk',
  contactPhone: '+94 77 123 4567',
  contactAddress: 'Karandeniya, Galle District, Southern Province, Sri Lanka',
  socials: [
    { id: 'so1', label: 'Facebook', url: 'https://facebook.com' },
    { id: 'so2', label: 'WhatsApp', url: 'https://whatsapp.com' },
    { id: 'so3', label: 'YouTube', url: 'https://youtube.com' },
  ],
  mapLocations: [
    {
      id: 'ml1',
      lat: 6.2167,
      lng: 80.0667,
      title: 'Karandeniya Main Farm',
      contactNo: '+94 77 123 4567',
      description: 'Main vermicompost production facility and training centre. Family-run farm with three generations of farming knowledge.',
      photos: ['/images/farm-hero.jpg'],
    },
    {
      id: 'ml2',
      lat: 6.0536,
      lng: 80.2216,
      title: 'Galle Distribution Centre',
      contactNo: '+94 77 234 5678',
      description: 'Distribution hub serving Galle district farmers and home gardens with vermicompost and organic vegetables.',
      photos: ['/images/farm-about.jpg'],
    },
    {
      id: 'ml3',
      lat: 5.95,
      lng: 80.55,
      title: 'Matara Partner Farm',
      contactNo: '+94 77 345 6789',
      description: 'Partner farm using Basnayaka vermicompost for commercial vegetable cultivation in Matara district.',
      photos: ['/images/training-day.jpg'],
    },
  ],
  notices: [
    {
      id: 'n1',
      title: 'Vermicompost Training Workshop',
      date: '2025-08-15',
      location: 'Karandeniya Main Farm',
      description: 'Hands-on training on vermicomposting techniques. Learn from Mr. Lolitha Basnayaka himself. Limited seats available. Register early to secure your spot.',
      type: 'training',
    },
    {
      id: 'n2',
      title: 'Organic Farming Field Day',
      date: '2025-09-10',
      location: 'Galle District Agrarian Centre',
      description: 'Annual field day showcasing organic farming methods and vermicompost application. Free entry for registered farmers. Demonstrations by Department of Agrarian Development officers.',
      type: 'event',
    },
    {
      id: 'n3',
      title: 'Advanced Composting Workshop',
      date: '2025-10-05',
      location: 'Karandeniya Main Farm',
      description: 'Two-day intensive workshop on advanced vermicomposting techniques. Certificate provided. Accommodation available for outstation participants.',
      type: 'training',
    },
    {
      id: 'n4',
      title: 'New Fish Nutrient Product Launch',
      date: '2025-11-20',
      location: 'Karandeniya Main Farm',
      description: 'Official launch of our new fish-based liquid nutrient. Special introductory pricing for all attendees. Refreshments provided.',
      type: 'event',
    },
    {
      id: 'n5',
      title: 'School Awareness Program on Soil Health',
      date: '2025-12-05',
      location: 'Karandeniya Regional School',
      description: 'Educational program for school children on the importance of soil health and organic farming. Interactive sessions with live vermicompost demonstrations.',
      type: 'training',
    },
  ],
  // All three emptied together. The event and training galleries were stock
  // photos captioned as named occasions — "Annual Harvest Festival 2025",
  // "Group Training with Department of Agriculture" — which asserts things
  // about this business that the images did not show. There is exactly one real
  // training photograph, and it lives in `photos` above. EventGallery and
  // TrainingGallery both render nothing for an empty array.
  eventPhotos: [],
  trainingPhotos: [],
  trainingVideos: [],
}

/**
 * Fill any keys missing in `stored` from `defaults`, recursively.
 * Stored values always win when present; arrays are taken or left whole
 * (never concatenated) and fall back to the default if they aren't arrays.
 * Older content blobs saved before newer sections were added (map, notices,
 * events, training…) are missing those keys — without this, the admin editor
 * crashes on `content.<section>.map` and nested fields like
 * `founder.achievements` can be undefined too.
 */
export function deepMergeDefaults<T>(defaults: T, stored: unknown): T {
  if (Array.isArray(defaults)) {
    return (Array.isArray(stored) ? stored : defaults) as T
  }
  if (defaults !== null && typeof defaults === 'object') {
    if (stored === null || typeof stored !== 'object' || Array.isArray(stored)) {
      return (stored === undefined || stored === null ? defaults : stored) as T
    }
    const out: Record<string, unknown> = { ...stored }
    for (const [key, defVal] of Object.entries(defaults as Record<string, unknown>)) {
      out[key] = deepMergeDefaults(defVal, (stored as Record<string, unknown>)[key])
    }
    return out as T
  }
  return (stored === undefined ? defaults : stored) as T
}
