import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: `${SITE_URL}/`, lastModified: now },
    { url: `${SITE_URL}/offer`, lastModified: now },
    { url: `${SITE_URL}/returns`, lastModified: now },
  ];
}
