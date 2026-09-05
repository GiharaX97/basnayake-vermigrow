'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { Save, Loader2, Shield } from 'lucide-react'

export default function AdminSettings() {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPw !== confirmPw) {
      setError('Passwords do not match')
      return
    }
    if (newPw.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      if (res.ok) {
        toast.success('Password updated')
        setCurrentPw('')
        setNewPw('')
        setConfirmPw('')
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to update password')
      }
    } catch {
      setError('Connection error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage admin settings</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
              <Shield className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <CardTitle>Change Admin Password</CardTitle>
              <CardDescription>
                Update the password used to access the admin panel
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="current">Current Password</Label>
              <Input
                id="current"
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">New Password</Label>
              <Input
                id="new"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm New Password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Database</CardTitle>
          <CardDescription>Content is stored in the local SQLite database via Prisma</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            All website content (hero, about, services, gallery, projects, contact) is
            saved in the <code className="bg-muted px-1 rounded">custom.db</code> SQLite file
            in the <code className="bg-muted px-1 rounded">db/</code> directory.
            No additional database setup is needed — Prisma manages it automatically.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
