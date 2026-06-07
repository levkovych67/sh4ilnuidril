import { NextRequest, NextResponse } from 'next/server';
import { searchCities, listWarehouses } from '@/lib/novaposhta';
import { requireEnv } from '@/lib/config';

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type');
  const apiKey = requireEnv('NOVAPOSHTA_API_KEY');

  try {
    if (type === 'cities') {
      const q = req.nextUrl.searchParams.get('q') ?? '';
      return NextResponse.json({ items: await searchCities(apiKey, q) });
    }
    if (type === 'warehouses') {
      const ref = req.nextUrl.searchParams.get('ref') ?? '';
      return NextResponse.json({ items: await listWarehouses(apiKey, ref) });
    }
    return NextResponse.json({ error: 'unknown type' }, { status: 400 });
  } catch {
    return NextResponse.json({ items: [] }, { status: 502 });
  }
}
