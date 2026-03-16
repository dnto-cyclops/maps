import { Injectable } from '@angular/core';
import maplibregl from 'maplibre-gl';

export const FRUIT_ICON_MAP: Record<string, string> = {
  'papaya':           'papaya',
  'melón':            'melon',
  'melon':            'melon',
  'mora':             'mora',
  'tomate de arbol':  'tomate-de-arbol',
  'tomate de árbol':  'tomate-de-arbol',
  'lulo':             'lulo',
  'guayaba':          'guayaba',
  'mango':            'mango',
  'maracuyá':         'maracuya',
  'maracuya':         'maracuya',
  'patilla':          'patilla',
  'manzana':          'manzana',
  'guanábana':        'guanabana',
  'guanabana':        'guanabana',
  'pera':             'pera',
};

export const DEFAULT_FRUIT_ICON = 'vehicle-icon';

@Injectable({ providedIn: 'root' })
export class FruitIconService {

  getIconId(load: string | undefined | null): string {
    if (!load || typeof load !== 'string') return DEFAULT_FRUIT_ICON;
    const key = load.toLowerCase().trim();
    const slug = FRUIT_ICON_MAP[key];
    return slug ? `fruit-${slug}` : DEFAULT_FRUIT_ICON;
  }

  getSelectedIconId(load: string | undefined | null): string {
    if (!load || typeof load !== 'string') return 'vehicle-icon-selected';
    const key = load.toLowerCase().trim();
    const slug = FRUIT_ICON_MAP[key];
    return slug ? `fruit-${slug}-selected` : 'vehicle-icon-selected';
  }

  getAllSlugs(): string[] {
    return [...new Set(Object.values(FRUIT_ICON_MAP))];
  }
}