import { Injectable } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { decode } from '@googlemaps/polyline-codec';
import { CoordinateService } from './coordinate.service';
import { MapService } from './map.service';
import { FruitIconService } from './fruit-icon.service';

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
  private mapService: MapService,
  private fruitIconService: FruitIconService
) {}

  private routeLoadMap = new Map<string, string>();
  private currentClickPopup: maplibregl.Popup | null = null;


  setRouteLoad(rId: string, load: string | { load?: string } | undefined | null) {
    const loadValue = typeof load === 'string'
      ? load
      : (typeof load?.load === 'string' ? load.load : undefined);

    if (loadValue) this.routeLoadMap.set(rId, loadValue);
  }
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
  drawRouteLine(map: maplibregl.Map, rId: string, coords: number[][], color?: string, width?: number) {
    const sourceId = `route-${rId}`;
    const lineColor = color ?? 'rgba(48, 108, 45, 1)';
    const lineWidth = width ?? 4;

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
          'line-color': lineColor, 
          'line-width': lineWidth 
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
    
    let resolvedIcon = iconId;
    let iconSize = 1.0;

    if (iconId === 'vehicle-icon' && rId) {
      const load = this.routeLoadMap.get(rId);
      const isSelected = rId === this.selectedRouteId;
      resolvedIcon = isSelected
        ? this.fruitIconService.getSelectedIconId(load)
        : this.fruitIconService.getIconId(load);
      iconSize = isSelected ? 1.3 : 1.0;
    }

    if (iconId === 'vehicle-icon' && rId) {
      const load = this.routeLoadMap.get(rId);
      console.log(`[addMarker] rId=${rId} load=${load} resolvedIcon=${resolvedIcon}`);
    }

    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as any).setData(data);
    } else {
      map.addSource(sourceId, { type: 'geojson', data });
      map.addLayer({
        id: layerId,
        type: 'symbol',
        source: sourceId,
        layout: { 
          'icon-image': resolvedIcon, 
          'icon-anchor': iconId === 'vehicle-icon' ? 'center' : 'bottom', 
          'icon-size': iconSize,
          'icon-allow-overlap': true,
        },
        paint: {
          'icon-opacity': 1
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
  calculateDestination(route: any, _endCoord: [number, number] | null): [number, number] | null {
    // Explicit destination preferred
    const providedDest = route.dest && Array.isArray(route.dest) && route.dest.length >= 2
      ? this.coordinateService.toLngLat(route.dest)
      : null;

    if (providedDest) return providedDest;

    const altDest = Array.isArray(route?.d) && route.d.length >= 2
      ? this.coordinateService.toLngLat(route.d)
      : null;

    if (altDest) return altDest;

    const destObj = route?.dest && typeof route.dest === 'object' ? route.dest : null;
    const destObjLatLong = Array.isArray(destObj?.latlong) && destObj.latlong.length >= 2
      ? this.coordinateService.toLngLat(destObj.latlong)
      : null;

    if (destObjLatLong) return destObjLatLong;
    
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
      if (existingHandlers.mousemove) {
        map.off('mousemove', layerId, existingHandlers.mousemove);
      }
      map.off('mouseleave', layerId, existingHandlers.mouseleave);
      map.off('click', layerId, existingHandlers.click);
    }

    const showHoverCard = (e: any) => {
      map.getCanvas().style.cursor = 'pointer';

      if (this.onVehicleHoverChanged) {
        this.onVehicleHoverChanged(true, rId);
      }
    };

    // Create new handlers
    const handlers = {
      mouseenter: showHoverCard,
      mousemove: showHoverCard,

      mouseleave: () => {
        map.getCanvas().style.cursor = '';
        if (this.onVehicleHoverChanged) {
          this.onVehicleHoverChanged(false, rId);
        }
      },

      click: (e: any) => {
        console.log(`🖱️ Vehicle clicked:`, { rId, layerId, event: e });

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
    console.log(`[route-drawing] Binding interact events for: ${layerId} rId=${rId}`);
    map.on('mouseenter', layerId, handlers.mouseenter);
    map.on('mousemove', layerId, handlers.mousemove);
    map.on('mouseleave', layerId, handlers.mouseleave);
    map.on('click', layerId, handlers.click);

    // Store handlers for cleanup
    this.routeTooltipHandlers.set(layerId, handlers);
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

    const rId = layerId.replace('layer-vehicle-', '');
    const load = this.routeLoadMap.get(rId);

    // Change the icon image to show selection state
    const iconImage = selected
        ? this.fruitIconService.getSelectedIconId(load)
        : this.fruitIconService.getIconId(load);
    const iconSize = selected ? 1.3 : 1.0;
    
    try {
      map.setLayoutProperty(layerId, 'icon-image', iconImage);
      map.setLayoutProperty(layerId, 'icon-size', iconSize);
      
      // Also adjust opacity for better visual feedback
      const opacity = selected ? 1 : 0.8;
      map.setPaintProperty(layerId, 'icon-opacity', 1);
      
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
        if (handlers.mousemove) {
          map.off('mousemove', layerId, handlers.mousemove);
        }
        map.off('mouseleave', layerId, handlers.mouseleave);
        map.off('click', layerId, handlers.click);
      }
    });
    this.routeTooltipHandlers.clear();

    // if (this.currentTooltip) {
    //   this.currentTooltip.remove();
    //   this.currentTooltip = null;
    // }
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

  public onVehicleHoverChanged?: (isHovering: boolean, rId: string) => void;

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
