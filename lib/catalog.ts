export interface Product {
  sku: string;
  name: string;
  price: number;
  currency: 'UAH';
  videoSrc: string;
  imageSrc: string;
  posterSrc?: string;
}

export const PRODUCTS: readonly Product[] = [
  {
    sku: 'DROP01-OVERSIZE',
    name: 'too much яром too much долиною',
    price: 2600,
    currency: 'UAH',
    videoSrc: '/product1/tshirt.mp4',
    imageSrc: '/product1/too-much-яром-too-much-долиною.jpg',
    posterSrc: '/video.jpg',
  },
  {
    sku: 'DROP01-PRODUCT2',
    name: 'too much яром too much долиною',
    price: 2600,
    currency: 'UAH',
    videoSrc: '/product2/video.mp4',
    imageSrc: '/product2/pic.png',
  },
];

export function findProduct(sku: string): Product | undefined {
  return PRODUCTS.find((p) => p.sku === sku);
}
