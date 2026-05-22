import { MetadataRoute } from 'next'

const BASE_URL = 'https://www.maisuijoy.com'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url:             BASE_URL,
      lastModified:    new Date(),
      changeFrequency: 'daily',
      priority:        1.0,
    },
    {
      url:             `${BASE_URL}/login`,
      lastModified:    new Date(),
      changeFrequency: 'monthly',
      priority:        0.8,
    },
    {
      url:             `${BASE_URL}/register`,
      lastModified:    new Date(),
      changeFrequency: 'monthly',
      priority:        0.8,
    },
    {
      url:             `${BASE_URL}/fellowship/join`,
      lastModified:    new Date(),
      changeFrequency: 'monthly',
      priority:        0.5,
    },
    {
      url:             `${BASE_URL}/church/join`,
      lastModified:    new Date(),
      changeFrequency: 'monthly',
      priority:        0.5,
    },
  ]
}
