import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow:  ['/', '/login', '/register', '/fellowship/join', '/church/join'],
        disallow: [
          '/daily',
          '/fellowship/console',
          '/fellowship/create',
          '/fellowship/confirm-leader',
          '/growth',
          '/accountability',
          '/settings',
          '/church/hub',
          '/admin',
          '/api/',
          '/p/',
        ],
      },
    ],
    sitemap: 'https://www.maisuijoy.com/sitemap.xml',
  }
}
