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
  /** A second number (office landline), shown beside the mobile. */
  contactPhoneAlt?: string
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
  tagline: 'Organic fertilizer and vegetables, grown in Karandeniya',
  // One slide, because there is one real photograph of the farm. This array
  // previously held three Unsplash images, which the hero rotated through.
  heroSlides: [
    {
      id: 'h1',
      type: 'image',
      src: '/images/farm-hero.jpg',
      title: 'Healthy soil grows healthy food',
      subtitle: 'Organic compost and vegetables from our family farm in Karandeniya, Sri Lanka',
    },
  ],
  aboutTitle: 'We are Basnayaka Vermigrow',
  aboutBody:
    'We are a family farm in Karandeniya, in the low country of southern Sri Lanka. Our family has worked this land for three generations. We make our living by composting cow dung, chicken dung and fish waste, then feeding that compost to red earthworms. The worms turn it into vermicompost, which we sell to home gardeners, farmers and nurseries. We also grow vegetables in our own beds using fish-based nutrients and no synthetic chemicals. Most of what we grow is sold locally, and the rest goes to wholesale buyers. Every batch is turned by hand and every bed is graded by hand. We keep one simple standard: if we would not use it on our own crops, we do not sell it.',
  aboutImage: '/images/farm-about.jpg',
  mission:
    'To make good, chemical-free compost affordable and easy to find for every farmer and home gardener in Sri Lanka.',
  vision:
    'A country where the soil gets richer every season instead of poorer, and where good food can be grown without synthetic chemicals.',
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
        'Cow dung and chicken dung broken down by red earthworms into dark, crumbly castings. It feeds plants slowly and helps the soil hold water.',
    },
    {
      id: 'sv2',
      icon: 'Recycle',
      title: 'Custom compost blend',
      price: 'Rs 250',
      unit: 'per kg',
      featured: false,
      description:
        'Blends of cow dung, chicken dung, fish waste and green matter, turned and left to cure for 60 to 90 days so the nutrients settle and weed seeds die off.',
    },
    {
      id: 'sv3',
      icon: 'Leaf',
      title: 'Organic vegetables',
      price: 'From Rs 80',
      unit: 'per 100g',
      featured: true,
      description:
        'Seasonal vegetables grown in our own beds with fish-based nutrients and vermicompost. Sold wholesale and direct to local buyers in Karandeniya.',
    },
    {
      id: 'sv4',
      icon: 'Droplets',
      title: 'Fish ATE nutrients',
      price: 'Rs 600',
      unit: 'per litre',
      featured: false,
      description:
        'A liquid nutrient made from fish waste. It feeds the soil and the leaves, and helps vegetables taste better and keep longer. No synthetic additives.',
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
      description: 'Our main vermicompost line. Cow dung, chicken dung and aged fish waste, cured and graded for home gardens and commercial farms.',
    },
    {
      id: 'pr2',
      logo: '/images/brand-pananala.png',
      image: '/images/farm-hero.jpg',
      title: 'Pananala',
      category: 'Integrated farming',
      year: '2020',
      description: 'Our vegetable plots. We grow seasonal vegetables with fish-based nutrients and vermicompost, and sell to local buyers and wholesale markets.',
    },
    {
      id: 'pr3',
      logo: '/images/brand-pinwantha.png',
      image: '/images/training-day.jpg',
      title: 'Pinwantha',
      category: 'Project',
      year: '2022',
      description: 'A concentrated liquid nutrient made from fish. It feeds soil life and helps with flavour, shelf life and disease resistance.',
    },
  ],
  founder: {
    name: 'Lolitha Basnayaka',
    title: 'Founder and Master Composter, Basnayaka Vermigrow',
    image: '/images/founder.jpg',
    bio: 'Lolitha Basnayaka is a third-generation farmer from Karandeniya in Galle District. He learned farming from his family, then spent five years studying vermicomposting before starting Basnayaka Vermigrow in 2018. He had watched paddy soils in the Southern Province get weaker year after year from too much synthetic fertiliser, and wanted to do something practical about it. He studied composting in Colombo, Kandy and Kerala, India, and brought the methods home. His compost mixes cow dung, chicken dung and fish waste with red earthworms (Eudrilus eugeniae). He speaks at farmer training programmes run by the Department of Agrarian Development, and Divaina and Lankadeepa have written about his work on chemical-free farming in the low-country wet zone.',
    quote: 'The earthworm is the farmer\'s best partner. Look after the soil and the soil will look after you.',
    achievements: [
      { id: 'fa1', text: 'Certified organic compost producer, Sri Lanka National Organic Control Unit', year: '2019' },
      { id: 'fa2', text: 'Trainer for Department of Agrarian Development farmer programmes, Southern Province', year: '2020' },
      { id: 'fa3', text: 'Developed a vermicompost formula for low-country wet-zone soils', year: '2021' },
      { id: 'fa4', text: 'Featured in Divaina and Lankadeepa for chemical-free farming', year: '2022' },
      { id: 'fa5', text: 'Supplies vermicompost to more than 200 home gardens and 15 commercial farms in Galle, Matara and Hambantota', year: '2023' },
    ],
  },
  contactEmail: 'basnayakavermigrow@gmail.com',
  contactPhone: '+94 77 252 8685',
  contactPhoneAlt: '0117 250 250',
  contactAddress: 'No 06, Basnayaka Vermigrow, Kekiriskanda, Karandeniya 80360, Sri Lanka',
  socials: [
    { id: 'so1', label: 'Facebook', url: 'https://www.facebook.com/Basnayakavermigrow/' },
  ],
  mapLocations: [
    {
      id: 'ml1',
      lat: 6.2167,
      lng: 80.0667,
      title: 'Karandeniya Main Farm',
      contactNo: '+94 77 123 4567',
      description: 'Our main compost yard and training centre, run by the family. Three generations of farming experience.',
      photos: ['/images/farm-hero.jpg'],
    },
    {
      id: 'ml2',
      lat: 6.0536,
      lng: 80.2216,
      title: 'Galle Distribution Centre',
      contactNo: '+94 77 234 5678',
      description: 'Distribution point for farmers and home gardens in Galle district.',
      photos: ['/images/farm-about.jpg'],
    },
    {
      id: 'ml3',
      lat: 5.95,
      lng: 80.55,
      title: 'Matara Partner Farm',
      contactNo: '+94 77 345 6789',
      description: 'Partner farm growing commercial vegetables with our vermicompost in Matara district.',
      photos: ['/images/training-day.jpg'],
    },
  ],
  notices: [
    {
      id: 'n1',
      title: 'Vermicompost Training Workshop',
      date: '2025-08-15',
      location: 'Karandeniya Main Farm',
      description: 'Hands-on training on vermicomposting. Learn directly from Lolitha Basnayaka. Seats are limited, so register early.',
      type: 'training',
    },
    {
      id: 'n2',
      title: 'Organic Farming Field Day',
      date: '2025-09-10',
      location: 'Galle District Agrarian Centre',
      description: 'Our annual field day on organic farming and vermicompost use. Free entry for registered farmers, with demonstrations by Department of Agrarian Development officers.',
      type: 'event',
    },
    {
      id: 'n3',
      title: 'Advanced Composting Workshop',
      date: '2025-10-05',
      location: 'Karandeniya Main Farm',
      description: 'A two-day workshop on advanced vermicomposting. Certificate provided. Accommodation can be arranged for people travelling from outstation.',
      type: 'training',
    },
    {
      id: 'n4',
      title: 'New Fish Nutrient Product Launch',
      date: '2025-11-20',
      location: 'Karandeniya Main Farm',
      description: 'Launch of our new fish-based liquid nutrient. Introductory pricing for everyone who attends, and refreshments provided.',
      type: 'event',
    },
    {
      id: 'n5',
      title: 'School Awareness Program on Soil Health',
      date: '2025-12-05',
      location: 'Karandeniya Regional School',
      description: 'A school programme on soil health and organic farming, with hands-on vermicompost demonstrations for the children.',
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
