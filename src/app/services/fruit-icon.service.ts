import { Injectable } from '@angular/core';

export const FRUIT_SLUGS = [
  'papaya',
  'melon',
  'mora',
  'tomate-de-arbol',
  'lulo',
  'guayaba',
  'mango',
  'maracuya',
  'patilla',
  'manzana',
  'guanabana',
  'pera',
];

const FRUIT_SLUG_SET = new Set(FRUIT_SLUGS);

export const FRUIT_ICON_MAP: Record<string, string> = {
  papaya: 'papaya',
  melon: 'melon',
  mora: 'mora',
  'tomate de arbol': 'tomate-de-arbol',
  lulo: 'lulo',
  guayaba: 'guayaba',
  mango: 'mango',
  maracuya: 'maracuya',
  patilla: 'patilla',
  manzana: 'manzana',
  guanabana: 'guanabana',
  pera: 'pera',
  sandia: 'patilla'
};

export const DEFAULT_FRUIT_ICON = 'vehicle-icon';

const normalizeFruitValue = (value: string): string => {
  return value
    .toLocaleLowerCase('es-CO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

@Injectable({ providedIn: 'root' })
export class FruitIconService {
  private resolveSlug(load: string | undefined | null): string | null {
    if (!load || typeof load !== 'string') return null;

    const normalized = normalizeFruitValue(load);
    const mapped = FRUIT_ICON_MAP[normalized];
    if (mapped) return mapped;

    const asSlug = normalized.replace(/\s+/g, '-');
    if (FRUIT_SLUG_SET.has(asSlug)) return asSlug;

    return null;
  }

  getIconId(load: string | undefined | null): string {
    const slug = this.resolveSlug(load);
    return slug ? `fruit-${slug}` : DEFAULT_FRUIT_ICON;
  }

  getSelectedIconId(load: string | undefined | null): string {
    const slug = this.resolveSlug(load);
    return slug ? `fruit-${slug}` : DEFAULT_FRUIT_ICON;
  }

  getAllSlugs(): string[] {
    return [...FRUIT_SLUGS];
  }

  getCardIconPath(load: string | undefined | null): string {
    const slug = this.resolveSlug(load);
    return slug ? `assets/icons/fruits/cards/${slug}.svg` : 'assets/icons/truck.svg';
  }

  /** Colored-circle marker variant (white glyph on a tinted disc), used on maps and the dashboard. */
  getMarkerIconPath(load: string | undefined | null): string {
    const slug = this.resolveSlug(load);
    return slug ? `assets/icons/fruits/${slug}.svg` : 'assets/icons/truck.svg';
  }
}
