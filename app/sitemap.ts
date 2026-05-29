import { MetadataRoute } from 'next'

const BASE_URL = 'https://www.maisuijoy.com'

/**
 * 站点地图 — 仅包含无需登录即可访问的公开页面。
 * 所有 (dashboard) 路由均受 Supabase Auth 保护，不纳入。
 * 自动生成 /sitemap.xml，可直接提交给 Google Search Console。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return [
    // ── 登录 / 注册 ── 主要入口，SEO 权重最高 ──────────────────
    {
      url:             `${BASE_URL}/login`,
      lastModified:    now,
      changeFrequency: 'monthly',
      priority:        0.9,
    },
    {
      url:             `${BASE_URL}/register`,
      lastModified:    now,
      changeFrequency: 'monthly',
      priority:        0.9,
    },

    // ── 邀请流程 ── middleware PUBLIC_EXCEPTIONS，无需登录可访问 ──
    // 权重较低：这类页面通常通过邀请链接到达，不依赖搜索流量
    {
      url:             `${BASE_URL}/fellowship/join`,
      lastModified:    now,
      changeFrequency: 'monthly',
      priority:        0.4,
    },
    {
      url:             `${BASE_URL}/fellowship/confirm-leader`,
      lastModified:    now,
      changeFrequency: 'monthly',
      priority:        0.3,
    },
    {
      url:             `${BASE_URL}/accountability/join`,
      lastModified:    now,
      changeFrequency: 'monthly',
      priority:        0.4,
    },
  ]
}
