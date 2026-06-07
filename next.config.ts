import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // Allow product media the bot uploads to S3 (CheckoutForm / CartDrawer render
    // these via next/image). Host must match the backend's AWS_S3_PUBLIC_URL_BASE.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'sh4ilnui-drill-bucket.s3.eu-north-1.amazonaws.com',
        pathname: '/products/**',
      },
    ],
  },
};

export default nextConfig;
