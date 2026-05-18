import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             '麦穗喜乐 MaisuiJoy',
    short_name:       '麦穗喜乐',
    description:      '麦穗喜乐 平安喜乐',
    start_url:        '/',
    display:          'standalone',
    orientation:      'portrait',
    theme_color:      '#F59E0B',
    background_color: '#FBFBF9',
    icons: [
      {
        src:     '/apple-icon',
        sizes:   '180x180',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/icon',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'any maskable',
      },
    ],
  }
}
