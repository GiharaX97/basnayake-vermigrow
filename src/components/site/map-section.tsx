'use client'

import * as React from 'react'
import { MapPin, Phone, X } from 'lucide-react'
import { useContentStore } from '@/store/content-store'
import type { MapLocation } from '@/store/content-store'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export function MapSection() {
  const { content } = useContentStore()
  const [selected, setSelected] = React.useState<MapLocation | null>(null)
  const mapRef = React.useRef<HTMLDivElement>(null)
  const mapInstanceRef = React.useRef<any>(null)
  const markersRef = React.useRef<any[]>([])

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const container = mapRef.current

    // Wheel-zoom is OFF until the visitor deliberately clicks/taps the map, so
    // scrolling the page is never hijacked while the cursor is over the map.
    // Arming is revoked as soon as the pointer leaves the map (or clicks outside).
    const armWheelZoom = () => {
      const map = mapInstanceRef.current
      if (map) map.scrollWheelZoom.enable()
    }
    const disarmWheelZoom = () => {
      const map = mapInstanceRef.current
      if (map) map.scrollWheelZoom.disable()
    }
    const onDocPointerDown = (e: Event) => {
      const target = e.target as Node | null
      if (container && target && !container.contains(target)) disarmWheelZoom()
    }

    container?.addEventListener('mouseleave', disarmWheelZoom)
    document.addEventListener('pointerdown', onDocPointerDown)

    const initMap = async () => {
      const L = await import('leaflet')
      await import('leaflet/dist/leaflet.css')

      if (mapInstanceRef.current) return

      const map = L.map(container!, {
        center: [7.5, 80.7],
        zoom: 8,
        scrollWheelZoom: false,
      })

      map.on('click', armWheelZoom)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map)

      const icon = L.divIcon({
        className: 'custom-marker',
        html: '<div style="background:#059669;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:16px;">📍</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -36],
      })

      content.mapLocations.forEach((loc) => {
        const marker = L.marker([loc.lat, loc.lng], { icon }).addTo(map)

        let popupHtml = `
          <div style="min-width:220px;font-family:system-ui,sans-serif;">
            <h3 style="margin:0 0 6px;font-size:16px;font-weight:700;color:#059669;">${loc.title}</h3>
            <p style="margin:0 0 4px;font-size:13px;color:#555;"><strong>Contact:</strong> ${loc.contactNo}</p>
            <p style="margin:0 0 8px;font-size:13px;color:#555;line-height:1.4;">${loc.description}</p>
        `

        if (loc.photos && loc.photos.length > 0) {
          popupHtml += `<div style="display:flex;gap:4px;overflow-x:auto;padding-bottom:4px;">`
          loc.photos.forEach((photo) => {
            popupHtml += `<img src="${photo}" style="width:80px;height:60px;object-fit:cover;border-radius:4px;flex-shrink:0;" />`
          })
          popupHtml += `</div>`
        }

        popupHtml += `</div>`

        marker.bindPopup(popupHtml)
      })

      mapInstanceRef.current = map
    }

    initMap()

    return () => {
      container?.removeEventListener('mouseleave', disarmWheelZoom)
      document.removeEventListener('pointerdown', onDocPointerDown)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [content.mapLocations])

  return (
    <section id="map" className="py-20 md:py-28 bg-muted/30 border-y border-border/60 scroll-mt-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Basnayaka VermiCompost Project
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Our farm locations
          </h2>
          <p className="mt-4 text-base md:text-lg text-muted-foreground">
            Click a marker to see contact details and photos of each project location across Sri Lanka.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* relative z-0 traps Leaflet's internal panes (z-index up to 1000) inside this
            stacking context so the map can never paint over the fixed ticker/navbar above. */}
        <div ref={mapRef} className="relative z-0 w-full h-[500px] rounded-2xl overflow-hidden border border-border/60 shadow-lg" />
      </div>
    </section>
  )
}
