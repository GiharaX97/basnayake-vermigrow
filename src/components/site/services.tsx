'use client'

import { Film, Camera, Palette, Sprout, Recycle, Leaf, Droplets, ShoppingBag, Star, type LucideIcon } from 'lucide-react'
import { useContentStore } from '@/store/content-store'
import { Button } from '@/components/ui/button'

const iconMap: Record<string, LucideIcon> = {
  Film,
  Camera,
  Palette,
  Sprout,
  Recycle,
  Leaf,
  Droplets,
}

export function Services() {
  const { content } = useContentStore()
  const products = Array.isArray(content.products) ? content.products : []
  return (
    <section id="products" className="py-20 md:py-28 bg-muted/30 border-y border-border/60 scroll-mt-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            What we sell
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Our products
          </h2>
          <p className="mt-4 text-base md:text-lg text-muted-foreground">
            From vermicompost to organic vegetables, every product is hand-turned, hand-graded and free of synthetic chemicals. <strong className="text-foreground">Free delivery within Karandeniya for orders over Rs 1,000.</strong>
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {products.map((product) => {
            const Icon = iconMap[product.icon] ?? Sprout
            return (
              <div
                key={product.id}
                className="group relative rounded-2xl border border-border/60 bg-card p-6 hover:border-emerald-500/40 hover:shadow-lg transition-all flex flex-col"
              >
                {product.featured && (
                  <span className="absolute -top-2.5 right-4 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-semibold shadow-md">
                    <Star className="h-3 w-3 fill-current" />
                    Best seller
                  </span>
                )}
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors shrink-0">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{product.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">
                  {product.description}
                </p>
                {/* Price */}
                {product.price && (
                  <div className="mt-5 pt-4 border-t border-border/40">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-foreground">{product.price}</span>
                      {product.unit && (
                        <span className="text-sm text-muted-foreground">{product.unit}</span>
                      )}
                    </div>
                  </div>
                )}
                <Button
                  size="sm"
                  className="mt-4 w-full rounded-full bg-emerald-500 hover:bg-emerald-600 text-white gap-2"
                  asChild
                >
                  <a href={`#contact?product=${encodeURIComponent(product.title)}`}>
                    <ShoppingBag className="h-4 w-4" />
                    Order now
                  </a>
                </Button>
              </div>
            )
          })}
        </div>

        {/* Wholesale CTA */}
        <div className="mt-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-8 md:p-10 text-white text-center md:text-left md:flex items-center justify-between gap-8">
          <div>
            <h3 className="text-xl md:text-2xl font-bold">Need wholesale quantities?</h3>
            <p className="mt-2 text-emerald-100 text-sm md:text-base max-w-lg">
              We supply bulk vermicompost, custom blends and organic vegetables to commercial farms,
              nurseries and retail outlets across Southern Province.
            </p>
          </div>
          <Button
            size="lg"
            variant="secondary"
            className="mt-4 md:mt-0 rounded-full shrink-0 bg-white text-emerald-800 hover:bg-emerald-50"
            asChild
          >
            <a href="#contact">Get wholesale pricing</a>
          </Button>
        </div>
      </div>
    </section>
  )
}
