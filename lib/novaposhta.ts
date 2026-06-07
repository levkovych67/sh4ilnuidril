export interface NpOption { label: string; ref: string; }

export interface NpWarehouse {
  label: string;
  ref: string;
  type: 'branch' | 'postbox';
  number: string;
}

const NP_ENDPOINT = 'https://api.novaposhta.ua/v2.0/json/';

export function mapCities(raw: unknown): NpOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c: { Present?: string; Description?: string; Ref: string }) => ({
    label: c.Present ?? c.Description ?? '',
    ref: c.Ref,
  }));
}

export function mapWarehouses(raw: unknown): NpWarehouse[] {
  if (!Array.isArray(raw)) return [];
  const items: NpWarehouse[] = raw.map(
    (w: {
      Description?: string;
      Ref: string;
      Number?: string;
      CategoryOfWarehouse?: string;
    }) => {
      const description = w.Description ?? '';
      const isPostbox = w.CategoryOfWarehouse
        ? w.CategoryOfWarehouse === 'Postomat'
        : /поштомат/i.test(description);
      return {
        label: description,
        ref: w.Ref,
        type: (isPostbox ? 'postbox' : 'branch') as NpWarehouse['type'],
        number: w.Number ?? '',
      };
    },
  );
  return items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'branch' ? -1 : 1;
    return (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0);
  });
}

/** Пошук населених пунктів за частиною назви. */
export async function searchCities(apiKey: string, query: string): Promise<NpOption[]> {
  const res = await fetch(NP_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey, modelName: 'Address', calledMethod: 'searchSettlements',
      methodProperties: { CityName: query, Limit: '8' },
    }),
  });
  const json = await res.json();
  const addresses = json?.data?.[0]?.Addresses;
  return mapCities(addresses);
}

/** Список відділень/поштоматів для населеного пункту. */
export async function listWarehouses(apiKey: string, settlementRef: string): Promise<NpWarehouse[]> {
  const res = await fetch(NP_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey, modelName: 'Address', calledMethod: 'getWarehouses',
      methodProperties: { SettlementRef: settlementRef },
    }),
  });
  const json = await res.json();
  return mapWarehouses(json?.data);
}
