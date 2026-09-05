/**
 * Shared default content for Basnayaka VermiGrow.
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
  photos: [
    { id: 'p1', src: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1200&q=80', caption: 'Compost rows at dawn', category: 'Farm Environment' },
    { id: 'p2', src: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&q=80', caption: 'Vermi-beds under shade', category: 'Farm Environment' },
    { id: 'p3', src: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=1200&q=80', caption: 'Morning harvest basket', category: 'Farm Environment' },
    { id: 'p4', src: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=1200&q=80', caption: 'Hand sorting compost', category: 'Farm Environment' },
    { id: 'p5', src: 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?w=1200&q=80', caption: 'Curing shed interior', category: 'Farm Environment' },
    { id: 'p6', src: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=1200&q=80', caption: 'Fresh picked vegetables', category: 'Farm Environment' },
    { id: 'p7', src: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80', caption: 'Golden hour at the farm', category: 'Farm Environment' },
    { id: 'p8', src: 'https://images.unsplash.com/photo-1492496913980-501348b61469?w=1200&q=80', caption: 'Earthworm composting beds', category: 'Farm Environment' },
    { id: 'p9', src: 'https://images.unsplash.com/photo-1586771107445-1b954c12d73c?w=1200&q=80', caption: 'Organic vegetable plot', category: 'Farm Environment' },
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
  founder: {
    name: 'Lolitha Basnayaka',
    title: 'Founder & Master Composter — Basnayaka VermiGrow',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
    bio: 'Lolitha Basnayaka is a third-generation farmer from Karandeniya, Galle District, who turned his family\'s traditional farming knowledge into a science-driven organic fertilizer enterprise. After witnessing the steady degradation of paddy soils in Southern Province from synthetic fertiliser overuse, Lolitha spent five years studying vermicomposting techniques — travelling to composting facilities in Colombo, Kandy and as far as Kerala, India — before establishing Basnayaka VermiGrow in 2018. His method combines cow dung, chicken dung and fish waste with locally-sourced red earthworms (Eudrilus eugeniae), producing a living soil amendment that restores microbial ecology while feeding crops. He is a frequent speaker at the Department of Agrarian Development\'s farmer-training programmes and has been featured in Divaina and Lankadeepa for his work on chemical-free farming in the low-country wet zone.',
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
      photos: [
        'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&q=80',
      ],
    },
    {
      id: 'ml2',
      lat: 6.0536,
      lng: 80.2216,
      title: 'Galle Distribution Centre',
      contactNo: '+94 77 234 5678',
      description: 'Distribution hub serving Galle district farmers and home gardens with vermicompost and organic vegetables.',
      photos: [
        'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80',
      ],
    },
    {
      id: 'ml3',
      lat: 5.95,
      lng: 80.55,
      title: 'Matara Partner Farm',
      contactNo: '+94 77 345 6789',
      description: 'Partner farm using Basnayaka vermicompost for commercial vegetable cultivation in Matara district.',
      photos: [
        'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=800&q=80',
      ],
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
  eventPhotos: [
    { id: 'ep1', src: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&q=80', caption: 'Basnayaka VermiGrow Grand Opening Ceremony', category: 'Opening' },
    { id: 'ep2', src: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1200&q=80', caption: 'New Compost Facility Inauguration', category: 'Ceremony' },
    { id: 'ep3', src: 'https://images.unsplash.com/photo-1511578314322-1af6a70ce62b?w=1200&q=80', caption: 'Community Farming Day Celebration', category: 'Event' },
    { id: 'ep4', src: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1200&q=80', caption: 'Annual Harvest Festival 2025', category: 'Event' },
    { id: 'ep5', src: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=1200&q=80', caption: 'Official Launch of Fish Nutrient Line', category: 'Opening' },
    { id: 'ep6', src: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&q=80', caption: 'Soil Health Awareness Program', category: 'Event' },
  ],
  trainingPhotos: [
    { id: 'tp1', src: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1200&q=80', caption: 'Hands-on Vermicompost Training', category: 'Training' },
    { id: 'tp2', src: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=1200&q=80', caption: 'Compost Making Demonstration', category: 'Training' },
    { id: 'tp3', src: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1200&q=80', caption: 'Farmer Workshop at Karandeniya', category: 'Workshop' },
    { id: 'tp4', src: 'https://images.unsplash.com/photo-1581092795365-0e6a005c7d4a?w=1200&q=80', caption: 'Organic Farming Techniques Session', category: 'Training' },
    { id: 'tp5', src: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=1200&q=80', caption: 'Group Training with Department of Agriculture', category: 'Workshop' },
    { id: 'tp6', src: 'https://images.unsplash.com/photo-1532619187608-e5375cab36aa?w=1200&q=80', caption: 'Vermicomposting Certification Program', category: 'Training' },
  ],
  trainingVideos: [
    {
      id: 'tv1',
      src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      poster: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1200&q=80',
      title: 'Vermicomposting Basics',
      description: 'Step-by-step guide to setting up your own vermicompost bed.',
      duration: '15:30',
    },
    {
      id: 'tv2',
      src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
      poster: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=1200&q=80',
      title: 'Advanced Composting Techniques',
      description: 'Deep dive into advanced composting methods for experienced farmers.',
      duration: '22:15',
    },
  ],
}
