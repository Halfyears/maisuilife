import { MetadataRoute } from 'next'

const BASE_URL = 'https://www.maisuijoy.com'

/**
 * robots.txt — 自动生成 /robots.txt。
 * 默认允许所有路径（Allow: /），再用 Disallow 逐一屏蔽受保护路由。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin/',
        '/church/',
        '/daily',
        '/growth',
        '/settings',
        '/fellowship/create',
        '/fellowship/console',
        '/accountability/create',
        '/p/',
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
