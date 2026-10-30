/**
 * CSS imported for its side effects (Leaflet's stylesheet is loaded on demand in
 * src/components/site/map-section.tsx). Next used to carry this declaration in
 * its own global types; 16.4.x no longer does, so `tsc` — and therefore `next
 * build` — failed on `import('leaflet/dist/leaflet.css')`.
 */
declare module '*.css'
