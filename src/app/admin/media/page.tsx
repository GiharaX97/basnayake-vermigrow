'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { format } from 'date-fns'
import {
  Image,
  Film,
  File,
  Trash2,
  Copy,
  Loader2,
  Upload,
  RefreshCw,
  Search,
} from 'lucide-react'

interface MediaItem {
  filename: string
  url: string
  size: number
  createdAt: string
  type: 'image' | 'video' | 'other'
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function MediaLibraryPage() {
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [deleteFile, setDeleteFile] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/media')
      if (res.ok) setItems(await res.json())
    } catch {
      toast.error('Failed to load media')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.url) {
        toast.success('Uploaded!')
        load()
      } else {
        toast.error(data.error || 'Upload failed')
      }
    } catch {
      toast.error('Upload failed — connection error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const remove = async (filename: string) => {
    const res = await fetch('/api/media', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    })
    if (res.ok) {
      toast.success('File deleted')
      load()
    } else {
      toast.error('Failed to delete')
    }
    setDeleteFile(null)
  }

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(window.location.origin + url)
    toast.success('URL copied')
  }

  const filtered = items.filter((item) =>
    item.filename.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Media Library</h1>
          <p className="text-muted-foreground mt-1">
            Uploaded images and videos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <label className="cursor-pointer">
            <Button variant="default" size="sm" disabled={uploading} asChild>
              <span>
                {uploading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                Upload
              </span>
            </Button>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search files..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 max-w-sm"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          {search ? (
            <>
              <Search className="h-12 w-12 mb-3" />
              <p>No files matching &ldquo;{search}&rdquo;</p>
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 mb-3" />
              <p>No uploaded files yet</p>
            </>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((item) => (
            <Card key={item.filename} className="group overflow-hidden">
              <div className="aspect-square relative bg-muted">
                {item.type === 'image' ? (
                  <img
                    src={item.url}
                    alt={item.filename}
                    className="w-full h-full object-cover"
                  />
                ) : item.type === 'video' ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="h-10 w-10 text-muted-foreground" />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <File className="h-10 w-10 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/20"
                    onClick={() => copyUrl(item.url)}
                    title="Copy URL"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <AlertDialog open={deleteFile === item.filename} onOpenChange={(o) => !o && setDeleteFile(null)}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/20"
                        onClick={() => setDeleteFile(item.filename)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete file?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Permanently delete <strong>{item.filename}</strong>?
                          This action cannot be undone. If this file is used anywhere on the site,
                          it will break those references.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => remove(item.filename)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                {item.type === 'image' && (
                  <div className="absolute top-1 left-1">
                    <Image className="h-3.5 w-3.5 text-white drop-shadow" />
                  </div>
                )}
                {item.type === 'video' && (
                  <div className="absolute top-1 left-1">
                    <Film className="h-3.5 w-3.5 text-white drop-shadow" />
                  </div>
                )}
              </div>
              <div className="p-2 space-y-0.5">
                <p className="text-xs truncate font-medium" title={item.filename}>
                  {item.filename}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(item.size)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
