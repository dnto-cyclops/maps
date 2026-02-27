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

    // Check if targetPos is significantly different from the last queued position or current position
    const lastPos = routeEntry.vehicleQueue.length > 0
      ? routeEntry.vehicleQueue[routeEntry.vehicleQueue.length - 1]
      : (routeEntry.currentVehiclePos || null);

    if (lastPos && !this.coordinateService.isSignificantlyDifferent(targetPos, lastPos)) {
      return;
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
        this.mapService.ensurePointVisible(nextPos as [number, number]);
        this.processVehicleQueue(rId, routeEntry); // Process next
      } else {
        // Interpolate position
        const lng = startPos[0] + (nextPos[0] - startPos[0]) * t;
        const lat = startPos[1] + (nextPos[1] - startPos[1]) * t;
        const currentPos = [lng, lat];
        
        routeEntry.currentVehiclePos = currentPos;
        this.placeVehicle(rId, currentPos);
        this.mapService.ensurePointVisible(currentPos as [number, number]);
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
