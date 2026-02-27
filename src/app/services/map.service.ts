import { Injectable } from '@angular/core';
import maplibregl from 'maplibre-gl';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private map!: maplibregl.Map;

  initializeMap(containerId: string): maplibregl.Map {
    this.map = new maplibregl.Map({
      container: containerId,
      attributionControl: false,
      style: { 
        version: 8, 
        sources: { 
          'osm-tiles': { 
            type: 'raster', 
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ], 
            tileSize: 256 
          } 
        }, 
        layers: [{ 
          id: 'osm-tiles', 
          type: 'raster', 
          source: 'osm-tiles' 
        }] 
      },
      center: [0, 0],
      zoom: 1,
      transformRequest: (url: string, resourceType: any) => {
        if (resourceType === 'Tile' && url.includes('openstreetmap.org')) {
          return { url, headers: { 'User-Agent': 'RouteMapApp/1.0' } };
        }
        return { url };
      }
    });
    
    return this.map;
  }

  getMap(): maplibregl.Map {
    return this.map;
  }

  flyTo(center: [number, number], zoom: number = 14) {
    this.map.flyTo({ 
      center, 
      zoom, 
      speed: 1.2, 
      curve: 1.2, 
      essential: true 
    });
  }

  fitBounds(bounds: maplibregl.LngLatBounds, options?: any) {
    const defaultOptions = { padding: 80, maxZoom: 16, duration: 800 };
    this.map.fitBounds(bounds, { ...defaultOptions, ...options });
  }

  ensurePointVisible(pos: [number, number], margin: number = 80) {
    if (!pos) return;

    const canvas = this.map.getCanvas();
    const width = canvas.width;
    const height = canvas.height;

    const projected = this.map.project(pos);
    const nearEdge = projected.x < margin || 
                     projected.x > width - margin || 
                     projected.y < margin || 
                     projected.y > height - margin;

    if (nearEdge) {
      this.flyTo(pos, Math.max(this.map.getZoom(), 14));
    }
  }
}
