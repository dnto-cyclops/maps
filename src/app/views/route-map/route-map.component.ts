import { Component, OnInit, AfterViewInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { UpdatesService } from '../../services/updates.service';
import { RoutesService } from '../../services/routes.service';
import { RouteCardData } from '../../components/cards/route-card.component';
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
import { NotificationType } from '../../enums/notification-type.enum';
import { FruitIconService } from '../../services/fruit-icon.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-route-map',
  templateUrl: './route-map.component.html',
  styleUrls: ['./route-map.component.scss'],
})
export class RouteMapComponent implements OnInit, AfterViewInit, OnDestroy {
map: any;
panelCollapsed = false;
routeList: RouteCardData[] = [];
selectedRouteId: string | null = null;
activeCount = 0;
pausedCount = 0;
hoveredRouteData: any = null;
private loadingInitialSnapshot = false;
private routeLastReportTs: { [rId: string]: number } = {};
private selectedDetailLayerIds: string[] = [];
private selectedDetailSourceIds: string[] = [];
selectedRouteDetails: any = null;
  
// store route geometry and markers by rId
routes: { [rId: string]: RouteData } = {};
sidebarCollapsed = false;
  clusteringEnabled = true;
  private enabledRouteIds = new Set<string>();
  private hasFilterState = false;

  private readonly resizeListener = () => {
    if (this.map) {
      this.map.resize();
    }
  };

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
  private routeClusteringService: RouteClusteringService,
  private fruitIconService: FruitIconService,
  private activatedRoute: ActivatedRoute
  ) {
    // Configure route clustering callback
    this.routeClusteringService.onRouteSelected = (routeId: string) => {
      this.zone.run(() => {
        this.selectRoute(routeId);
      });
    };

    // Configure route data provider for enhanced tooltips
    this.routeClusteringService.setRouteDataProvider((rId: string) => this.getRouteHoverData(rId));

    // Configure route drawing service for vehicle tooltips
    this.routeDrawingService.setRouteDataProvider((rId: string) => this.getRouteHoverData(rId));

    this.routeDrawingService.onVehicleHoverChanged = (isHovering: boolean, rId: string) => {
      this.zone.run(() => this.handleRouteHover(isHovering, rId));
    };

    this.routeClusteringService.onRouteHoverChanged = (isHovering: boolean, rId: string) => {
      this.zone.run(() => this.handleRouteHover(isHovering, rId));
    };

    // Configure vehicle selection callback
    this.routeDrawingService.onVehicleSelected = (routeId: string) => {
      this.zone.run(() => {
        this.selectRoute(routeId);
      });
    };
  }
  
  ngOnInit() {}
  
  ngAfterViewInit() {
    this.map = this.mapService.initializeMap('map');
    window.addEventListener('resize', this.resizeListener);

    this.map.on('load', async () => {
      await this.mapIconService.loadIcons(this.map);
      this.addColombiaOutline();
      this.map.resize();

      const slugs = this.fruitIconService.getAllSlugs();
      await this.mapIconService.loadFruitIcons(this.map, slugs);
      
      // Load existing active routes on startup (snapshot)
      this.rs.snapshot().subscribe((list: any[]) => {
        this.zone.run(() => {
          this.loadingInitialSnapshot = true;
          (list || []).forEach((r: any) => {
            // Update meta first so panel data is available
            this.upsertRouteMeta(r);
            this.drawRoute(r);
          });
          this.loadingInitialSnapshot = false;

          const rId = this.activatedRoute.snapshot.queryParamMap.get('rId');
          if (rId) {
            // Mismo flujo que seleccionar desde el panel: centrar en la ruta específica
            // sin pasar primero por fitToVisibleRoutes (evita animaciones en conflicto).
            // animateCamera:false → jumpTo instantáneo, sin vuelo desde Colombia.
            this.selectRoute(rId, false);
          } else {
            this.fitToVisibleRoutes();
          }
        });
      });

      this.map.on('zoomend', () => {
        this.zone.run(() => {
          if (this.clusteringEnabled) {
            this.updateClustering();
          }
        });
      });

      // Connect to SSE for real-time updates
      this.us.connect();
      this.us.onUpdate().subscribe((evt: any) => {
        // evt: {type: string, data: any}
        this.zone.run(() => {
          const rId = evt?.data?.rId || evt?.data?.routeId || evt?.data?.id;

          if (evt?.notificationType === NotificationType.Started || evt?.type === 'route_started') {
            if (!rId) return;

            this.drawRoute(evt.data);
            this.upsertRouteMeta(evt.data);
            this.rs.upsertRouteFromUpdate(evt);
            setTimeout(() => {
              this.rs.snapshot().subscribe((list: any[]) => {
                this.zone.run(() => {
                  const newRoute = list.find((r: any) => (r.rId || r.id) === rId);
                  if (newRoute) {
                    this.upsertRouteMeta(newRoute);
                    this.rs.upsertRoute(newRoute);
                  }
                });
              });
            }, 1500);
          } else if (evt.type === 'route_updated' || evt.type === 'pos_update') {
            this.updateVehicle(evt.data);
            this.rs.upsertRouteFromUpdate(evt);
          } else if (evt.type === 'route_finished' || evt.type === 'route_stopped') {
            this.upsertRouteMeta(evt.data);
            this.rs.upsertRouteFromUpdate(evt);
          }
        });
      });
    });
  }

  private upsertRouteMeta(r: any) {
    const rId = r.rId || r.id || r.routeId;
    if (!rId) return;

    this.routeLastReportTs[rId] = this.resolveReportTimestamp(r) || this.routeLastReportTs[rId] || Date.now();
    
    const existingIdx = this.routeList.findIndex(x => x.rId === rId);
    const existing: any = existingIdx >= 0 ? this.routeList[existingIdx] : null;
    const entry = this.routes[rId];
    
    const load = r.load || existing?.load || null;

    this.routeDrawingService.setRouteLoad(rId, load);
      const destObj = r.dest && typeof r.dest === 'object' && !Array.isArray(r.dest)
      ? r.dest
      : (existingIdx >= 0 ? this.routeList[existingIdx].dest : null);
    const rawStatus = r.status || r.type;
    const statusFromEvent = typeof rawStatus === 'string' ? rawStatus.toLowerCase() : '';
    const status =
      statusFromEvent === 'started' ? 'active' :
      statusFromEvent === 'stopped' ? 'stopped' :
      statusFromEvent === 'finished' ? 'finished' :
      statusFromEvent || entry?.status || 'active';
    const start = (r.coordinates && r.coordinates[0]) || entry?.coords?.[0] || null;
    const current = (this.routes[rId]?.currentVehiclePos) || (r.coordinates ? r.coordinates[r.coordinates.length - 1] : entry?.coords?.[entry?.coords.length - 1]);
    
    const meta = {
      rId,
      name: r.name || `Ruta ${rId}`,
      status,
      load,
      dest: destObj,
      start,
      current,
      origin: r.origin?.name || r.origin || r.provider || existing?.origin || existing?.supplier || 'N/D',
      supplier: r.provider || (existingIdx >= 0 ? this.routeList[existingIdx].supplier : null),
      plate: r.vehicle || (existingIdx >= 0 ? this.routeList[existingIdx].plate : null),
      driver: (typeof r.driver === 'object' ? r.driver?.driver : r.driver) || existing?.driver || 'N/D',
      progress: typeof r.progress === 'number' ? r.progress : (existing?.progress ?? null),
      etaS: r.dest?.estimated_durationS || existing?.etaS || null,
      startTs: r.startTs || (existingIdx >= 0 ? this.routeList[existingIdx].startTs : null),
    };
    
    if (existingIdx >= 0) this.routeList[existingIdx] = { ...this.routeList[existingIdx], ...meta };
    else this.routeList.unshift(meta);
    
    this.updateCounters();
    
    // Force Angular change detection
    this.cdr.detectChanges();
  }

  private getRouteHoverData(rId: string) {
    const routeData = this.routes[rId];
    const metaData: any = this.routeList.find(r => r.rId === rId) || {};

    return {
      rId,
      name: metaData.name || `Ruta ${rId}`,
      status: metaData.status || routeData?.status || 'active',
      origin: metaData.origin || metaData.supplier || 'N/D',
      destination: metaData.dest?.name || metaData.route || 'N/D',
      etaS: metaData.dest?.estimated_durationS || metaData.etaS,
      startTs: metaData.startTs || null,
      driver: metaData.driver || 'N/D',
      plate: metaData.plate || 'N/D',
      progress: typeof metaData.progress === 'number' ? metaData.progress : null,
      lastReportTs: this.routeLastReportTs[rId] || null
    };
  }

  formatArrivalTime(startTs?: number, estimatedDurationS?: number): string {
    if (!startTs || !estimatedDurationS) return '';
    const startMs = startTs > 1e12 ? startTs : startTs * 1000;
    const arrivalMs = startMs + estimatedDurationS * 1000;
    const start = new Date(startMs);
    const arrival = new Date(arrivalMs);
    const nextDay = arrival.getDate() !== start.getDate() || arrival.getMonth() !== start.getMonth();
    const timeStr = arrival.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
    return nextDay ? `${timeStr} +1` : timeStr;
  }

  private handleRouteHover(isHovering: boolean, rId: string) {
    if (isHovering && rId) {
      this.hoveredRouteData = this.getRouteHoverData(rId);
      this.cdr.detectChanges();
    } else {
      this.hoveredRouteData = null;
      this.cdr.detectChanges();
    }
  }

  formatDuration(seconds?: number): string {
    if (!seconds || typeof seconds !== 'number') return 'N/D';

    const totalMinutes = Math.round(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
  }

  formatElapsed(timestampMs?: number): string {
    if (!timestampMs || typeof timestampMs !== 'number') return 'N/D';

    const diffMs = Date.now() - timestampMs;
    if (diffMs < 0) return 'N/D';

    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s`;

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;

    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return `${hours}h ${mins}m`;
  }

  private resolveReportTimestamp(data: any): number | null {
    if (!data) return null;

    const rawTs = data.ts ?? data.updatedAt ?? data.updateTs ?? data.lastReportTs ?? data.lastSeenTs;
    if (typeof rawTs !== 'number') return null;

    return rawTs > 1e12 ? rawTs : rawTs * 1000;
  }

  private updateCounters() {
    this.activeCount = this.routeList.filter(r => (r.status || 'active') === 'active').length;
    this.pausedCount = this.routeList.filter(r => (r.status || 'stopped') === 'stopped').length;
  }

  drawRoute(route: any) {
    const rId = route.rId || route.id || route.routeId;
    if (!rId) return;
    
    const load = route.loadInfo?.load || route.load;
    this.routeDrawingService.setRouteLoad(rId, load);
    
    // Parse coordinates using service
    const coords = this.routeDrawingService.parseRouteCoordinates(route);

    if (coords.length === 0) {
      this.routes[rId] = this.routes[rId] || { coords: [], lineId: `line-${rId}` };
      this.routes[rId].status = route.status || 'active';

      const fallbackPos = this.extractPosition(route);
      if (fallbackPos) {
        this.routes[rId].currentVehiclePos = fallbackPos;
        this.placeOrMoveVehicle(rId, fallbackPos);
      }

      this.upsertRouteMeta({ ...route, rId, coordinates: fallbackPos ? [fallbackPos] : [] });

      if (this.clusteringEnabled) {
        setTimeout(() => this.updateClustering(), 50);
      }

      this.syncRouteVisualState();
      return;
    }
    
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

    this.routes[rId].fitted = true;

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

    this.syncRouteVisualState();
  }

  private extractPosition(data: any): [number, number] | null {
    let pos: number[] | null = null;

    if (Array.isArray(data?.coordinates) && data.coordinates.length === 2 && typeof data.coordinates[0] === 'number') {
      pos = data.coordinates;
    }
    if (data?.current && Array.isArray(data.current) && data.current.length >= 2) pos = data.current;
    else if (data?.pos && Array.isArray(data.pos) && data.pos.length >= 2) pos = data.pos;
    else if (data?.position && Array.isArray(data.position) && data.position.length >= 2) pos = data.position;
    else if (data?.lat && data?.lng) pos = [data.lng, data.lat];
    else if (data?.latitude && data?.longitude) pos = [data.longitude, data.latitude];

    if (!pos) return null;
    return this.coordinateService.toLngLat(pos);
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

    const entry = this.routes[rId] || (this.routes[rId] = { coords: [], lineId: `line-${rId}`, rId });

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

      // Queue vehicle movements with animation
      points.forEach(p => {
        this.vehicleAnimationService.queueVehicleMovement(rId, p, this.routes[rId]);
      });

      // Update panel meta with latest current position
      const current = entry?.currentVehiclePos || entry?.coords?.[entry.coords.length - 1];
      this.upsertRouteMeta({ rId, dest: entry?.dest, coordinates: entry?.coords, status: update.status, current });

      // Update clustering after vehicle movement
      if (this.clusteringEnabled) {
        setTimeout(() => this.updateClustering(), 100);
      }

      this.syncRouteVisualState();
    }
  }

  private setLayerVisibility(layerId: string, visibility: 'visible' | 'none') {
    if (!this.map?.getLayer(layerId)) return;
    this.map.setLayoutProperty(layerId, 'visibility', visibility);
  }

  private syncRouteVisualState() {
    const selectedId = this.selectedRouteId;

    Object.keys(this.routes).forEach(rId => {
      const isEnabledByFilter = !this.hasFilterState || this.enabledRouteIds.has(rId);
      const isSelected = selectedId === rId;
      const isClusteredAndCollapsed =
        this.clusteringEnabled &&
        !selectedId &&
        this.routeClusteringService.isRouteInCluster(rId) &&
        !this.routeClusteringService.isRouteInExpandedCluster(rId);
      const detailVisibility: 'visible' | 'none' = isSelected ? 'visible' : 'none';
      const vehicleVisibility: 'visible' | 'none' =
        isSelected
          ? 'visible'
          : (!selectedId && isEnabledByFilter && !isClusteredAndCollapsed)
            ? 'visible'
            : 'none';

      this.setLayerVisibility(`layer-${rId}`, detailVisibility);
      this.setLayerVisibility(`layer-start-${rId}`, detailVisibility);
      this.setLayerVisibility(`layer-dest-${rId}`, detailVisibility);
      this.setLayerVisibility(`layer-vehicle-${rId}`, vehicleVisibility);
    });
  }

  private clearSelectedRouteDetailLayers() {
    this.selectedDetailLayerIds.forEach(layerId => {
      if (this.map?.getLayer(layerId)) {
        this.map.removeLayer(layerId);
      }
    });
    this.selectedDetailSourceIds.forEach(sourceId => {
      if (this.map?.getSource(sourceId)) {
        this.map.removeSource(sourceId);
      }
    });
    this.selectedDetailLayerIds = [];
    this.selectedDetailSourceIds = [];
  }

  private registerDetailOverlay(layerId: string, sourceId: string) {
    this.selectedDetailLayerIds.push(layerId);
    this.selectedDetailSourceIds.push(sourceId);
  }

  private drawPolylineLayer(sourceId: string, layerId: string, coords: number[][], paint: any, layout?: any) {
    if (!coords || coords.length < 2) return;

    this.map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {}
      }
    });

    this.map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      paint,
      layout: layout ?? {}
    });

    this.registerDetailOverlay(layerId, sourceId);
  }

  private drawStopMarker(routeId: string, idx: number, position: [number, number]) {
    const sourceId = `selected-stop-${routeId}-${idx}`;
    const layerId = `selected-stop-layer-${routeId}-${idx}`;
    this.routeDrawingService.addMarker(this.map, sourceId, layerId, position, 'stop-marker');
    this.registerDetailOverlay(layerId, sourceId);
  }

  private normalizeRecommendedRoutes(payload: any): Record<string, any[]> {
    const normalized: Record<string, any[]> = {};
    const source = payload?.recommendedRoutes || payload?.recommendations || {};

    Object.keys(source).forEach(providerName => {
      const raw = source[providerName];

      if (Array.isArray(raw)) {
        normalized[providerName] = raw;
        return;
      }

      if (raw?.polyline) {
        normalized[providerName] = [raw];
        return;
      }

      if (raw?.remainingPolyline) {
        normalized[providerName] = [{ polyline: raw.remainingPolyline }];
        return;
      }

      if (raw && typeof raw === 'object') {
        const nestedVariants = Object.values(raw)
          .map((item: any) => item?.polyline ? item : (item?.remainingPolyline ? { polyline: item.remainingPolyline } : null))
          .filter((item: any) => !!item);
        if (nestedVariants.length > 0) {
          normalized[providerName] = nestedVariants as any[];
        }
      }
    });

    if (Object.keys(normalized).length === 0) {
      const remainingRecommendations = payload?.progress?.remaining || {};
      Object.keys(remainingRecommendations).forEach(providerName => {
        const remainingPolyline = remainingRecommendations?.[providerName]?.remainingPolyline;
        if (!remainingPolyline) return;
        normalized[providerName] = [{ polyline: remainingPolyline }];
      });
    }

    return normalized;
  }

  private renderSelectedRouteDetails(routeId: string, details: any) {
    if (this.selectedRouteId !== routeId) return;

    this.clearSelectedRouteDetailLayers();

    const payload = details?.route || details?.data || details || {};
    const segments = Array.isArray(payload?.segments) ? payload.segments : [];

    const recommendedRoutes = this.normalizeRecommendedRoutes(payload);

    // Resolve best traveled polyline: hybrid > snapped > real
    const traveledPolylineObj = payload?.progress?.traveledPolyline;
    const traveledPolylineStr = typeof traveledPolylineObj === 'string'
      ? traveledPolylineObj
      : (traveledPolylineObj?.hybrid || traveledPolylineObj?.snapped || traveledPolylineObj?.real);
    const traveledPolyline = traveledPolylineStr || payload?.realPolyline || payload?.polyline;
    const traveledCoords = this.routeDrawingService.parseRouteCoordinates({ polyline: traveledPolyline });

    if (traveledCoords.length > 1) {
      // Hide the base route line (snapshot) — replaced by the hybrid traveled line
      this.setLayerVisibility(`layer-${routeId}`, 'none');

      this.drawPolylineLayer(
        `selected-traveled-${routeId}`,
        `selected-traveled-layer-${routeId}`,
        traveledCoords,
        {
          'line-color': '#306C2D',
          'line-width': 5,
          'line-opacity': 0.95
        }
      );

      // Snap each stopped segment's raw GPS start point to the hybrid polyline and draw marker
      segments.forEach((segment: any, idx: number) => {
        if ((segment?.type || '').toLowerCase() !== 'stopped') return;
        const rawCoords = this.routeDrawingService.parseRouteCoordinates({ polyline: segment?.polyline });
        if (rawCoords.length < 1) return;
        const snappedPoint = this.snapPointToPolyline(rawCoords[0] as [number, number], traveledCoords);
        this.drawStopMarker(routeId, idx, snappedPoint);
      });

      // Draw remaining route to destination from progress.remaining (blue dotted)
      const remaining = payload?.progress?.remaining || {};
      const firstRemainingProvider = Object.keys(remaining)[0];
      const remainingPolyline = firstRemainingProvider ? remaining[firstRemainingProvider]?.remainingPolyline : null;
      if (remainingPolyline) {
        const remainingCoords = this.routeDrawingService.parseRouteCoordinates({ polyline: remainingPolyline });
        if (remainingCoords.length > 1) {
          this.drawPolylineLayer(
            `selected-remaining-${routeId}`,
            `selected-remaining-layer-${routeId}`,
            remainingCoords,
            {
              'line-color': '#2563EB',
              'line-width': 5,
              'line-opacity': 0.85,
              'line-dasharray': [2, 2]
            }
          );
        }
      }
    } else if (segments.length > 0) {
      // Fallback: no hybrid polyline available, use all segment lines
      segments.forEach((segment: any, idx: number) => {
        const coords = this.routeDrawingService.parseRouteCoordinates({ polyline: segment?.polyline });
        if (coords.length < 2) return;
        const isStopped = (segment?.type || '').toLowerCase() === 'stopped';
        const sourceId = `selected-segment-${routeId}-${idx}`;
        const layerId = `selected-segment-layer-${routeId}-${idx}`;
        this.drawPolylineLayer(sourceId, layerId, coords, {
          'line-color': isStopped ? '#BE0000' : '#306C2D',
          'line-width': isStopped ? 5 : 4,
          'line-opacity': 0.95
        });
        if (isStopped) {
          this.drawStopMarker(routeId, idx, coords[0] as [number, number]);
        }
      });

      // Draw recommended route as blue dotted line (fallback when no hybrid)
      const allProviderNames = Object.keys(recommendedRoutes);
      const googleProvider = allProviderNames.find(k => k.toLowerCase().includes('google'));
      const selectedProvider = googleProvider ?? allProviderNames[0];

      if (selectedProvider) {
        const variants = Array.isArray(recommendedRoutes[selectedProvider]) ? recommendedRoutes[selectedProvider] : [];
        const providerKey = selectedProvider.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

        variants.forEach((variant: any, idx: number) => {
          const coords = this.routeDrawingService.parseRouteCoordinates({ polyline: variant?.polyline });
          if (coords.length < 2) return;

          this.drawPolylineLayer(
            `selected-rec-${providerKey}-${routeId}-${idx}`,
            `selected-rec-layer-${providerKey}-${routeId}-${idx}`,
            coords,
            {
              'line-color': '#2563EB',
              'line-width': 5,
              'line-opacity': 0.85,
              'line-dasharray': [2, 2]
            }
          );
        });
      }
    }
  }

  private snapPointToPolyline(point: [number, number], polyline: number[][]): [number, number] {
    let minDistSq = Infinity;
    let closest: [number, number] = polyline[0] as [number, number];
    for (let i = 0; i < polyline.length - 1; i++) {
      const a = polyline[i] as [number, number];
      const b = polyline[i + 1] as [number, number];
      const ax = b[0] - a[0], ay = b[1] - a[1];
      const lenSq = ax * ax + ay * ay;
      const t = lenSq > 0 ? Math.max(0, Math.min(1, ((point[0] - a[0]) * ax + (point[1] - a[1]) * ay) / lenSq)) : 0;
      const cx = a[0] + t * ax, cy = a[1] + t * ay;
      const distSq = (point[0] - cx) * (point[0] - cx) + (point[1] - cy) * (point[1] - cy);
      if (distSq < minDistSq) {
        minDistSq = distSq;
        closest = [cx, cy];
      }
    }
    return closest;
  }

  /**
   * Update route clustering based on current vehicle positions
   */
  private updateClustering() {
    if (!this.map || !this.clusteringEnabled || !!this.selectedRouteId) return;

    const routesToCluster: { [rId: string]: RouteData } = {};
    Object.keys(this.routes).forEach(rId => {
      if (this.hasFilterState && !this.enabledRouteIds.has(rId)) return;
      routesToCluster[rId] = this.routes[rId];
    });

    this.routeClusteringService.clusterRoutes(this.map, routesToCluster);
    this.syncRouteVisualState();
  }

  private fitToVisibleRoutes(routeIds?: Set<string>) {
    if (!this.map) return;

    const allPoints: [number, number][] = [];

    Object.keys(this.routes).forEach(rId => {
      if (routeIds && routeIds.size > 0 && !routeIds.has(rId)) return;

      const entry = this.routes[rId];
      if (entry.currentVehiclePos && entry.currentVehiclePos.length >= 2) {
        allPoints.push([entry.currentVehiclePos[0], entry.currentVehiclePos[1]]);
      }

      if (entry.dest && entry.dest.length >= 2) {
        allPoints.push([entry.dest[0], entry.dest[1]]);
      }

      if (entry.coords && entry.coords.length > 0) {
        const first = entry.coords[0];
        const last = entry.coords[entry.coords.length - 1];
        if (first?.length >= 2) allPoints.push([first[0], first[1]]);
        if (last?.length >= 2) allPoints.push([last[0], last[1]]);
      }
    });

    if (allPoints.length === 0) return;

    const bounds = new maplibregl.LngLatBounds(allPoints[0], allPoints[0]);
    allPoints.forEach(p => bounds.extend(p));
    this.mapService.fitBounds(bounds, { padding: 70, maxZoom: 13, duration: 900 });
  }

  /**
   * Select a route (from cluster, panel or vehicle click)
   * @param animateCamera false = jumpTo instantáneo (usado al llegar por querystring)
   */
  private selectRoute(routeId: string, animateCamera: boolean = true) {

    let clusterCenter: [number, number] | null = null;
    if (this.clusteringEnabled) {
      clusterCenter = this.routeClusteringService.getClusterPositionByRouteId(routeId);
    }

    // Always clear all clusters when selecting a route so only the selected
    // route remains visible on the map (covers card click, vehicle click and
    // cluster-vehicle click in one place).
    if (this.clusteringEnabled) {
      this.routeClusteringService.clearClusters(this.map);
    }

    this.finalizeRouteSelection(routeId, clusterCenter, animateCamera);
  }

  private clearRouteSelection(recluster: boolean = true) {
    const previouslySelectedRouteId = this.selectedRouteId;
    this.selectedRouteId = null;
    this.rs.selectRoute('');
    this.clearSelectedRouteDetailLayers();
    this.selectedRouteDetails = null;
    this.routeDrawingService.setSelectedRoute(null);

    if (previouslySelectedRouteId) {
      const previousEntry = this.routes[previouslySelectedRouteId];
      if (previousEntry?.coords?.length > 1) {
        this.routeDrawingService.drawRouteLine(this.map, previouslySelectedRouteId, previousEntry.coords);
      }
      const previousPos = previousEntry?.currentVehiclePos || previousEntry?.coords?.[previousEntry.coords.length - 1];
      if (previousPos) {
        this.placeOrMoveVehicle(previouslySelectedRouteId, previousPos);
      }
    }

    this.syncRouteVisualState();

    if (recluster && this.clusteringEnabled) {
      this.updateClustering();
    }
  }

  /**
   * Finalize route selection after cluster expansion (if needed)
   * @param animateCamera false = jumpTo instantáneo, true = flyTo animado (default)
   */
  private finalizeRouteSelection(routeId: string, clusterCenter: [number, number] | null = null, animateCamera: boolean = true) {
    this.selectedRouteId = routeId;
    this.rs.selectRoute(routeId);
    this.clearSelectedRouteDetailLayers();
    this.selectedRouteDetails = null;
    const entry = this.routes[routeId];
    const currentPos = entry?.currentVehiclePos || entry?.coords?.[entry.coords.length - 1] || null;
    // cameraPos uses the cluster centroid so the camera moves to where the user clicked,
    // but the vehicle marker must always use the actual vehicle position (currentPos).
    // When animateCamera=false (URL nav), always center on the actual vehicle position.
    const cameraPos = animateCamera ? (clusterCenter || currentPos) : currentPos;

    if (entry?.coords?.length > 1) {
      const coordsToRender = [...entry.coords];
      const lastCoord = coordsToRender[coordsToRender.length - 1];
      if (
        currentPos &&
        (!lastCoord || lastCoord[0] !== currentPos[0] || lastCoord[1] !== currentPos[1])
      ) {
        coordsToRender.push([currentPos[0], currentPos[1]]);
      }

      this.routeDrawingService.drawRouteLine(this.map, routeId, coordsToRender);
    }

    if (currentPos) {
      this.placeOrMoveVehicle(routeId, currentPos);
    }

    // Update vehicle selection in drawing service
    this.routeDrawingService.setSelectedRoute(routeId);
    this.syncRouteVisualState();

    const pos = cameraPos;
    if (pos) {
      if (animateCamera) {
        this.map.flyTo({
          center: pos as [number, number],
          zoom: 14,
          speed: 0.1,
          curve: 1.2,
          duration: 900,
          essential: true
        });
      } else {
        this.map.jumpTo({ center: pos as [number, number], zoom: 14 });
      }
    }

    // Get route details
    this.rs.details(routeId).subscribe({
      next: (details: any) => {
        const fromSnapshot = this.routeList.find(r => r.rId === routeId);
        this.selectedRouteDetails = { ...(fromSnapshot || {}), ...(details || {}) };

        const remaining = details?.progress?.remaining || {};
        const firstProvider = Object.keys(remaining)[0];
        const progressPercent = firstProvider != null ? remaining[firstProvider]?.progressPercent : undefined;
        if (progressPercent !== undefined) {
          const idx = this.routeList.findIndex(r => r.rId === routeId);
          if (idx >= 0) {
            this.routeList[idx] = { ...this.routeList[idx], progress: progressPercent };
          }
        }

        this.renderSelectedRouteDetails(routeId, details);
        this.cdr.detectChanges();
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
  selectFromList(route: RouteCardData | null) {
    if (!route || this.selectedRouteId === route.rId) {
      this.clearRouteSelection(true);
      return;
    }

    this.selectRoute(route.rId);
  }

  onFilteredRouteIdsChange(routeIds: string[]) {
    this.hasFilterState = true;
    this.enabledRouteIds = new Set(routeIds || []);

    if (this.selectedRouteId && !this.enabledRouteIds.has(this.selectedRouteId)) {
      this.clearRouteSelection();
      return;
    }

    this.syncRouteVisualState();

    if (this.clusteringEnabled && !this.selectedRouteId) {
      this.updateClustering();
    }

    if (!this.selectedRouteId && this.enabledRouteIds.size > 0) {
      this.fitToVisibleRoutes(this.enabledRouteIds);
    }
  }

  /**
   * Toggle panel visibility
   */
  togglePanel() {
    this.panelCollapsed = !this.panelCollapsed;
    setTimeout(() => {
      this.map?.resize();
    }, 420);
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.resizeListener);
  }

  private addColombiaOutline() {
    if (this.map.getSource('colombia-outline')) return;

    this.map.addSource('colombia-outline', {
      type: 'geojson',
      data: 'assets/geo/colombia.geo.json'
    });

    this.map.addLayer({
      id: 'colombia-fill',
      type: 'fill',
      source: 'colombia-outline',
      paint: {
        'fill-color': '#306C2D',
        'fill-opacity': 0.04
      }
    });

    this.map.addLayer({
      id: 'colombia-border',
      type: 'line',
      source: 'colombia-outline',
      paint: {
        'line-color': '#306C2D',
        'line-width': 2,
        'line-opacity': 0.6,
        'line-dasharray': [3, 2]
      }
    });
  }
  
}
