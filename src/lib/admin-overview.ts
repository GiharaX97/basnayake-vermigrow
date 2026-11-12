import { readdir } from 'fs/promises'
import { prisma } from './prisma'
import { readSiteContent } from './content-service'
import { getAdminNotifications, type AdminNotificationSummary } from './admin-notifications'
import { uploadsDir } from './uploads'

/**
 * Everything the admin dashboard paints, in one server-side pass.
 *
 * The dashboard used to make three browser requests (`/api/content`,
 * `/api/inquiries`, `/api/media`) and could not show a number until all three
 * had returned — and `/api/content` shipped the entire CMS blob just so the
 * page could call `.length` on three arrays. This returns only the figures the
 * page uses, and is shared by:
 *
 *   - the server-rendered /admin page (no client round-trip at all), and
 *   - `GET /api/admin/overview` (the same data as JSON, for checking it).
 *
 * Every query is independent and issued in parallel. Nothing here is cached:
 * "pending donations: 1" must mean one right now.
 */

export interface AdminOverview {
  stats: {
    productsCount: number
    featuredCount: number
    mediaCount: number
    projectsCount: number
    photosCount: number
    videosCount: number
    unreadInquiries: number
    totalInquiries: number
  }
  recentInquiries: Array<{ id: string; name: string; email: string; createdAt: string }>
  notifications: AdminNotificationSummary
}

async function countMediaFiles(): Promise<number> {
  try {
    return (await readdir(uploadsDir())).length
  } catch {
    // A missing uploads dir is "zero files", not a dashboard failure.
    return 0
  }
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const [content, inquiryGroups, recentInquiries, mediaCount, notifications] =
    await Promise.all([
      readSiteContent(),
      prisma.inquiry.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.inquiry.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, email: true, createdAt: true },
      }),
      countMediaFiles(),
      getAdminNotifications(),
    ])

  const totalInquiries = inquiryGroups.reduce((sum, group) => sum + group._count._all, 0)
  const unreadInquiries =
    inquiryGroups.find((group) => group.status === 'unread')?._count._all ?? 0

  return {
    stats: {
      productsCount: content.products.length,
      featuredCount: content.products.filter((product) => product.featured).length,
      mediaCount,
      projectsCount: content.projects.length,
      photosCount: content.photos.length,
      videosCount: content.videos.length,
      unreadInquiries,
      totalInquiries,
    },
    recentInquiries: recentInquiries.map((inquiry) => ({
      ...inquiry,
      createdAt: inquiry.createdAt.toISOString(),
    })),
    notifications,
  }
}
