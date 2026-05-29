import { MetadataRoute } from 'next'

const BASE_URL = 'https://www.maisuijoy.com'

/**
 * robots.txt — 自动生成 /robots.txt。
 * 允许爬取公开页面；明确禁止爬取所有受保护的后台和用户私有路由。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/login',
          '/register',
          '/fellowship/join',
          '/fellowship/confirm-leader',
          '/accountability/join',
        ],
        disallow: [
          '/daily',
          '/fellowship/create',
          '/fellowship/console',
          '/accountability/',
          '/growth',
          '/settings',
          '/church/',
          '/admin/',
          '/api/',
          '/p/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
