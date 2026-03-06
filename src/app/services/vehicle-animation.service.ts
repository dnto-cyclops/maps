import { Injectable } from '@angular/core';
import { MapService } from './map.service';
import { CoordinateService } from './coordinate.service';
import { RouteDrawingService } from './route-drawing.service';

@Injectable({
  providedIn: 'root'
})
export class VehicleAnimationService {
  
  constructor(
    private mapService: MapService,
    private coordinateService: CoordinateService,
    private routeDrawingService: RouteDrawingService
  ) {}

  /**
   * Queue vehicle movement with smooth animation
   */
  queueVehicleMovement(rId: string, targetPos: number[], routeEntry: any) {
    if (!routeEntry) return;

    if (!routeEntry.vehicleQueue) routeEntry.vehicleQueue = [];

    // Validate coordinate format: targetPos should be [lng, lat]
    // Valid ranges: lng [-180, 180], lat [-90, 90]
    const [lng, lat] = targetPos;

    // Basic validation: reject coordinates outside valid range
    if (Math.abs(lng) > 180 || Math.abs(lat) > 90) {
      console.warn(`[VehicleAnimation] Invalid coordinate range for route ${rId}:`, { lng, lat });
      return;
    }

    // Diagnostic: warn if coordinates are near Null Island (0,0) within 1° radius
    // This uses the correct [lng, lat] format
    if (Math.abs(lng) < 1.0 && Math.abs(lat) < 1.0) {
      console.warn(`[VehicleAnimation] Suspicious Null Island coordinate for route ${rId}:`, targetPos);
      return; // Reject Null Island coordinates
    }

    // Check if targetPos is significantly different from the last queued position or current position
    const lastPos = routeEntry.vehicleQueue.length > 0
      ? routeEntry.vehicleQueue[routeEntry.vehicleQueue.length - 1]
      : (routeEntry.currentVehiclePos || null);

    if (lastPos) {
      if (!this.coordinateService.isSignificantlyDifferent(targetPos, lastPos)) {
        return;
      }
      // Reject teleportation: discard positions more than 10° away (~1100 km) from
      // the last known position. This is a sanity check to catch obvious coordinate errors
      // while allowing normal vehicle movements.
      const dx = Math.abs(targetPos[0] - lastPos[0]);
      const dy = Math.abs(targetPos[1] - lastPos[1]);
      if (dx > 10.0 || dy > 10.0) {
        console.warn(`[VehicleAnimation] Skipping suspicious position jump for route ${rId}:`, { 
          from: lastPos, 
          to: targetPos, 
          delta: { dx: dx.toFixed(6), dy: dy.toFixed(6) },
          distanceKm: ((dx + dy) * 111).toFixed(2)
        });
        return;
      }
    }

    routeEntry.vehicleQueue.push(targetPos);

    if (!routeEntry.isAnimating) {
      this.processVehicleQueue(rId, routeEntry);
    }
  }

  private processVehicleQueue(rId: string, routeEntry: any) {
    if (!routeEntry || !routeEntry.vehicleQueue || routeEntry.vehicleQueue.length === 0) {
      if (routeEntry) routeEntry.isAnimating = false;
      return;
    }

    routeEntry.isAnimating = true;
    const nextPos = routeEntry.vehicleQueue.shift()!;
    const startPos = routeEntry.currentVehiclePos || nextPos;
    
    // Duration in ms for smooth movement
    const duration = 1000;
    const startTime = performance.now();

    const animate = (time: number) => {
      let t = (time - startTime) / duration;
      if (t >= 1) {
        t = 1;
        routeEntry.currentVehiclePos = nextPos;
        this.placeVehicle(rId, nextPos);
        this.processVehicleQueue(rId, routeEntry); // Process next
      } else {
        // Interpolate position
        const lng = startPos[0] + (nextPos[0] - startPos[0]) * t;
        const lat = startPos[1] + (nextPos[1] - startPos[1]) * t;
        const currentPos = [lng, lat];
        
        routeEntry.currentVehiclePos = currentPos;
        this.placeVehicle(rId, currentPos);
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  private placeVehicle(rId: string, pos: number[]) {
    const map = this.mapService.getMap();
    const vehiclePos: [number, number] = [pos[0], pos[1]];
    
    this.routeDrawingService.addMarker(
      map,
      `vehicle-${rId}`,
      `layer-vehicle-${rId}`,
      vehiclePos,
      'vehicle-icon'
    );
  }

  /**
   * Set up vehicle click interaction
   */
  setupVehicleInteraction(rId: string, onVehicleClick: (rId: string) => void) {
    const map = this.mapService.getMap();
    const layerId = `layer-vehicle-${rId}`;

    // Remove existing listeners to avoid duplicates (with proper typing)
    try {
      (map as any).off('click', layerId);
      (map as any).off('mouseenter', layerId);
      (map as any).off('mouseleave', layerId);
    } catch (e) {
      // Ignore if no listeners exist
    }

    // Add new listeners
    map.on('click', layerId, () => onVehicleClick(rId));
    (map as any).on('mouseenter', layerId, () => map.getCanvas().style.cursor = 'pointer');
    (map as any).on('mouseleave', layerId, () => map.getCanvas().style.cursor = '');
  }
}
