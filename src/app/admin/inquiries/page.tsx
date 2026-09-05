'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  Mail,
  Trash2,
  CheckCheck,
  Loader2,
  MessageSquare,
  Inbox,
} from 'lucide-react'

interface Inquiry {
  id: string
  name: string
  email: string
  message: string
  status: string
  createdAt: string
  readAt: string | null
}

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Inquiry | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = async () => {
    try {
      const res = await fetch('/api/inquiries')
      if (res.ok) setInquiries(await res.json())
    } catch {
      toast.error('Failed to load inquiries')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const markRead = async (id: string) => {
    await fetch(`/api/inquiries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'read' }),
    })
    load()
  }

  const remove = async (id: string) => {
    const res = await fetch(`/api/inquiries/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Inquiry deleted')
      if (selected?.id === id) setSelected(null)
      load()
    } else {
      toast.error('Failed to delete')
    }
    setDeleteId(null)
  }

  const unread = inquiries.filter((i) => i.status === 'unread').length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inquiries</h1>
          <p className="text-muted-foreground mt-1">
            Contact form submissions
          </p>
        </div>
        <Badge variant="outline" className="text-base px-4 py-1">
          <Inbox className="h-4 w-4 mr-2" />
          {unread} unread
        </Badge>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 max-lg:flex max-lg:flex-col-reverse">
        <div className="space-y-2">
          {inquiries.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-3" />
                <p>No inquiries yet</p>
              </CardContent>
            </Card>
          )}
          {inquiries.map((inq) => (
            <Card
              key={inq.id}
              className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                selected?.id === inq.id ? 'ring-2 ring-primary' : ''
              } ${inq.status === 'unread' ? 'border-l-4 border-l-emerald-500' : ''}`}
              onClick={() => setSelected(inq)}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                      inq.status === 'unread' ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-600' : 'bg-muted'
                    }`}>
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{inq.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{inq.email}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(inq.createdAt), 'MMM d, h:mm a')}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-1">
                <p className="text-sm text-muted-foreground line-clamp-2">{inq.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div>
          {selected ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selected.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{selected.email}</p>
                  </div>
                  <div className="flex gap-1">
                    {selected.status === 'unread' && (
                      <Button variant="outline" size="sm" onClick={() => markRead(selected.id)}>
                        <CheckCheck className="h-4 w-4 mr-1" /> Mark read
                      </Button>
                    )}
                    <AlertDialog open={deleteId === selected.id} onOpenChange={(o) => !o && setDeleteId(null)}>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(selected.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete inquiry?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the inquiry from {selected.name} ({selected.email}).
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => remove(selected.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(selected.createdAt), 'MMMM d, yyyy h:mm a')}
                  {selected.readAt && ` · Read ${format(new Date(selected.readAt), 'MMM d, h:mm a')}`}
                </p>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted p-4 whitespace-pre-wrap text-sm">
                  {selected.message}
                </div>
                <div className="mt-4">
                  <a
                    href={`mailto:${selected.email}?subject=Re: Basnayaka VermiGrow inquiry`}
                    className="text-sm text-emerald-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Reply via email &rarr;
                  </a>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-3" />
                <p>Select an inquiry to read</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
