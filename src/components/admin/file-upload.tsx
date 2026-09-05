'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, Loader2, X, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface FileUploadProps {
  onUpload: (url: string) => void
  accept?: string
  currentUrl?: string
}

export function FileUpload({ onUpload, accept = 'image/*', currentUrl }: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(currentUrl || '')
  const [error, setError] = useState('')

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.url) {
        setPreview(data.url)
        onUpload(data.url)
        toast.success('File uploaded')
      } else {
        setError(data.error || 'Upload failed')
        toast.error(data.error || 'Upload failed')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed — connection error'
      setError(msg)
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      {preview && accept === 'image/*' && !error && (
        <div className="relative w-32 h-24 rounded-md overflow-hidden border">
          <img src={preview} alt="" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => { setPreview(''); onUpload(''); setError('') }}
            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
            aria-label="Remove"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-md p-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept={accept}
          onChange={handleFile}
          disabled={uploading}
          className="flex-1"
        />
        {uploading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
      </div>
      {preview && !preview.startsWith('/uploads') && !preview.startsWith('http') && (
        <p className="text-xs text-muted-foreground truncate">{preview}</p>
      )}
      <Input
        type="url"
        value={preview}
        onChange={(e) => { setPreview(e.target.value); onUpload(e.target.value); setError('') }}
        placeholder="Or paste image URL..."
        className="text-sm"
      />
    </div>
  )
}
