import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MissionLab — Mars Astronaut Mission Trainer',
    short_name: 'MissionLab',
    description: 'Immersive Mars habitat digital twin and junior astronaut systems engineering trainer.',
    start_url: '/mission',
    display: 'standalone',
    background_color: '#0e0b0c',
    theme_color: '#0e0b0c',
    orientation: 'any',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
