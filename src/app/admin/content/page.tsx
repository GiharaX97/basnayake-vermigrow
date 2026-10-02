'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileUpload } from '@/components/admin/file-upload'
import { toast } from 'sonner'
import {
  Save,
  Plus,
  Trash2,
  Loader2,
  GripVertical,
  AlertCircle,
} from 'lucide-react'

interface SlideItem {
  id: string
  type: 'video' | 'image'
  src: string
  poster?: string
  title?: string
  subtitle?: string
}

interface PhotoItem {
  id: string
  src: string
  caption: string
  category: string
}

interface VideoCard {
  id: string
  src: string
  poster: string
  title: string
  description: string
  duration: string
}

interface ProductItem {
  id: string
  icon: string
  title: string
  description: string
  price: string
  unit: string
  featured: boolean
}

interface StatItem {
  id: string
  value: string
  label: string
}

interface ProjectItem {
  id: string
  image: string
  logo?: string
  title: string
  category: string
  year: string
  description?: string
}

interface SocialItem {
  id: string
  label: string
  url: string
}

interface FounderAchievement {
  id: string
  text: string
  year: string
}

interface FounderInfo {
  name: string
  title: string
  image: string
  bio: string
  quote: string
  achievements: FounderAchievement[]
}

interface MapLocation {
  id: string
  lat: number
  lng: number
  title: string
  contactNo: string
  description: string
  photos: string[]
}

interface NoticeItem {
  id: string
  title: string
  date: string
  location: string
  description: string
  type: 'event' | 'training'
}

interface SiteContent {
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
  /** Read by the root layout's generateMetadata() — blank falls back to a built-in default. */
  seoTitle?: string
  seoDescription?: string
  ogImage?: string
}

let idCounter = 100
function uid() {
  return `item_${++idCounter}`
}

export default function ContentEditor() {
  const [content, setContent] = useState<SiteContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('general')

  useEffect(() => {
    fetch('/api/content')
      .then((r) => r.json())
      .then((data) => {
        if (data) setContent(data)
        else setContent(null)
      })
      .catch(() => toast.error('Failed to load content'))
      .finally(() => setLoading(false))
  }, [])

  const update = <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => {
    setContent((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const save = async () => {
    if (!content) return
    setSaving(true)
    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
      })
      if (res.ok) {
        toast.success('Content saved!')
      } else {
        toast.error('Failed to save')
      }
    } catch {
      toast.error('Connection error')
    } finally {
      setSaving(false)
    }
  }

  const addItem = <T,>(arr: T[], template: T, key: keyof SiteContent) => {
    update(key, [...arr, template] as any)
  }

  const removeItem = <T,>(arr: T[], idx: number, key: keyof SiteContent) => {
    const next = arr.filter((_, i) => i !== idx)
    update(key, next as any)
  }

  const updateItem = <T,>(arr: T[], idx: number, field: Partial<T>, key: keyof SiteContent) => {
    const next = arr.map((item, i) => (i === idx ? { ...item, ...field } : item))
    update(key, next as any)
  }

  const moveItem = <T,>(arr: T[], fromIdx: number, toIdx: number, key: keyof SiteContent) => {
    if (toIdx < 0 || toIdx >= arr.length) return
    const next = [...arr]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    update(key, next as any)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">No content found. Save defaults first?</p>
        <Button onClick={() => {
          import('@/store/content-store').then((m) => {
            setContent(m.defaultContent)
          })
        }}>
          Load Default Content
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Content Editor</h1>
          <p className="text-muted-foreground mt-1">
            Edit all sections of your website
          </p>
        </div>
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save All
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full overflow-x-auto flex-nowrap h-auto justify-start scrollbar-thin">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="hero">Hero</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
          <TabsTrigger value="videos">Videos</TabsTrigger>
          <TabsTrigger value="training-videos">Tr. Videos</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="notices">Notices</TabsTrigger>
          <TabsTrigger value="founder">Founder</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Brand Identity</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Brand Name</Label>
                <Input value={content.brand} onChange={(e) => update('brand', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tagline</Label>
                <Input value={content.tagline} onChange={(e) => update('tagline', e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hero */}
        <TabsContent value="hero" className="space-y-4 mt-4">
          {content.heroSlides.map((slide, i) => (
            <Card key={slide.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Slide {i + 1}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => moveItem(content.heroSlides, i, i - 1, 'heroSlides')} title="Move up">
                    <span className="text-muted-foreground text-xs font-bold">▲</span>
                  </Button>
                  <Button variant="ghost" size="icon" disabled={i === content.heroSlides.length - 1} onClick={() => moveItem(content.heroSlides, i, i + 1, 'heroSlides')} title="Move down">
                    <span className="text-muted-foreground text-xs font-bold">▼</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(content.heroSlides, i, 'heroSlides')}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={slide.title || ''} onChange={(e) => updateItem(content.heroSlides, i, { title: e.target.value }, 'heroSlides')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Subtitle</Label>
                    <Input value={slide.subtitle || ''} onChange={(e) => updateItem(content.heroSlides, i, { subtitle: e.target.value }, 'heroSlides')} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={slide.type}
                      onChange={(e) => updateItem(content.heroSlides, i, { type: e.target.value as 'image' | 'video' }, 'heroSlides')}
                    >
                      <option value="image">Image</option>
                      <option value="video">Video</option>
                    </select>
                  </div>
                  {slide.type === 'video' && (
                    <div className="space-y-2">
                      <Label>Poster URL</Label>
                      <Input value={slide.poster || ''} onChange={(e) => updateItem(content.heroSlides, i, { poster: e.target.value }, 'heroSlides')} />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{slide.type === 'video' ? 'Video' : 'Image'} URL</Label>
                  <FileUpload
                    currentUrl={slide.src}
                    accept={slide.type === 'video' ? 'video/*' : 'image/*'}
                    onUpload={(url) => updateItem(content.heroSlides, i, { src: url }, 'heroSlides')}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={() => addItem(content.heroSlides, { id: uid(), type: 'image', src: '', title: '', subtitle: '' }, 'heroSlides')}>
            <Plus className="h-4 w-4 mr-2" /> Add Slide
          </Button>
        </TabsContent>

        {/* About */}
        <TabsContent value="about" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>About Section</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={content.aboutTitle} onChange={(e) => update('aboutTitle', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Body</Label>
                <Textarea rows={6} value={content.aboutBody} onChange={(e) => update('aboutBody', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Image</Label>
                <FileUpload currentUrl={content.aboutImage} onUpload={(url) => update('aboutImage', url)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mission</Label>
                  <Textarea rows={3} value={content.mission} onChange={(e) => update('mission', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Vision</Label>
                  <Textarea rows={3} value={content.vision} onChange={(e) => update('vision', e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stats */}
        <TabsContent value="stats" className="space-y-4 mt-4">
          {content.stats.map((stat, i) => (
            <Card key={stat.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Stat {i + 1}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => moveItem(content.stats, i, i - 1, 'stats')} title="Move up"><span className="text-muted-foreground text-xs font-bold">▲</span></Button>
                  <Button variant="ghost" size="icon" disabled={i === content.stats.length - 1} onClick={() => moveItem(content.stats, i, i + 1, 'stats')} title="Move down"><span className="text-muted-foreground text-xs font-bold">▼</span></Button>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(content.stats, i, 'stats')}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Value</Label>
                  <Input value={stat.value} onChange={(e) => updateItem(content.stats, i, { value: e.target.value }, 'stats')} />
                </div>
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input value={stat.label} onChange={(e) => updateItem(content.stats, i, { label: e.target.value }, 'stats')} />
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={() => addItem(content.stats, { id: uid(), value: '', label: '' }, 'stats')}>
            <Plus className="h-4 w-4 mr-2" /> Add Stat
          </Button>
        </TabsContent>

        {/* Products */}
        <TabsContent value="products" className="space-y-4 mt-4">
          {content.products.map((prod, i) => (
            <Card key={prod.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{prod.title || `Product ${i + 1}`}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => moveItem(content.products, i, i - 1, 'products')} title="Move up"><span className="text-muted-foreground text-xs font-bold">▲</span></Button>
                  <Button variant="ghost" size="icon" disabled={i === content.products.length - 1} onClick={() => moveItem(content.products, i, i + 1, 'products')} title="Move down"><span className="text-muted-foreground text-xs font-bold">▼</span></Button>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(content.products, i, 'products')}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Icon (lucide name)</Label>
                    <Input value={prod.icon} onChange={(e) => updateItem(content.products, i, { icon: e.target.value }, 'products')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={prod.title} onChange={(e) => updateItem(content.products, i, { title: e.target.value }, 'products')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea rows={3} value={prod.description} onChange={(e) => updateItem(content.products, i, { description: e.target.value }, 'products')} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Price (e.g. Rs 350)</Label>
                    <Input value={prod.price} onChange={(e) => updateItem(content.products, i, { price: e.target.value }, 'products')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit (e.g. per kg)</Label>
                    <Input value={prod.unit} onChange={(e) => updateItem(content.products, i, { unit: e.target.value }, 'products')} />
                  </div>
                  <div className="space-y-2 flex items-end pb-1">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={prod.featured}
                        onChange={(e) => updateItem(content.products, i, { featured: e.target.checked }, 'products')}
                        className="rounded border-border"
                      />
                      Featured / Best seller
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={() => addItem(content.products, { id: uid(), icon: 'Leaf', title: '', description: '', price: '', unit: '', featured: false }, 'products')}>
            <Plus className="h-4 w-4 mr-2" /> Add Product
          </Button>
        </TabsContent>

        {/* Map Locations */}
        <TabsContent value="map" className="space-y-4 mt-4">
          {content.mapLocations.map((loc, i) => (
            <Card key={loc.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{loc.title || `Location ${i + 1}`}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => moveItem(content.mapLocations, i, i - 1, 'mapLocations')} title="Move up"><span className="text-muted-foreground text-xs font-bold">▲</span></Button>
                  <Button variant="ghost" size="icon" disabled={i === content.mapLocations.length - 1} onClick={() => moveItem(content.mapLocations, i, i + 1, 'mapLocations')} title="Move down"><span className="text-muted-foreground text-xs font-bold">▼</span></Button>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(content.mapLocations, i, 'mapLocations')}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={loc.title} onChange={(e) => updateItem(content.mapLocations, i, { title: e.target.value }, 'mapLocations')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact No</Label>
                    <Input value={loc.contactNo} onChange={(e) => updateItem(content.mapLocations, i, { contactNo: e.target.value }, 'mapLocations')} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Latitude</Label>
                    <Input type="number" step="any" value={loc.lat} onChange={(e) => updateItem(content.mapLocations, i, { lat: parseFloat(e.target.value) || 0 }, 'mapLocations')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Longitude</Label>
                    <Input type="number" step="any" value={loc.lng} onChange={(e) => updateItem(content.mapLocations, i, { lng: parseFloat(e.target.value) || 0 }, 'mapLocations')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea rows={3} value={loc.description} onChange={(e) => updateItem(content.mapLocations, i, { description: e.target.value }, 'mapLocations')} />
                </div>
                <div className="space-y-2">
                  <Label>Photos (one URL per line)</Label>
                  <Textarea rows={2} value={loc.photos.join('\n')} onChange={(e) => updateItem(content.mapLocations, i, { photos: e.target.value.split('\n').filter(Boolean) }, 'mapLocations')} />
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={() => addItem(content.mapLocations, { id: uid(), lat: 7.5, lng: 80.7, title: '', contactNo: '', description: '', photos: [] }, 'mapLocations')}>
            <Plus className="h-4 w-4 mr-2" /> Add Location
          </Button>
        </TabsContent>

        {/* Gallery */}
        <TabsContent value="gallery" className="space-y-4 mt-4">
          {content.photos.map((photo, i) => (
            <Card key={photo.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{photo.caption || `Photo ${i + 1}`}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => moveItem(content.photos, i, i - 1, 'photos')} title="Move up"><span className="text-muted-foreground text-xs font-bold">▲</span></Button>
                  <Button variant="ghost" size="icon" disabled={i === content.photos.length - 1} onClick={() => moveItem(content.photos, i, i + 1, 'photos')} title="Move down"><span className="text-muted-foreground text-xs font-bold">▼</span></Button>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(content.photos, i, 'photos')}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Caption</Label>
                    <Input value={photo.caption} onChange={(e) => updateItem(content.photos, i, { caption: e.target.value }, 'photos')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Input value={photo.category} onChange={(e) => updateItem(content.photos, i, { category: e.target.value }, 'photos')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Image URL</Label>
                  <FileUpload currentUrl={photo.src} onUpload={(url) => updateItem(content.photos, i, { src: url }, 'photos')} />
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={() => addItem(content.photos, { id: uid(), src: '', caption: '', category: '' }, 'photos')}>
            <Plus className="h-4 w-4 mr-2" /> Add Photo
          </Button>
        </TabsContent>

        {/* Events Gallery */}
        <TabsContent value="events" className="space-y-4 mt-4">
          {content.eventPhotos.map((photo, i) => (
            <Card key={photo.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{photo.caption || `Event Photo ${i + 1}`}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => moveItem(content.eventPhotos, i, i - 1, 'eventPhotos')} title="Move up"><span className="text-muted-foreground text-xs font-bold">▲</span></Button>
                  <Button variant="ghost" size="icon" disabled={i === content.eventPhotos.length - 1} onClick={() => moveItem(content.eventPhotos, i, i + 1, 'eventPhotos')} title="Move down"><span className="text-muted-foreground text-xs font-bold">▼</span></Button>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(content.eventPhotos, i, 'eventPhotos')}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Caption</Label>
                    <Input value={photo.caption} onChange={(e) => updateItem(content.eventPhotos, i, { caption: e.target.value }, 'eventPhotos')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Input value={photo.category} onChange={(e) => updateItem(content.eventPhotos, i, { category: e.target.value }, 'eventPhotos')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Image URL</Label>
                  <FileUpload currentUrl={photo.src} onUpload={(url) => updateItem(content.eventPhotos, i, { src: url }, 'eventPhotos')} />
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={() => addItem(content.eventPhotos, { id: uid(), src: '', caption: '', category: '' }, 'eventPhotos')}>
            <Plus className="h-4 w-4 mr-2" /> Add Event Photo
          </Button>
        </TabsContent>

        {/* Training Gallery */}
        <TabsContent value="training" className="space-y-4 mt-4">
          {content.trainingPhotos.map((photo, i) => (
            <Card key={photo.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{photo.caption || `Training Photo ${i + 1}`}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => moveItem(content.trainingPhotos, i, i - 1, 'trainingPhotos')} title="Move up"><span className="text-muted-foreground text-xs font-bold">▲</span></Button>
                  <Button variant="ghost" size="icon" disabled={i === content.trainingPhotos.length - 1} onClick={() => moveItem(content.trainingPhotos, i, i + 1, 'trainingPhotos')} title="Move down"><span className="text-muted-foreground text-xs font-bold">▼</span></Button>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(content.trainingPhotos, i, 'trainingPhotos')}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Caption</Label>
                    <Input value={photo.caption} onChange={(e) => updateItem(content.trainingPhotos, i, { caption: e.target.value }, 'trainingPhotos')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Input value={photo.category} onChange={(e) => updateItem(content.trainingPhotos, i, { category: e.target.value }, 'trainingPhotos')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Image URL</Label>
                  <FileUpload currentUrl={photo.src} onUpload={(url) => updateItem(content.trainingPhotos, i, { src: url }, 'trainingPhotos')} />
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={() => addItem(content.trainingPhotos, { id: uid(), src: '', caption: '', category: '' }, 'trainingPhotos')}>
            <Plus className="h-4 w-4 mr-2" /> Add Training Photo
          </Button>
        </TabsContent>

        {/* Videos */}
        <TabsContent value="videos" className="space-y-4 mt-4">
          {content.videos.map((video, i) => (
            <Card key={video.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{video.title || `Video ${i + 1}`}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => moveItem(content.videos, i, i - 1, 'videos')} title="Move up"><span className="text-muted-foreground text-xs font-bold">▲</span></Button>
                  <Button variant="ghost" size="icon" disabled={i === content.videos.length - 1} onClick={() => moveItem(content.videos, i, i + 1, 'videos')} title="Move down"><span className="text-muted-foreground text-xs font-bold">▼</span></Button>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(content.videos, i, 'videos')}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={video.title} onChange={(e) => updateItem(content.videos, i, { title: e.target.value }, 'videos')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Input value={video.duration} onChange={(e) => updateItem(content.videos, i, { duration: e.target.value }, 'videos')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea rows={2} value={video.description} onChange={(e) => updateItem(content.videos, i, { description: e.target.value }, 'videos')} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Video URL</Label>
                    <FileUpload currentUrl={video.src} accept="video/*" onUpload={(url) => updateItem(content.videos, i, { src: url }, 'videos')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Poster URL</Label>
                    <FileUpload currentUrl={video.poster} onUpload={(url) => updateItem(content.videos, i, { poster: url }, 'videos')} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={() => addItem(content.videos, { id: uid(), src: '', poster: '', title: '', description: '', duration: '' }, 'videos')}>
            <Plus className="h-4 w-4 mr-2" /> Add Video
          </Button>
        </TabsContent>

        {/* Training Videos */}
        <TabsContent value="training-videos" className="space-y-4 mt-4">
          {content.trainingVideos.map((video, i) => (
            <Card key={video.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{video.title || `Training Video ${i + 1}`}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => moveItem(content.trainingVideos, i, i - 1, 'trainingVideos')} title="Move up"><span className="text-muted-foreground text-xs font-bold">▲</span></Button>
                  <Button variant="ghost" size="icon" disabled={i === content.trainingVideos.length - 1} onClick={() => moveItem(content.trainingVideos, i, i + 1, 'trainingVideos')} title="Move down"><span className="text-muted-foreground text-xs font-bold">▼</span></Button>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(content.trainingVideos, i, 'trainingVideos')}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={video.title} onChange={(e) => updateItem(content.trainingVideos, i, { title: e.target.value }, 'trainingVideos')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Input value={video.duration} onChange={(e) => updateItem(content.trainingVideos, i, { duration: e.target.value }, 'trainingVideos')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea rows={2} value={video.description} onChange={(e) => updateItem(content.trainingVideos, i, { description: e.target.value }, 'trainingVideos')} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Video URL</Label>
                    <FileUpload currentUrl={video.src} accept="video/*" onUpload={(url) => updateItem(content.trainingVideos, i, { src: url }, 'trainingVideos')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Poster URL</Label>
                    <FileUpload currentUrl={video.poster} onUpload={(url) => updateItem(content.trainingVideos, i, { poster: url }, 'trainingVideos')} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={() => addItem(content.trainingVideos, { id: uid(), src: '', poster: '', title: '', description: '', duration: '' }, 'trainingVideos')}>
            <Plus className="h-4 w-4 mr-2" /> Add Training Video
          </Button>
        </TabsContent>

        {/* Projects */}
        <TabsContent value="projects" className="space-y-4 mt-4">
          {content.projects.map((proj, i) => (
            <Card key={proj.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{proj.title || `Project ${i + 1}`}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => moveItem(content.projects, i, i - 1, 'projects')} title="Move up"><span className="text-muted-foreground text-xs font-bold">▲</span></Button>
                  <Button variant="ghost" size="icon" disabled={i === content.projects.length - 1} onClick={() => moveItem(content.projects, i, i + 1, 'projects')} title="Move down"><span className="text-muted-foreground text-xs font-bold">▼</span></Button>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(content.projects, i, 'projects')}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={proj.title} onChange={(e) => updateItem(content.projects, i, { title: e.target.value }, 'projects')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Input value={proj.category} onChange={(e) => updateItem(content.projects, i, { category: e.target.value }, 'projects')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Year</Label>
                    <Input value={proj.year} onChange={(e) => updateItem(content.projects, i, { year: e.target.value }, 'projects')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea rows={2} value={proj.description || ''} onChange={(e) => updateItem(content.projects, i, { description: e.target.value }, 'projects')} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Image</Label>
                    <FileUpload currentUrl={proj.image} onUpload={(url) => updateItem(content.projects, i, { image: url }, 'projects')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Logo (optional)</Label>
                    <FileUpload currentUrl={proj.logo || ''} onUpload={(url) => updateItem(content.projects, i, { logo: url }, 'projects')} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={() => addItem(content.projects, { id: uid(), image: '', title: '', category: '', year: '', description: '' }, 'projects')}>
            <Plus className="h-4 w-4 mr-2" /> Add Project
          </Button>
        </TabsContent>

        {/* Notices */}
        <TabsContent value="notices" className="space-y-4 mt-4">
          {content.notices.map((notice, i) => (
            <Card key={notice.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{notice.title || `Notice ${i + 1}`}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => moveItem(content.notices, i, i - 1, 'notices')} title="Move up"><span className="text-muted-foreground text-xs font-bold">▲</span></Button>
                  <Button variant="ghost" size="icon" disabled={i === content.notices.length - 1} onClick={() => moveItem(content.notices, i, i + 1, 'notices')} title="Move down"><span className="text-muted-foreground text-xs font-bold">▼</span></Button>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(content.notices, i, 'notices')}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={notice.title} onChange={(e) => updateItem(content.notices, i, { title: e.target.value }, 'notices')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input value={notice.date} onChange={(e) => updateItem(content.notices, i, { date: e.target.value }, 'notices')} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input value={notice.location} onChange={(e) => updateItem(content.notices, i, { location: e.target.value }, 'notices')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={notice.type}
                      onChange={(e) => updateItem(content.notices, i, { type: e.target.value as 'event' | 'training' }, 'notices')}
                    >
                      <option value="event">Event</option>
                      <option value="training">Training</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea rows={3} value={notice.description} onChange={(e) => updateItem(content.notices, i, { description: e.target.value }, 'notices')} />
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={() => addItem(content.notices, { id: uid(), title: '', date: '', location: '', description: '', type: 'event' }, 'notices')}>
            <Plus className="h-4 w-4 mr-2" /> Add Notice
          </Button>
        </TabsContent>

        {/* Founder */}
        <TabsContent value="founder" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Founder Profile</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={content.founder.name} onChange={(e) => { const f = {...content.founder, name: e.target.value}; update('founder', f) }} />
                </div>
                <div className="space-y-2">
                  <Label>Title / Role</Label>
                  <Input value={content.founder.title} onChange={(e) => { const f = {...content.founder, title: e.target.value}; update('founder', f) }} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Bio / Story</Label>
                <Textarea rows={8} value={content.founder.bio} onChange={(e) => { const f = {...content.founder, bio: e.target.value}; update('founder', f) }} />
              </div>
              <div className="space-y-2">
                <Label>Quote</Label>
                <Textarea rows={2} value={content.founder.quote} onChange={(e) => { const f = {...content.founder, quote: e.target.value}; update('founder', f) }} />
              </div>
              <div className="space-y-2">
                <Label>Profile Image</Label>
                <FileUpload currentUrl={content.founder.image} accept="image/*" onUpload={(url) => { const f = {...content.founder, image: url}; update('founder', f) }} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Achievements</CardTitle>
              <Button variant="outline" size="sm" onClick={() => {
                const f = {...content.founder}
                f.achievements = [...f.achievements, { id: uid(), text: '', year: '' }]
                update('founder', f)
              }}>
                <Plus className="h-4 w-4 mr-2" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {content.founder.achievements.map((ach, i) => (
                <div key={ach.id} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 rounded-lg border border-border/60 p-3">
                  <div className="flex-1 space-y-2">
                    <Label className="text-xs">Achievement</Label>
                    <Input value={ach.text} onChange={(e) => {
                      const f = {...content.founder}
                      f.achievements = f.achievements.map((a, j) => j === i ? {...a, text: e.target.value} : a)
                      update('founder', f)
                    }} />
                  </div>
                  <div className="w-full sm:w-24 space-y-2">
                    <Label className="text-xs">Year</Label>
                    <Input value={ach.year} onChange={(e) => {
                      const f = {...content.founder}
                      f.achievements = f.achievements.map((a, j) => j === i ? {...a, year: e.target.value} : a)
                      update('founder', f)
                    }} />
                  </div>
                  <Button variant="ghost" size="icon" className="self-end sm:self-auto mb-0.5" onClick={() => {
                    const f = {...content.founder}
                    f.achievements = f.achievements.filter((_, j) => j !== i)
                    update('founder', f)
                  }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact */}
        <TabsContent value="contact" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Contact Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={content.contactEmail} onChange={(e) => update('contactEmail', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={content.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={content.contactAddress} onChange={(e) => update('contactAddress', e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Social Links</CardTitle>
              <Button variant="outline" size="sm" onClick={() => addItem(content.socials, { id: uid(), label: '', url: '' }, 'socials')}>
                <Plus className="h-4 w-4 mr-2" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {content.socials.map((s, i) => (
                <div key={s.id} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                  <div className="flex-1 space-y-2">
                    <Label>Label</Label>
                    <Input value={s.label} onChange={(e) => updateItem(content.socials, i, { label: e.target.value }, 'socials')} />
                  </div>
                  <div className="flex-[2] space-y-2">
                    <Label>URL</Label>
                    <Input value={s.url} onChange={(e) => updateItem(content.socials, i, { url: e.target.value }, 'socials')} />
                  </div>
                  <Button variant="ghost" size="icon" className="self-end sm:self-auto mb-0.5" onClick={() => removeItem(content.socials, i, 'socials')}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEO — feeds <title>, the meta description and the social share image */}
        <TabsContent value="seo" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Search & Social</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                These control how the site appears in Google results and when a link is
                shared. Leave any of them blank to fall back to the built-in default.
              </p>
              <div className="space-y-2">
                <Label>Page Title</Label>
                <Input
                  value={content.seoTitle || ''}
                  onChange={(e) => update('seoTitle', e.target.value)}
                  placeholder="Basnayaka Vermigrow — Organic Fertilizer & Vegetables, Karandeniya"
                />
                <p className="text-xs text-muted-foreground">
                  Keep it under about 60 characters, or Google truncates it.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Meta Description</Label>
                <Textarea
                  rows={4}
                  value={content.seoDescription || ''}
                  onChange={(e) => update('seoDescription', e.target.value)}
                  placeholder="A family-run organic farm in Karandeniya, Sri Lanka..."
                />
                <p className="text-xs text-muted-foreground">
                  Aim for roughly 150–160 characters. This is the grey text under the title.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Social Share Image</Label>
                <FileUpload
                  currentUrl={content.ogImage || ''}
                  onUpload={(url) => update('ogImage', url)}
                />
                <p className="text-xs text-muted-foreground">
                  Shown when the site is shared on Facebook or WhatsApp. A wide image
                  works best (about 1200×630). Also used as the logo in search results.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save All Content
        </Button>
      </div>
    </div>
  )
}
