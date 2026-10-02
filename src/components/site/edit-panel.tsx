'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react'
import { useContentStore, defaultContent } from '@/store/content-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

interface SectionProps {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}

function Section({ title, defaultOpen = false, children }: SectionProps) {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <div className="border-b border-border/60">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <span className="text-sm font-semibold">{title}</span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5 pt-1 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function EditPanel() {
  const { editMode, content, updateField, setContent, resetContent, toggleEditMode } =
    useContentStore()
  const [showResetConfirm, setShowResetConfirm] = React.useState(false)

  // Helpers for list operations
  const updateListItem = <K extends keyof typeof content>(
    key: K,
    id: string,
    patch: Partial<(typeof content)[K] extends Array<infer T> ? T : never>
  ) => {
    const list = content[key] as unknown as Array<{ id: string }>
    const next = list.map((item) =>
      item.id === id ? { ...item, ...patch } : item
    ) as unknown as (typeof content)[K]
    updateField(key, next)
  }

  const removeListItem = (key: keyof typeof content, id: string) => {
    const list = content[key] as unknown as Array<{ id: string }>
    const next = list.filter((item) => item.id !== id)
    updateField(key, next as any)
  }

  const addListItem = (key: keyof typeof content, item: { id: string }) => {
    const list = content[key] as unknown as Array<{ id: string }>
    const next = [...list, item]
    updateField(key, next as any)
  }

  const genId = () => Math.random().toString(36).slice(2, 10)

  const onReset = () => {
    resetContent()
    toast.success('Content reset to defaults')
    setShowResetConfirm(false)
  }

  const onExport = () => {
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'makefarm-content.json'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Content exported')
  }

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string)
        setContent({ ...defaultContent, ...parsed })
        toast.success('Content imported')
      } catch {
        toast.error('Invalid JSON file')
      }
    }
    reader.readAsText(file)
  }

  return (
    <AnimatePresence>
      {editMode && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleEditMode}
            className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed top-0 right-0 bottom-0 z-[80] w-full sm:w-[440px] bg-background border-l border-border flex flex-col"
            role="dialog"
            aria-label="Edit content panel"
          >
            <div className="flex items-center justify-between px-4 h-14 border-b border-border">
              <div>
                <div className="text-sm font-semibold">Edit mode</div>
                <div className="text-xs text-muted-foreground">Changes save automatically</div>
              </div>
              <Button variant="ghost" size="icon" aria-label="Close" onClick={toggleEditMode}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <ScrollArea className="flex-1">
              {/* Brand */}
              <Section title="Brand & contact" defaultOpen>
                <div>
                  <Label className="text-xs">Brand name</Label>
                  <Input
                    value={content.brand}
                    onChange={(e) => updateField('brand', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Tagline</Label>
                  <Input
                    value={content.tagline}
                    onChange={(e) => updateField('tagline', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Contact email</Label>
                  <Input
                    value={content.contactEmail}
                    onChange={(e) => updateField('contactEmail', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Contact phone</Label>
                  <Input
                    value={content.contactPhone}
                    onChange={(e) => updateField('contactPhone', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Contact address</Label>
                  <Input
                    value={content.contactAddress}
                    onChange={(e) => updateField('contactAddress', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </Section>

              {/* Hero slides */}
              <Section title={`Hero slides (${content.heroSlides.length})`}>
                {content.heroSlides.map((slide, i) => (
                  <div key={slide.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Slide {i + 1}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeListItem('heroSlides', slide.id)}
                        aria-label="Remove slide"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={slide.type}
                        onValueChange={(v) =>
                          updateListItem('heroSlides', slide.id, { type: v as 'video' | 'image' })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="image">Image</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">{slide.type === 'video' ? 'Video URL' : 'Image URL'}</Label>
                      <Input
                        value={slide.src}
                        onChange={(e) =>
                          updateListItem('heroSlides', slide.id, { src: e.target.value })
                        }
                        className="mt-1 font-mono text-xs"
                      />
                    </div>
                    {slide.type === 'video' && (
                      <div>
                        <Label className="text-xs">Poster image URL</Label>
                        <Input
                          value={slide.poster || ''}
                          onChange={(e) =>
                            updateListItem('heroSlides', slide.id, { poster: e.target.value })
                          }
                          className="mt-1 font-mono text-xs"
                        />
                      </div>
                    )}
                    <div>
                      <Label className="text-xs">Title</Label>
                      <Input
                        value={slide.title || ''}
                        onChange={(e) =>
                          updateListItem('heroSlides', slide.id, { title: e.target.value })
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Subtitle</Label>
                      <Input
                        value={slide.subtitle || ''}
                        onChange={(e) =>
                          updateListItem('heroSlides', slide.id, { subtitle: e.target.value })
                        }
                        className="mt-1"
                      />
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    addListItem('heroSlides', {
                      id: genId(),
                      type: 'image',
                      // The farm's own photograph, not a stock one. A new item
                      // used to arrive pre-filled with an Unsplash image, which
                      // meant the first thing an admin ever saw was somebody
                      // else's field — and publishing without touching it would
                      // have put a stock photo on the live site.
                      src: '/images/farm-hero.jpg',
                      title: 'New slide',
                      subtitle: 'Describe this slide',
                    } as never)
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Add slide
                </Button>
              </Section>

              {/* About */}
              <Section title="About section">
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input
                    value={content.aboutTitle}
                    onChange={(e) => updateField('aboutTitle', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Body text</Label>
                  <Textarea
                    value={content.aboutBody}
                    onChange={(e) => updateField('aboutBody', e.target.value)}
                    rows={6}
                    className="mt-1 resize-none"
                  />
                </div>
                <div>
                  <Label className="text-xs">Image URL</Label>
                  <Input
                    value={content.aboutImage}
                    onChange={(e) => updateField('aboutImage', e.target.value)}
                    className="mt-1 font-mono text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Mission</Label>
                  <Textarea
                    value={content.mission}
                    onChange={(e) => updateField('mission', e.target.value)}
                    rows={3}
                    className="mt-1 resize-none"
                  />
                </div>
                <div>
                  <Label className="text-xs">Vision</Label>
                  <Textarea
                    value={content.vision}
                    onChange={(e) => updateField('vision', e.target.value)}
                    rows={3}
                    className="mt-1 resize-none"
                  />
                </div>
              </Section>

              {/* Stats */}
              <Section title={`Stats (${content.stats.length})`}>
                {content.stats.map((stat) => (
                  <div key={stat.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{stat.label}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeListItem('stats', stat.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Input
                      value={stat.value}
                      onChange={(e) =>
                        updateListItem('stats', stat.id, { value: e.target.value })
                      }
                      placeholder="Value (e.g. 200+)"
                    />
                    <Input
                      value={stat.label}
                      onChange={(e) =>
                        updateListItem('stats', stat.id, { label: e.target.value })
                      }
                      placeholder="Label"
                    />
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    addListItem('stats', { id: genId(), value: '0', label: 'New stat' } as never)
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Add stat
                </Button>
              </Section>

              {/* Products */}
              <Section title={`Products (${(content.products ?? []).length})`}>
                {(content.products ?? []).map((product) => (
                  <div key={product.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{product.title}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeListItem('products', product.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs">Icon</Label>
                      <Select
                        value={product.icon}
                        onValueChange={(v) =>
                          updateListItem('products', product.id, { icon: v })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sprout">Sprout</SelectItem>
                          <SelectItem value="Recycle">Recycle</SelectItem>
                          <SelectItem value="Leaf">Leaf</SelectItem>
                          <SelectItem value="Droplets">Droplets</SelectItem>
                          <SelectItem value="Film">Film</SelectItem>
                          <SelectItem value="Camera">Camera</SelectItem>
                          <SelectItem value="Palette">Palette</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      value={product.title}
                      onChange={(e) =>
                        updateListItem('products', product.id, { title: e.target.value })
                      }
                      placeholder="Title"
                    />
                    <Textarea
                      value={product.description}
                      onChange={(e) =>
                        updateListItem('products', product.id, { description: e.target.value })
                      }
                      rows={3}
                      className="resize-none"
                      placeholder="Description"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Price (e.g. Rs 350)</Label>
                        <Input
                          value={product.price}
                          onChange={(e) =>
                            updateListItem('products', product.id, { price: e.target.value })
                          }
                          className="mt-1"
                          placeholder="Rs 350"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Unit (e.g. per kg)</Label>
                        <Input
                          value={product.unit}
                          onChange={(e) =>
                            updateListItem('products', product.id, { unit: e.target.value })
                          }
                          className="mt-1"
                          placeholder="per kg"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={product.featured}
                        onChange={(e) =>
                          updateListItem('products', product.id, { featured: e.target.checked })
                        }
                        className="rounded border-border"
                      />
                      Featured / Best seller
                    </label>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    addListItem('products', {
                      id: genId(),
                      icon: 'Sprout',
                      title: 'New product',
                      description: 'Describe this product',
                      price: '',
                      unit: '',
                      featured: false,
                    } as never)
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Add product
                </Button>
              </Section>

              {/* Photos */}
              <Section title={`Photos (${content.photos.length})`}>
                {content.photos.map((photo) => (
                  <div key={photo.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold truncate">{photo.caption}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeListItem('photos', photo.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Input
                      value={photo.src}
                      onChange={(e) =>
                        updateListItem('photos', photo.id, { src: e.target.value })
                      }
                      className="font-mono text-xs"
                      placeholder="Image URL"
                    />
                    <Input
                      value={photo.caption}
                      onChange={(e) =>
                        updateListItem('photos', photo.id, { caption: e.target.value })
                      }
                      placeholder="Caption"
                    />
                    <Input
                      value={photo.category}
                      onChange={(e) =>
                        updateListItem('photos', photo.id, { category: e.target.value })
                      }
                      placeholder="Category"
                    />
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    addListItem('photos', {
                      id: genId(),
                      src: '/images/farm-about.jpg',
                      caption: 'New photo',
                      category: 'Field',
                    } as never)
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Add photo
                </Button>
              </Section>

              {/* Event Photos */}
              <Section title={`Event photos (${(content.eventPhotos ?? []).length})`}>
                {(content.eventPhotos ?? []).map((photo) => (
                  <div key={photo.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold truncate">{photo.caption}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeListItem('eventPhotos', photo.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Input
                      value={photo.src}
                      onChange={(e) => updateListItem('eventPhotos', photo.id, { src: e.target.value })}
                      className="font-mono text-xs"
                      placeholder="Image URL"
                    />
                    <Input
                      value={photo.caption}
                      onChange={(e) => updateListItem('eventPhotos', photo.id, { caption: e.target.value })}
                      placeholder="Caption"
                    />
                    <Input
                      value={photo.category}
                      onChange={(e) => updateListItem('eventPhotos', photo.id, { category: e.target.value })}
                      placeholder="Category"
                    />
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    addListItem('eventPhotos', {
                      id: genId(),
                      src: '/images/training-day.jpg',
                      caption: 'New event photo',
                      category: 'Event',
                    } as never)
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Add event photo
                </Button>
              </Section>

              {/* Training Photos */}
              <Section title={`Training photos (${(content.trainingPhotos ?? []).length})`}>
                {(content.trainingPhotos ?? []).map((photo) => (
                  <div key={photo.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold truncate">{photo.caption}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeListItem('trainingPhotos', photo.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Input
                      value={photo.src}
                      onChange={(e) => updateListItem('trainingPhotos', photo.id, { src: e.target.value })}
                      className="font-mono text-xs"
                      placeholder="Image URL"
                    />
                    <Input
                      value={photo.caption}
                      onChange={(e) => updateListItem('trainingPhotos', photo.id, { caption: e.target.value })}
                      placeholder="Caption"
                    />
                    <Input
                      value={photo.category}
                      onChange={(e) => updateListItem('trainingPhotos', photo.id, { category: e.target.value })}
                      placeholder="Category"
                    />
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    addListItem('trainingPhotos', {
                      id: genId(),
                      src: '/images/training-day.jpg',
                      caption: 'New training photo',
                      category: 'Training',
                    } as never)
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Add training photo
                </Button>
              </Section>

              {/* Training Videos */}
              <Section title={`Training videos (${(content.trainingVideos ?? []).length})`}>
                {(content.trainingVideos ?? []).map((video) => (
                  <div key={video.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{video.title}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeListItem('trainingVideos', video.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Input
                      value={video.src}
                      onChange={(e) => updateListItem('trainingVideos', video.id, { src: e.target.value })}
                      className="font-mono text-xs"
                      placeholder="Video URL (.mp4)"
                    />
                    <Input
                      value={video.poster}
                      onChange={(e) => updateListItem('trainingVideos', video.id, { poster: e.target.value })}
                      className="font-mono text-xs"
                      placeholder="Poster image URL"
                    />
                    <Input
                      value={video.title}
                      onChange={(e) => updateListItem('trainingVideos', video.id, { title: e.target.value })}
                      placeholder="Title"
                    />
                    <Textarea
                      value={video.description}
                      onChange={(e) => updateListItem('trainingVideos', video.id, { description: e.target.value })}
                      rows={2}
                      className="resize-none"
                      placeholder="Description"
                    />
                    <Input
                      value={video.duration}
                      onChange={(e) => updateListItem('trainingVideos', video.id, { duration: e.target.value })}
                      placeholder="Duration (e.g. 15:30)"
                    />
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    addListItem('trainingVideos', {
                      id: genId(),
                      // Empty src on purpose: there is no farm footage yet, and
                      // the demo clip this used to pre-fill was Google's, not
                      // ours. The showcase hides entries with no source, so this
                      // stays invisible until a real file is chosen.
                      src: '',
                      poster: '/images/training-day.jpg',
                      title: 'New training video',
                      description: 'Describe this training video',
                      duration: '0:00',
                    } as never)
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Add training video
                </Button>
              </Section>

              {/* Notices */}
              <Section title={`Notices (${(content.notices ?? []).length})`}>
                {(content.notices ?? []).map((notice) => (
                  <div key={notice.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold truncate">{notice.title}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeListItem('notices', notice.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={notice.type}
                        onValueChange={(v) =>
                          updateListItem('notices', notice.id, { type: v as 'event' | 'training' })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="event">Event</SelectItem>
                          <SelectItem value="training">Training</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      value={notice.title}
                      onChange={(e) => updateListItem('notices', notice.id, { title: e.target.value })}
                      placeholder="Title"
                    />
                    <Input
                      value={notice.date}
                      onChange={(e) => updateListItem('notices', notice.id, { date: e.target.value })}
                      placeholder="Date (e.g. 2025-08-15)"
                    />
                    <Input
                      value={notice.location}
                      onChange={(e) => updateListItem('notices', notice.id, { location: e.target.value })}
                      placeholder="Location"
                    />
                    <Textarea
                      value={notice.description}
                      onChange={(e) => updateListItem('notices', notice.id, { description: e.target.value })}
                      rows={3}
                      className="resize-none"
                      placeholder="Description"
                    />
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    addListItem('notices', {
                      id: genId(),
                      title: 'New notice',
                      date: '',
                      location: '',
                      description: '',
                      type: 'event',
                    } as never)
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Add notice
                </Button>
              </Section>

              {/* Videos */}
              <Section title={`Videos (${content.videos.length})`}>
                {content.videos.map((video) => (
                  <div key={video.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{video.title}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeListItem('videos', video.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Input
                      value={video.src}
                      onChange={(e) =>
                        updateListItem('videos', video.id, { src: e.target.value })
                      }
                      className="font-mono text-xs"
                      placeholder="Video URL (.mp4)"
                    />
                    <Input
                      value={video.poster}
                      onChange={(e) =>
                        updateListItem('videos', video.id, { poster: e.target.value })
                      }
                      className="font-mono text-xs"
                      placeholder="Poster image URL"
                    />
                    <Input
                      value={video.title}
                      onChange={(e) =>
                        updateListItem('videos', video.id, { title: e.target.value })
                      }
                      placeholder="Title"
                    />
                    <Textarea
                      value={video.description}
                      onChange={(e) =>
                        updateListItem('videos', video.id, { description: e.target.value })
                      }
                      rows={2}
                      className="resize-none"
                      placeholder="Description"
                    />
                    <Input
                      value={video.duration}
                      onChange={(e) =>
                        updateListItem('videos', video.id, { duration: e.target.value })
                      }
                      placeholder="Duration (e.g. 2:18)"
                    />
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    addListItem('videos', {
                      id: genId(),
                      // See the note on the training-video seed above.
                      src: '',
                      poster: '/images/farm-hero.jpg',
                      title: 'New video',
                      description: 'Describe this video',
                      duration: '0:00',
                    } as never)
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Add video
                </Button>
              </Section>

              {/* Projects */}
              <Section title={`Projects / sub-brands (${content.projects.length})`}>
                {content.projects.map((project) => (
                  <div key={project.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{project.title}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeListItem('projects', project.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs">Logo URL (optional)</Label>
                      <Input
                        value={project.logo || ''}
                        onChange={(e) =>
                          updateListItem('projects', project.id, { logo: e.target.value })
                        }
                        className="mt-1 font-mono text-xs"
                        placeholder="/logos/logo-project-x.png or full URL"
                      />
                    </div>
                    <Input
                      value={project.image}
                      onChange={(e) =>
                        updateListItem('projects', project.id, { image: e.target.value })
                      }
                      className="font-mono text-xs"
                      placeholder="Cover image URL"
                    />
                    <Input
                      value={project.title}
                      onChange={(e) =>
                        updateListItem('projects', project.id, { title: e.target.value })
                      }
                      placeholder="Title"
                    />
                    <Input
                      value={project.category}
                      onChange={(e) =>
                        updateListItem('projects', project.id, { category: e.target.value })
                      }
                      placeholder="Category"
                    />
                    <Input
                      value={project.year}
                      onChange={(e) =>
                        updateListItem('projects', project.id, { year: e.target.value })
                      }
                      placeholder="Year"
                    />
                    <Textarea
                      value={project.description || ''}
                      onChange={(e) =>
                        updateListItem('projects', project.id, { description: e.target.value })
                      }
                      rows={3}
                      className="resize-none"
                      placeholder="Description"
                    />
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    addListItem('projects', {
                      id: genId(),
                      logo: '',
                      image: '/images/farm-about.jpg',
                      title: 'New project',
                      category: 'Category',
                      year: '2025',
                      description: '',
                    } as never)
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Add project
                </Button>
              </Section>

              {/* Backup & restore */}
              <Section title="Backup & restore">
                <Button variant="outline" size="sm" className="w-full" onClick={onExport}>
                  Export content as JSON
                </Button>
                <label className="block">
                  <span className="sr-only">Import content</span>
                  <input
                    type="file"
                    accept="application/json"
                    onChange={onImport}
                    className="block w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer"
                  />
                </label>
                <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-destructive hover:text-destructive"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" /> Reset to defaults
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset all content?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently replace all current content with the factory defaults.
                        This action cannot be undone. Export your current content first if you want to keep a backup.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={onReset}
                      >
                        Reset
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </Section>

              <div className="h-10" />
            </ScrollArea>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
