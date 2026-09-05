'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 p-8 text-center">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try again
            </Button>
            <Button asChild size="sm">
              <Link href="/">
                <Home className="h-4 w-4 mr-2" />
                Go home
              </Link>
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
