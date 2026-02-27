import { Injectable } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { decode } from '@googlemaps/polyline-codec';
import { CoordinateService } from './coordinate.service';
import { MapService } from './map.service';

export interface RouteData {
  rId: string;
  coords: number[][];
  lineId: string;
  startMarker?: any;
  endMarker?: any;
  destMarker?: any;
  vehicleMarker?: any;
  fitted?: boolean;
  vehicleQueue?: number[][];
  isAnimating?: boolean;
  currentVehiclePos?: number[];
  dest?: [number, number] | null;
  status?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RouteDrawingService {
private selectedRouteId: string | null = null;
private routeTooltipHandlers = new Map<string, any>();
private currentTooltip: maplibregl.Popup | null = null;
  
constructor(
  private coordinateService: CoordinateService,
  private mapService: MapService
) {}

  /**
   * Parse route coordinates from various formats
   */
  parseRouteCoordinates(route: any): number[][] {
    let coords: number[][] = [];
    
    // Decode polyline if present
    if (route.polyline || route.p) {
      coords = this.parsePolyline(route.polyline || route.p);
    } else if (route.coordinates && Array.isArray(route.coordinates)) {
      coords = route.coordinates
        .map((p: number[]) => this.coordinateService.toLngLat(p))
        .filter((p: [number, number] | null): p is [number, number] => !!p);
    }
    
    return coords;
  }

  private parsePolyline(polyStr: string): number[][] {
    if (!polyStr || polyStr.length === 0) return [];

    const collected: [number, number][] = [];

    try {
      // Strip characters outside the valid polyline range [0x3F–0x7E].
      // Bytes below 0x3F (e.g. null bytes from a corrupted SSE stream) cause
      // the codec to emit premature terminal chunks, producing garbage coordinates.
      // NOTE: '|' (0x7C) is a valid encoded polyline character — do NOT use it as a separator.
      const sanitized = polyStr.replace(/[^\x3F-\x7E]/g, '');
      if (!sanitized) return [];

      // decode returns [lat, lng] — format is always known, no heuristic needed
      decode(sanitized).forEach((p: any) => {
        const lat = p[0], lng = p[1];
        const val = this.coordinateService.validatePolylinePoint(lat, lng);
        if (!val) {
          if (Math.abs(lat) > 0.0001 || Math.abs(lng) > 0.0001) {
            console.warn('[parsePolyline] Filtered suspicious decoded point:', { lat, lng });
          }
          return;
        }
        // Avoid duplicates
        const last = collected.length > 0 ? collected[collected.length - 1] : null;
        if (!last || last[0] !== val[0] || last[1] !== val[1]) {
          collected.push(val);
        }
      });
    } catch (e) {
      console.error('Error decoding polyline:', polyStr, e);
    }

    return collected;
  }

  /**
   * Draw or update route line on map
   */
  drawRouteLine(map: maplibregl.Map, rId: string, coords: number[][]) {
    const sourceId = `route-${rId}`;
    
    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as any).setData({ 
        type: 'Feature', 
        geometry: { type: 'LineString', coordinates: coords },
        properties: {}
      });
    } else {
      map.addSource(sourceId, { 
        type: 'geojson', 
        data: { 
          type: 'Feature', 
          geometry: { type: 'LineString', coordinates: coords },
          properties: {}
        } 
      });
      map.addLayer({ 
        id: `layer-${rId}`, 
        type: 'line', 
        source: sourceId, 
        paint: { 
          'line-color': 'rgba(48, 108, 45, 1)', 
          'line-width': 4 
        } 
      });
    }
  }

  /**
   * Add or update marker on map with interaction
   */
  addMarker(map: maplibregl.Map, sourceId: string, layerId: string, pos: [number, number], iconId: string, rId?: string) {
    const data = { 
      type: 'Feature' as const, 
      geometry: { type: 'Point' as const, coordinates: pos },
      properties: { rId: rId || '' }
    };
    
    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as any).setData(data);
    } else {
      // Determine the correct icon and size to use
      let actualIconId = iconId;
      let iconSize = 1.0; // Default size
      
      if (iconId === 'vehicle-icon' && rId === this.selectedRouteId) {
        actualIconId = 'vehicle-icon-selected';
        iconSize = 1.3; // 30% bigger when selected
      }

      map.addSource(sourceId, { type: 'geojson', data });
      map.addLayer({
        id: layerId,
        type: 'symbol',
        source: sourceId,
        layout: { 
          'icon-image': actualIconId, 
          'icon-anchor': iconId === 'vehicle-icon' ? 'center' : 'bottom', 
          'icon-size': iconSize,
          'icon-allow-overlap': true
        },
        paint: {
          'icon-opacity': rId === this.selectedRouteId ? 1 : 0.8
        }
      });

      // Add interaction for vehicle markers
      if (iconId === 'vehicle-icon' && rId) {
        this.setupVehicleInteraction(map, layerId, rId);
      }
    }

    // Update icon, size and opacity for existing layers if this is the selected route
    if (iconId === 'vehicle-icon' && rId === this.selectedRouteId) {
      this.setVehicleSelected(map, layerId, true);
    }
  }

  /**
   * Fit map to show route bounds
   */
  fitRoute(coords: number[][], rId: string, dest?: [number, number] | null, current?: [number, number] | null) {
    const map = this.mapService.getMap();
    if (!map || coords.length === 0) return;

    const start = coords[0];
    const points: [number, number][] = [];
    
    if (start) points.push(start as [number, number]);
    if (current) points.push(current);
    if (dest) points.push(dest);

    if (points.length > 0) {
      const bounds = new maplibregl.LngLatBounds(points[0], points[0]);
      points.forEach(p => bounds.extend(p));
      
      this.mapService.fitBounds(bounds);
      
      // Fly to current position after fit
      if (current) {
        setTimeout(() => {
          this.mapService.flyTo(current, 14);
        }, 900); // After fitBounds animation
      }
    }
  }

  /**
   * Calculate destination position with offset if needed
   */
  calculateDestination(route: any, endCoord: [number, number] | null): [number, number] | null {
    // Explicit destination preferred
    const providedDest = route.dest && Array.isArray(route.dest) && route.dest.length >= 2
      ? this.coordinateService.toLngLat(route.dest)
      : null;

    if (providedDest) return providedDest;
    
    // Offset from end coordinate
    if (endCoord) {
      return [endCoord[0] + 0.0002, endCoord[1]];
    }
    
    return null;
  }

  /**
   * Setup hover and click interaction for vehicle markers
   */
  private setupVehicleInteraction(map: maplibregl.Map, layerId: string, rId: string) {
    // Remove existing handlers
    const existingHandlers = this.routeTooltipHandlers.get(layerId);
    if (existingHandlers) {
      map.off('mouseenter', layerId, existingHandlers.mouseenter);
      map.off('mouseleave', layerId, existingHandlers.mouseleave);
      map.off('click', layerId, existingHandlers.click);
    }

    // Create new handlers
    const handlers = {
      mouseenter: (e: any) => {
        map.getCanvas().style.cursor = 'pointer';
        
        if (this.currentTooltip) {
          this.currentTooltip.remove();
        }
        
        const coordinates = (e.features![0].geometry as any).coordinates.slice();
        const tooltipContent = this.createVehicleTooltip(rId);
        
        this.currentTooltip = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: 'vehicle-hover-tooltip'
        })
        .setLngLat(coordinates)
        .setHTML(tooltipContent)
        .addTo(map);
      },

      mouseleave: () => {
        map.getCanvas().style.cursor = '';
        if (this.currentTooltip) {
          this.currentTooltip.remove();
          this.currentTooltip = null;
        }
      },

      click: (e: any) => {
        console.log(`🖱️ Vehicle clicked:`, { rId, layerId, event: e });
        
        if (this.currentTooltip) {
          this.currentTooltip.remove();
          this.currentTooltip = null;
        }
        
        // Select this route
        this.selectVehicle(map, rId);
        
        // Callback to parent component
        if (this.onVehicleSelected) {
          console.log(`📞 Calling onVehicleSelected callback for: ${rId}`);
          this.onVehicleSelected(rId);
        } else {
          console.warn(`⚠️ No onVehicleSelected callback defined`);
        }
      }
    };

    // Add event listeners
    map.on('mouseenter', layerId, handlers.mouseenter);
    map.on('mouseleave', layerId, handlers.mouseleave);
    map.on('click', layerId, handlers.click);

    // Store handlers for cleanup
    this.routeTooltipHandlers.set(layerId, handlers);
  }

  /**
   * Create tooltip content for vehicle
   */
  private createVehicleTooltip(rId: string): string {
    // Get route data from provider
    let routeData: any = null;
    if (this.routeDataProvider) {
      routeData = this.routeDataProvider(rId);
    }

    const routeName = routeData?.name || `Ruta ${rId}`;
    const status = routeData?.status || 'Activa';
    const destination = routeData?.dest ? '📍 Con destino' : '';
    const isSelected = rId === this.selectedRouteId;
    
    return `
      <div class="vehicle-tooltip">
        <div class="vehicle-tooltip-header">
          <strong>${routeName}</strong>
          <span class="status-badge status-${status.toLowerCase()}">${status}</span>
        </div>
        <div class="vehicle-tooltip-body">
          ${destination ? `<div>${destination}</div>` : ''}
          <div>🚚 Vehículo ${isSelected ? 'seleccionado' : 'activo'}</div>
          <div class="action-hint">👆 Click para ${isSelected ? 'ver detalles' : 'seleccionar'}</div>
        </div>
      </div>
      <style>
        .vehicle-hover-tooltip .maplibregl-popup-content {
          padding: 8px 12px;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          font-size: 11px;
          border: 1px solid #e5e7eb;
          background: white;
          min-width: 140px;
        }
        .vehicle-tooltip-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
          color: #1f2937;
          font-size: 12px;
        }
        .status-badge {
          font-size: 9px;
          padding: 2px 4px;
          border-radius: 8px;
          font-weight: 500;
        }
        .status-active, .status-activa {
          background: #dcfce7;
          color: #16a34a;
        }
        .status-paused, .status-pausada {
          background: #fed7aa;
          color: #ea580c;
        }
        .vehicle-tooltip-body {
          color: #6b7280;
          font-size: 10px;
        }
        .vehicle-tooltip-body > div {
          margin: 2px 0;
        }
        .action-hint {
          color: #3b82f6;
          font-weight: 500;
          margin-top: 4px;
          padding-top: 3px;
          border-top: 1px solid #f3f4f6;
        }
      </style>
    `;
  }

  /**
   * Select a vehicle and update its appearance
   */
  private selectVehicle(map: maplibregl.Map, rId: string) {
    console.log(`🚗 Selecting vehicle: ${rId}`, { previousSelected: this.selectedRouteId });
    
    // Deselect previous vehicle
    if (this.selectedRouteId && this.selectedRouteId !== rId) {
      const prevLayerId = `layer-vehicle-${this.selectedRouteId}`;
      console.log(`🔄 Deselecting previous vehicle: ${this.selectedRouteId}, layer: ${prevLayerId}`);
      this.setVehicleSelected(map, prevLayerId, false);
    }

    // Select new vehicle
    this.selectedRouteId = rId;
    const layerId = `layer-vehicle-${rId}`;
    console.log(`✅ Selecting new vehicle: ${rId}, layer: ${layerId}`);
    this.setVehicleSelected(map, layerId, true);
  }

  /**
   * Set vehicle visual state (selected/unselected)
   */
  private setVehicleSelected(map: maplibregl.Map, layerId: string, selected: boolean) {
    console.log(`🎨 Setting vehicle state:`, { layerId, selected, layerExists: !!map.getLayer(layerId) });
    
    if (!map.getLayer(layerId)) {
      console.warn(`⚠️ Layer ${layerId} not found on map`);
      return;
    }

    // Change the icon image to show selection state
    const iconImage = selected ? 'vehicle-icon-selected' : 'vehicle-icon';
    console.log(`🖼️ Changing icon to: ${iconImage} for layer: ${layerId}`);
    
    // Change size: 1.3 (30% bigger) when selected, 1.0 normal
    const iconSize = selected ? 1.3 : 1.0;
    console.log(`📏 Changing icon size to: ${iconSize} for layer: ${layerId}`);
    
    try {
      map.setLayoutProperty(layerId, 'icon-image', iconImage);
      map.setLayoutProperty(layerId, 'icon-size', iconSize);
      
      // Also adjust opacity for better visual feedback
      const opacity = selected ? 1 : 0.8;
      map.setPaintProperty(layerId, 'icon-opacity', opacity);
      
      console.log(`✅ Successfully updated vehicle visual state:`, { layerId, iconImage, iconSize, opacity });
    } catch (error) {
      console.error(`❌ Error updating vehicle visual state:`, error);
    }
  }

  /**
   * Clear all vehicle interactions and tooltips
   */
  clearVehicleInteractions(map: maplibregl.Map) {
    this.routeTooltipHandlers.forEach((handlers, layerId) => {
      if (map.getLayer(layerId)) {
        map.off('mouseenter', layerId, handlers.mouseenter);
        map.off('mouseleave', layerId, handlers.mouseleave);
        map.off('click', layerId, handlers.click);
      }
    });
    this.routeTooltipHandlers.clear();

    if (this.currentTooltip) {
      this.currentTooltip.remove();
      this.currentTooltip = null;
    }
  }

  /**
   * Get selected route ID
   */
  getSelectedRouteId(): string | null {
    return this.selectedRouteId;
  }

  /**
   * Set selected route externally
   */
  setSelectedRoute(rId: string | null) {
    const map = this.mapService.getMap();
    if (map && rId) {
      this.selectVehicle(map, rId);
    } else {
      this.selectedRouteId = rId;
    }
  }

  /**
   * Callback for vehicle selection
   */
  public onVehicleSelected?: (rId: string) => void;

  /**
   * Set route data provider for tooltips
   */
  public routeDataProvider?: (rId: string) => any;

  /**
   * Set route data provider
   */
  setRouteDataProvider(provider: (rId: string) => any) {
    this.routeDataProvider = provider;
  }
}
