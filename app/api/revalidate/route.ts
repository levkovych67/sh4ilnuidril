import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireEnv } from '@/lib/config';

export async function POST(req: NextRequest) {
  const expected = `Bearer ${requireEnv('REVALIDATE_TOKEN')}`;
  if (req.headers.get('Authorization') !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  revalidateTag('products');
  return NextResponse.json({
    revalidated: true,
    tag: 'products',
    at: new Date().toISOString(),
  });
}
