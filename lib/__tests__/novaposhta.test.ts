import { describe, it, expect } from 'vitest';
import { mapCities, mapWarehouses } from '../novaposhta';

describe('mapCities', () => {
  it('maps NP settlement payload to options', () => {
    const raw = [{ Present: 'Львів, Львівська обл.', Ref: 'ref-1' }];
    expect(mapCities(raw)).toEqual([{ label: 'Львів, Львівська обл.', ref: 'ref-1' }]);
  });
  it('returns empty array for missing input', () => {
    expect(mapCities(undefined)).toEqual([]);
  });
});

describe('mapWarehouses', () => {
  it('maps a branch with type and number', () => {
    const raw = [
      { Description: 'Відділення №5', Ref: 'wh-5', Number: '5', CategoryOfWarehouse: 'Branch' },
    ];
    expect(mapWarehouses(raw)).toEqual([
      { label: 'Відділення №5', ref: 'wh-5', type: 'branch', number: '5' },
    ]);
  });
  it('detects a postbox from CategoryOfWarehouse', () => {
    const raw = [
      { Description: 'Поштомат №3', Ref: 'pb-3', Number: '3', CategoryOfWarehouse: 'Postomat' },
    ];
    expect(mapWarehouses(raw)[0].type).toBe('postbox');
  });
  it('falls back to the description when category is absent', () => {
    const raw = [{ Description: 'Поштомат "Сільпо"', Ref: 'pb-x', Number: '9' }];
    expect(mapWarehouses(raw)[0].type).toBe('postbox');
  });
  it('sorts branches before postboxes, then by number', () => {
    const raw = [
      { Description: 'Поштомат №2', Ref: 'p2', Number: '2', CategoryOfWarehouse: 'Postomat' },
      { Description: 'Відділення №10', Ref: 'b10', Number: '10', CategoryOfWarehouse: 'Branch' },
      { Description: 'Відділення №3', Ref: 'b3', Number: '3', CategoryOfWarehouse: 'Branch' },
    ];
    expect(mapWarehouses(raw).map((w) => w.ref)).toEqual(['b3', 'b10', 'p2']);
  });
  it('returns an empty array for missing input', () => {
    expect(mapWarehouses(undefined)).toEqual([]);
  });
});
