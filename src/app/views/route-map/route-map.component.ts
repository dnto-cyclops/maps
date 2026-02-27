import { Component, OnInit, AfterViewInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UpdatesService } from '../../services/updates.service';
import { RoutesService } from '../../services/routes.service';
import { RoutePanelComponent, RouteCardData, RouteDetailsPanelComponent} from '../../components';
import { 
  MapService, 
  CoordinateService, 
  MapIconService, 
  RouteDrawingService, 
  VehicleAnimationService,
  RouteClusteringService,
  RouteData 
} from '../../services';
import maplibregl from 'maplibre-gl';
import { decode } from '@googlemaps/polyline-codec';

@Component({
selector: 'app-route-map',
standalone: true,
imports: [CommonModule, RoutePanelComponent, RouteDetailsPanelComponent],
  templateUrl: './route-map.component.html',
  styleUrl: './route-map.component.scss',
})
export class RouteMapComponent implements OnInit, AfterViewInit {
map: any;
panelCollapsed = false;
routeList: RouteCardData[] = [];
selectedRouteId: string | null = null;
activeCount = 0;
pausedCount = 0;
  
// store route geometry and markers by rId
routes: { [rId: string]: RouteData } = {};
sidebarCollapsed = false;

// clustering configuration
clusteringEnabled = true;

constructor(
  private us: UpdatesService, 
  private rs: RoutesService, 
  private zone: NgZone, 
  private cdr: ChangeDetectorRef,
  private mapService: MapService,
  private coordinateService: CoordinateService,
  private mapIconService: MapIconService,
  private routeDrawingService: RouteDrawingService,
  private vehicleAnimationService: VehicleAnimationService,
  private routeClusteringService: RouteClusteringService
  ) {
    // Configure route clustering callback
    this.routeClusteringService.onRouteSelected = (routeId: string) => {
      this.selectRoute(routeId);
    };

    // Configure route data provider for enhanced tooltips
    this.routeClusteringService.setRouteDataProvider((rId: string) => {
      const routeData = this.routes[rId];
      const metaData = this.routeList.find(r => r.rId === rId);
      
      return {
        name: metaData?.name || `Ruta ${rId}`,
        status: metaData?.status || 'active',
        dest: routeData?.dest || metaData?.dest,
        current: routeData?.currentVehiclePos || metaData?.current
      };
    });

    // Configure route drawing service for vehicle tooltips
    this.routeDrawingService.setRouteDataProvider((rId: string) => {
      const routeData = this.routes[rId];
      const metaData = this.routeList.find(r => r.rId === rId);
      
      return {
        name: metaData?.name || `Ruta ${rId}`,
        status: metaData?.status || 'active',
        dest: routeData?.dest || metaData?.dest,
        current: routeData?.currentVehiclePos || metaData?.current
      };
    });

    // Configure vehicle selection callback
    this.routeDrawingService.onVehicleSelected = (routeId: string) => {
      this.selectRoute(routeId);
    };
  }
  
  ngOnInit() {}
  
  ngAfterViewInit() {
    this.map = this.mapService.initializeMap('map');

    this.map.on('load', async () => {
      await this.mapIconService.loadIcons(this.map);
      
      // Load existing active routes on startup (snapshot)
      this.rs.snapshot().subscribe({
        next: (list: any[]) => {
          console.log('Snapshot received:', list);
          this.zone.run(() => {
            (list || []).forEach((r: any) => {
              console.log('Processing route:', r.rId, r);
              // Update meta first so panel data is available
              this.upsertRouteMeta(r);
              this.drawRoute(r);
            });
            console.log('RouteList after processing:', this.routeList);
            // Auto-select first route to show details
            if (list && list.length > 0) {
              this.rs.selectRoute(list[0].rId);
              this.selectedRouteId = list[0].rId;
            }
          });
        },
        error: (err: any) => console.error('snapshot error', err)
      });

      // Connect to SSE for real-time updates
      this.us.connect();
      this.us.onUpdate().subscribe((evt: any) => {
        // evt: {type: string, data: any}
        this.zone.run(() => {
          if (evt.type === 'route_created') {
            this.drawRoute(evt.data);
            this.upsertRouteMeta(evt.data);
          } else if (evt.type === 'route_updated' || evt.type === 'pos_update') {
            this.updateVehicle(evt.data);
          }
        });
      });
    });
  }

  private upsertRouteMeta(r: any) {
    const rId = r.rId || r.id || r.routeId;
    if (!rId) return;
    
    console.log(`Upserting meta for route ${rId}:`, r);
    
    const existingIdx = this.routeList.findIndex(x => x.rId === rId);
    const entry = this.routes[rId];
    
    // Use API data as primary source, fall back to stored entry
    const dest = r.dest || r.destination || entry?.dest || null;
    const status = r.status || entry?.status || 'active';
    const start = (r.coordinates && r.coordinates[0]) || entry?.coords?.[0] || null;
    const current = (this.routes[rId]?.currentVehiclePos) || (r.coordinates ? r.coordinates[r.coordinates.length - 1] : entry?.coords?.[entry?.coords.length - 1]);
    
    const meta = {
      rId,
      name: r.name || `Ruta ${rId}`,
      status,
      dest,
      start,
      current
    };
    
    console.log(`Meta object for ${rId}:`, meta);
    
    if (existingIdx >= 0) this.routeList[existingIdx] = { ...this.routeList[existingIdx], ...meta };
    else this.routeList.push(meta);
    
    console.log(`RouteList now has ${this.routeList.length} routes:`, this.routeList);
    
    this.updateCounters();
    
    // Force Angular change detection
    this.cdr.detectChanges();
  }

  private updateCounters() {
    this.activeCount = this.routeList.filter(r => (r.status || 'active') === 'active').length;
    this.pausedCount = this.routeList.filter(r => (r.status || 'active') !== 'active').length;
  }

  drawRoute(route: any) {
    const rId = route.rId || route.id || route.routeId;
    if (!rId) return;
    
    // Parse coordinates using service
    const coords = this.routeDrawingService.parseRouteCoordinates(route);
    
    // Initialize or update route entry
    this.routes[rId] = this.routes[rId] || { coords: [], lineId: `line-${rId}` };
    this.routes[rId].coords = coords;
    this.routes[rId].status = route.status || 'active';

    // Draw route line
    this.routeDrawingService.drawRouteLine(this.map, rId, coords);

    const startCoord = coords.length > 0 ? coords[0] as [number, number] : null;
    const endCoord = coords.length > 0 ? coords[coords.length - 1] as [number, number] : null;

    // Calculate destination
    const destPos = this.routeDrawingService.calculateDestination(route, endCoord);
    this.routes[rId].dest = destPos;

    // Fit route to view
    if (!this.routes[rId].fitted) {
      this.routeDrawingService.fitRoute(coords, rId, destPos, endCoord || undefined);
      this.routes[rId].fitted = true;
    }

    // Add markers
    if (startCoord && endCoord) {
      // Start marker
      this.routeDrawingService.addMarker(this.map, `start-${rId}`, `layer-start-${rId}`, startCoord, 'start-flag');
      
      // Vehicle at end position
      this.routes[rId].currentVehiclePos = endCoord;
      this.placeOrMoveVehicle(rId, endCoord);
    }

    // Destination marker
    if (destPos) {
      this.routeDrawingService.addMarker(this.map, `dest-${rId}`, `layer-dest-${rId}`, destPos, 'end-flag');
    }

    // Sync meta after drawing
    this.upsertRouteMeta({ rId, dest: destPos, coordinates: coords, status: route.status });

    // Update clustering after drawing route
    if (this.clusteringEnabled) {
      this.updateClustering();
    }
  }

  private placeOrMoveVehicle(rId: string, pos: number[]) {
    const entry = this.routes[rId] = this.routes[rId] || { coords: [], lineId: `line-${rId}`, rId: rId };
    const vehiclePos: [number, number] = [pos[0], pos[1]];

    this.routeDrawingService.addMarker(
      this.map,
      `vehicle-${rId}`,
      `layer-vehicle-${rId}`,
      vehiclePos,
      'vehicle-icon',
      rId  // Pass route ID for interaction
    );
    
    // Mark as having vehicle marker (keep existing logic)
    if (!entry.vehicleMarker) {
      entry.vehicleMarker = true;
    }
  }

  updateVehicle(update: any) {
    const rId = update.rId || update.routeId || update.id;
    if (!rId) return;
    
    let points: number[][] = [];

    // Handle encoded polyline update (p or polyline)
    if (update.p || update.polyline) {
      const encoded = update.p || update.polyline;
      points = this.routeDrawingService.parseRouteCoordinates({ polyline: encoded });
    } 
    // Handle explicit position
    else {
      let pos: number[] | null = null;
      if (update.pos) pos = update.pos;
      else if (update.position) pos = update.position;
      else if (update.lat && update.lng) pos = [update.lng, update.lat];
      else if (update.latitude && update.longitude) pos = [update.longitude, update.latitude];

      if (pos) {
        const p = this.coordinateService.toLngLat(pos);
        if (p) points.push(p);
      }
    }

    if (points.length > 0) {
      const entry = this.routes[rId];
      if (entry) {
        // Append new points to route geometry
        points.forEach(p => {
           const last = entry.coords.length > 0 ? entry.coords[entry.coords.length - 1] : null;
           // Add if empty or different from last
           if (!last || last[0] !== p[0] || last[1] !== p[1]) {
             entry.coords.push(p);
           }
        });

        // Update map source immediately so the line connects
        this.routeDrawingService.drawRouteLine(this.map, rId, entry.coords);
      }

      // Queue vehicle movements with animation
      points.forEach(p => {
        this.vehicleAnimationService.queueVehicleMovement(rId, p, this.routes[rId]);
      });

      // Update panel meta with latest current position
      const current = entry?.currentVehiclePos || entry?.coords?.[entry.coords.length - 1];
      this.upsertRouteMeta({ rId, dest: entry?.dest, coordinates: entry?.coords, status: update.status, current });

      // Update clustering after vehicle movement
      if (this.clusteringEnabled) {
        setTimeout(() => this.updateClustering(), 100); // Small delay to allow animation
      }
    }
  }

  /**
   * Update route clustering based on current vehicle positions
   */
  private updateClustering() {
    if (!this.map || !this.clusteringEnabled) return;
    
    this.routeClusteringService.clusterRoutes(this.map, this.routes);
  }

  /**
   * Select a route (from cluster, panel or vehicle click)
   */
  private selectRoute(routeId: string) {
    console.log(`🎯 Selecting route: ${routeId}`);
    
    // Check if clustering is enabled and route is in a cluster
    if (this.clusteringEnabled) {
      const wasInCluster = this.routeClusteringService.expandClusterContainingRoute(this.map, routeId);
      if (wasInCluster) {
        console.log(`📦 Auto-expanded cluster containing route: ${routeId}`);
        // Wait a bit for the expansion animation to complete before continuing
        setTimeout(() => {
          this.finalizeRouteSelection(routeId);
        }, 500);
        return;
      }
    }

    // Route is not in cluster, select normally
    this.finalizeRouteSelection(routeId);
  }

  /**
   * Finalize route selection after cluster expansion (if needed)
   */
  private finalizeRouteSelection(routeId: string) {
    this.selectedRouteId = routeId;
    this.rs.selectRoute(routeId);
    
    // Update vehicle selection in drawing service
    this.routeDrawingService.setSelectedRoute(routeId);
    
    const entry = this.routes[routeId];
    const pos = entry?.currentVehiclePos || entry?.coords?.[entry.coords.length - 1];
    if (pos) {
      this.mapService.flyTo(pos as [number, number], 16);
    }

    // Get route details
    this.rs.details(routeId).subscribe({
      next: (details: any) => {
        console.log('Route details:', details);
      },
      error: (err: any) => console.error('Error getting route details:', err)
    });
  }

  /**
   * Toggle clustering on/off
   */
  toggleClustering() {
    this.clusteringEnabled = !this.clusteringEnabled;
    
    if (this.clusteringEnabled) {
      this.updateClustering();
    } else {
      this.routeClusteringService.clearClusters(this.map);
    }
  }

  /**
   * Handle cluster distance change event
   */
  onClusterDistanceChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target && target.value) {
      this.setClusteringDistance(+target.value);
    }
  }

  /**
   * Set clustering distance threshold
   */
  setClusteringDistance(distance: number) {
    this.routeClusteringService.setClusterDistance(distance);
    if (this.clusteringEnabled) {
      this.updateClustering();
    }
  }

  /**
   * Handle route selection from panel list
   */
  selectFromList(route: RouteCardData) {
    console.log(`📋 Route selected from panel: ${route.rId}`);
    this.selectRoute(route.rId);
  }

  /**
   * Toggle panel visibility
   */
  togglePanel() {
    this.panelCollapsed = !this.panelCollapsed;
  }
}
