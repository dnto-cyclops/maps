import { Injectable } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { MapIconService } from './map-icon.service';
import { RouteData } from './route-drawing.service';

export interface RouteCluster {
  id: string;
  position: [number, number];
  routeIds: string[];
  isVisible: boolean;
  expanded: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class RouteClusteringService {
private clusters: { [clusterId: string]: RouteCluster } = {};
private expandedClusters = new Map<string, any>();
private clusterDistance = 50; // Distance in meters to group routes
private clusterPopup: maplibregl.Popup | null = null;
private routeDataProvider?: (rId: string) => any;
private currentHoverPopup: maplibregl.Popup | null = null;
private routeEventHandlers = new Map<string, any>();

constructor(private mapIconService: MapIconService) {}

  /**
   * Group routes by proximity and create clusters
   */
  clusterRoutes(map: maplibregl.Map, routes: { [rId: string]: RouteData }): RouteCluster[] {
    // Clear existing clusters
    this.clearClusters(map);

    const routePositions: { rId: string; position: [number, number] }[] = [];
    
    // Extract current positions for all routes
    Object.keys(routes).forEach(rId => {
      const route = routes[rId];
      const pos = route.currentVehiclePos || route.coords[route.coords.length - 1];
      if (pos) {
        routePositions.push({ rId, position: [pos[0], pos[1]] });
      }
    });

    const clusteredRoutes = new Set<string>();
    const newClusters: RouteCluster[] = [];

    // Group routes by proximity
    routePositions.forEach(routeA => {
      if (clusteredRoutes.has(routeA.rId)) return;

      const routesInCluster: string[] = [routeA.rId];
      clusteredRoutes.add(routeA.rId);

      routePositions.forEach(routeB => {
        if (clusteredRoutes.has(routeB.rId) || routeA.rId === routeB.rId) return;

        const distance = this.calculateDistance(routeA.position, routeB.position);
        if (distance <= this.clusterDistance) {
          routesInCluster.push(routeB.rId);
          clusteredRoutes.add(routeB.rId);
        }
      });

      // Create cluster if more than one route
      if (routesInCluster.length > 1) {
        const clusterId = `cluster-${Date.now()}-${Math.random()}`;
        const cluster: RouteCluster = {
          id: clusterId,
          position: routeA.position,
          routeIds: routesInCluster,
          isVisible: true,
          expanded: false
        };
        
        newClusters.push(cluster);
        this.clusters[clusterId] = cluster;
      }
    });

    // Add cluster markers to map
    newClusters.forEach(cluster => {
      this.addClusterMarker(map, cluster);
    });

    return newClusters;
  }

  /**
   * Add a cluster marker to the map
   */
  private async addClusterMarker(map: maplibregl.Map, cluster: RouteCluster) {
    const count = cluster.routeIds.length;
    
    // Create cluster icon
    await this.mapIconService.createClusterIcon(map, count);

    // Immediately expand cluster on creation - show individual markers in circle
    this.expandClusterImmediately(map, cluster);
  }

  /**
   * Handle cluster click - expand cluster automatically with zoom
   */
  private handleClusterClick(map: maplibregl.Map, cluster: RouteCluster, e: any) {
    // Close any existing popup
    if (this.clusterPopup) {
      this.clusterPopup.remove();
      this.clusterPopup = null;
    }

    // Already expanded, just highlight
    this.expandClusterWithZoom(map, cluster);
  }

  /**
   * Expand cluster immediately on creation (no need to click)
   */
  private expandClusterImmediately(map: maplibregl.Map, cluster: RouteCluster) {
    cluster.expanded = true;
    
    // Calculate appropriate spread radius
    const currentZoom = map.getZoom();
    const routeCount = cluster.routeIds.length;
    
    // Base radius in degrees
    let baseRadius = 0.0005;
    
    if (currentZoom < 12) {
      baseRadius = 0.001;
    } else if (currentZoom > 16) {
      baseRadius = 0.0003;
    }
    
    // Adjust radius based on number of routes
    const adjustedRadius = baseRadius * Math.max(1, Math.sqrt(routeCount / 3));

    // Add semi-transparent circular background FIRST (so it stays behind)
    this.addClusterBackground(map, cluster, adjustedRadius * 1.5);

    // Show individual route markers in a circle pattern
    const angleStep = (2 * Math.PI) / cluster.routeIds.length;
    const positions: { rId: string; position: [number, number] }[] = [];

    cluster.routeIds.forEach((rId, index) => {
      const angle = index * angleStep;
      const offsetX = Math.cos(angle) * adjustedRadius;
      const offsetY = Math.sin(angle) * adjustedRadius;
      
      const newPosition: [number, number] = [
        cluster.position[0] + offsetX,
        cluster.position[1] + offsetY
      ];

      positions.push({ rId, position: newPosition });
      this.showRouteMarkerAtPosition(map, rId, newPosition);
    });

    // Add center marker showing vehicle count and allowing collapse
    this.addClusterCenterMarker(map, cluster);

    // Ensure all vehicle markers are on top of the background
    // by moving them to the top layer order
    cluster.routeIds.forEach(rId => {
      const layerId = `layer-vehicle-${rId}`;
      if (map.getLayer(layerId)) {
        map.moveLayer(layerId);
      }
    });

    // Move center marker to top (above vehicles) so it's clickeable
    const centerLayerId = `cluster-center-layer-${cluster.id}`;
    if (map.getLayer(centerLayerId)) {
      map.moveLayer(centerLayerId);
    }

    // Store the expanded state
    this.expandedClusters.set(cluster.id, {
      ...cluster,
      expandedPositions: positions,
      backgroundRadius: adjustedRadius * 1.5
    });
  }

  /**
   * Expand cluster with automatic zoom for comfortable interaction
   */
  private expandClusterWithZoom(map: maplibregl.Map, cluster: RouteCluster) {
    // If already expanded, just focus on it
    if (cluster.expanded) {
      const expandedData = this.expandedClusters.get(cluster.id);
      if (expandedData && expandedData.expandedPositions) {
        // Calculate bounds for focus
        const bounds = new maplibregl.LngLatBounds();
        expandedData.expandedPositions.forEach(({ position }: any) => {
          bounds.extend(position);
        });
        
        map.fitBounds(bounds, {
          padding: 80,
          maxZoom: 17,
          duration: 600
        });
      }
      return;
    }

    cluster.expanded = true;
    
    // Remove any cluster marker if it exists
    const sourceId = `cluster-source-${cluster.id}`;
    const layerId = `cluster-layer-${cluster.id}`;
    
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }

    // Calculate appropriate spread radius based on zoom level and number of routes
    const currentZoom = map.getZoom();
    const routeCount = cluster.routeIds.length;
    
    // Base radius in degrees
    let baseRadius = 0.0005;
    
    if (currentZoom < 12) {
      baseRadius = 0.001;
    } else if (currentZoom > 16) {
      baseRadius = 0.0003;
    }
    
    // Adjust radius based on number of routes to avoid overlap
    const adjustedRadius = baseRadius * Math.max(1, Math.sqrt(routeCount / 3));

    // Add semi-transparent circular background FIRST (so it stays behind)
    this.addClusterBackground(map, cluster, adjustedRadius * 1.5);

    // Show individual route markers in a circle pattern
    const angleStep = (2 * Math.PI) / cluster.routeIds.length;
    const positions: { rId: string; position: [number, number] }[] = [];

    cluster.routeIds.forEach((rId, index) => {
      const angle = index * angleStep;
      const offsetX = Math.cos(angle) * adjustedRadius;
      const offsetY = Math.sin(angle) * adjustedRadius;
      
      const newPosition: [number, number] = [
        cluster.position[0] + offsetX,
        cluster.position[1] + offsetY
      ];

      positions.push({ rId, position: newPosition });
      this.showRouteMarkerAtPosition(map, rId, newPosition);
    });

    // Add center marker showing vehicle count and allowing collapse
    this.addClusterCenterMarker(map, cluster);

    // Ensure all vehicle markers are on top of the background
    // by moving them to the top layer order
    cluster.routeIds.forEach(rId => {
      const layerId = `layer-vehicle-${rId}`;
      if (map.getLayer(layerId)) {
        map.moveLayer(layerId);
      }
    });

    // Move center marker to top (above vehicles) so it's clickeable
    const centerLayerId = `cluster-center-layer-${cluster.id}`;
    if (map.getLayer(centerLayerId)) {
      map.moveLayer(centerLayerId);
    }

    // Calculate bounds for all expanded positions
    const bounds = new maplibregl.LngLatBounds();
    positions.forEach(({ position }) => {
      bounds.extend(position);
    });
    
    // Add some padding around the bounds
    const center = bounds.getCenter();
    const padding = adjustedRadius * 2;
    bounds.extend([center.lng - padding, center.lat - padding]);
    bounds.extend([center.lng + padding, center.lat + padding]);

    // Fit map to show all expanded markers with comfortable zoom
    map.fitBounds(bounds, {
      padding: 80,
      maxZoom: 17,
      duration: 800
    });

    // Store the expanded state
    this.expandedClusters.set(cluster.id, {
      ...cluster,
      expandedPositions: positions,
      backgroundRadius: adjustedRadius * 1.5
    });
  }

  /**
   * Expand cluster to show individual route markers (legacy method)
   */
  private expandCluster(map: maplibregl.Map, cluster: RouteCluster) {
    this.expandClusterWithZoom(map, cluster);
  }

  /**
   * Hide individual route marker
   */
  private hideRouteMarker(map: maplibregl.Map, rId: string) {
    const layerId = `layer-vehicle-${rId}`;
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', 'none');
    }
  }

  /**
   * Show individual route marker at original position
   */
  private showRouteMarker(map: maplibregl.Map, rId: string) {
    const layerId = `layer-vehicle-${rId}`;
    
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', 'visible');
      
      // Add hover effects for route details
      this.addHoverTooltip(map, layerId, rId);
    }
  }

  /**
   * Show individual route marker at a specific position (for cluster expansion)
   */
  private showRouteMarkerAtPosition(map: maplibregl.Map, rId: string, position: [number, number]) {
    const layerId = `layer-vehicle-${rId}`;
    const sourceId = `vehicle-${rId}`;

    // Ensure source exists
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: position
          },
          properties: { rId }
        }
      });
      
      // Create layer if it doesn't exist
      if (!map.getLayer(layerId)) {
        map.addLayer({
          id: layerId,
          type: 'symbol',
          source: sourceId,
          layout: {
            'icon-image': 'vehicle-icon',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-size': 1.2,
            'icon-anchor': 'bottom'
          }
        });
      }
    }

    // Update position
    (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: position
      },
      properties: { rId }
    });

    // Make visible
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', 'visible');
      
      // Add hover effects for route details
      this.addHoverTooltip(map, layerId, rId);
    }
  }

  /**
   * Add hover tooltip to route marker
   */
  private addHoverTooltip(map: maplibregl.Map, layerId: string, rId: string) {
    // Store event handlers to properly remove them later
    const eventHandlers = {
      mouseenter: (e: any) => {
        map.getCanvas().style.cursor = 'pointer';
        
        if (this.currentHoverPopup) {
          this.currentHoverPopup.remove();
        }
        
        const coordinates = (e.features![0].geometry as any).coordinates.slice();
        
        // Create tooltip content
        const tooltipContent = this.createRouteTooltip(rId);
        
        this.currentHoverPopup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: 'route-hover-tooltip'
        })
        .setLngLat(coordinates)
        .setHTML(tooltipContent)
        .addTo(map);
      },

      mouseleave: () => {
        map.getCanvas().style.cursor = '';
        if (this.currentHoverPopup) {
          this.currentHoverPopup.remove();
          this.currentHoverPopup = null;
        }
      },

      click: (e: any) => {
        if (this.currentHoverPopup) {
          this.currentHoverPopup.remove();
        }
        this.selectRouteFromCluster(rId);
      }
    };

    // Remove existing listeners if they exist
    const existingHandlers = this.routeEventHandlers.get(layerId);
    if (existingHandlers) {
      map.off('mouseenter', layerId, existingHandlers.mouseenter);
      map.off('mouseleave', layerId, existingHandlers.mouseleave);  
      map.off('click', layerId, existingHandlers.click);
    }

    // Add new listeners
    map.on('mouseenter', layerId, eventHandlers.mouseenter);
    map.on('mouseleave', layerId, eventHandlers.mouseleave);
    map.on('click', layerId, eventHandlers.click);

    // Store handlers for future removal
    this.routeEventHandlers.set(layerId, eventHandlers);
  }

  /**
   * Add semi-transparent circular background for expanded cluster
   * This creates a subtle background circle that stays behind all vehicle markers
   * Now with a black border to clearly identify it as a cluster
   */
  private addClusterBackground(map: maplibregl.Map, cluster: RouteCluster, radius: number) {
    const backgroundSourceId = `cluster-bg-${cluster.id}`;
    const backgroundLayerId = `cluster-bg-layer-${cluster.id}`;

    // Create circle polygon for background
    const circleCoords = this.createCircleCoordinates(cluster.position, radius, 64);
    
    if (!map.getSource(backgroundSourceId)) {
      map.addSource(backgroundSourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [circleCoords]
          },
          properties: {
            clusterId: cluster.id
          }
        }
      });
    }

    if (!map.getLayer(backgroundLayerId)) {
      map.addLayer({
        id: backgroundLayerId,
        type: 'fill',
        source: backgroundSourceId,
        paint: {
          'fill-color': '#e0e7ff',
          'fill-opacity': 0.08,  // Very low opacity - just a hint of background
          'fill-outline-color': '#000000'  // Black border to identify cluster
        }
      }, undefined);  // Add at bottom so other layers appear on top
    }
  }

  /**
   * Create circle coordinates for polygon
   */
  private createCircleCoordinates(center: [number, number], radius: number, points: number = 64): number[][] {
    const coords: number[][] = [];
    
    for (let i = 0; i < points; i++) {
      const angle = (i * 2 * Math.PI) / points;
      const x = center[0] + Math.cos(angle) * radius;
      const y = center[1] + Math.sin(angle) * radius;
      coords.push([x, y]);
    }
    
    // Close the polygon
    coords.push(coords[0]);
    return coords;
  }

  /**
   * Collapse an expanded cluster back to single cluster marker
   */
  private collapseCluster(map: maplibregl.Map, cluster: RouteCluster) {
    cluster.expanded = false;

    // Remove background circle
    const backgroundSourceId = `cluster-bg-${cluster.id}`;
    const backgroundLayerId = `cluster-bg-layer-${cluster.id}`;
    if (map.getLayer(backgroundLayerId)) {
      map.removeLayer(backgroundLayerId);
    }
    if (map.getSource(backgroundSourceId)) {
      map.removeSource(backgroundSourceId);
    }

    // Remove center marker
    const centerSourceId = `cluster-center-${cluster.id}`;
    const centerLayerId = `cluster-center-layer-${cluster.id}`;
    if (map.getLayer(centerLayerId)) {
      map.removeLayer(centerLayerId);
    }
    if (map.getSource(centerSourceId)) {
      map.removeSource(centerSourceId);
    }

    // Hide all vehicle markers that were part of this cluster
    cluster.routeIds.forEach(rId => {
      this.hideRouteMarker(map, rId);
    });

    // Remove event handlers for vehicle markers
    cluster.routeIds.forEach(rId => {
      const layerId = `layer-vehicle-${rId}`;
      const existingHandlers = this.routeEventHandlers.get(layerId);
      if (existingHandlers && map.getLayer(layerId)) {
        map.off('mouseenter', layerId, existingHandlers.mouseenter);
        map.off('mouseleave', layerId, existingHandlers.mouseleave);
        map.off('click', layerId, existingHandlers.click);
      }
      this.routeEventHandlers.delete(layerId);
    });

    // Re-add cluster marker instead of hiding markers
    this.addClusterMarker(map, cluster);

    // Remove expanded state
    this.expandedClusters.delete(cluster.id);
  }

  /**
   * Add center marker for expanded cluster showing vehicle count
   */
  private addClusterCenterMarker(map: maplibregl.Map, cluster: RouteCluster) {
    const centerSourceId = `cluster-center-${cluster.id}`;
    const centerLayerId = `cluster-center-layer-${cluster.id}`;
    const count = cluster.routeIds.length;

    if (!map.getSource(centerSourceId)) {
      map.addSource(centerSourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: cluster.position
          },
          properties: {
            clusterId: cluster.id,
            count: count,
            isClusterCenter: true
          }
        }
      });
    }

    // Ensure cluster center icon exists
    if (!map.hasImage(`cluster-center-${count}`)) {
      this.mapIconService.createClusterIcon(map, count);
    }

    if (!map.getLayer(centerLayerId)) {
      map.addLayer({
        id: centerLayerId,
        type: 'symbol',
        source: centerSourceId,
        layout: {
          'icon-image': `cluster-${count}`,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-size': 1.2,  // Slightly larger for better click target
          'icon-anchor': 'bottom'
        }
      });

      // Store the handler so we can clean it up later
      const clickHandler = () => {
        this.collapseCluster(map, cluster);
      };

      const mouseEnterHandler = () => {
        map.getCanvas().style.cursor = 'pointer';
      };

      const mouseLeaveHandler = () => {
        map.getCanvas().style.cursor = '';
      };

      // Add handlers
      map.on('click', centerLayerId, clickHandler);
      map.on('mouseenter', centerLayerId, mouseEnterHandler);
      map.on('mouseleave', centerLayerId, mouseLeaveHandler);

      // Store handlers for cleanup
      this.routeEventHandlers.set(`${centerLayerId}-click`, { clickHandler, mouseEnterHandler, mouseLeaveHandler });
    }
  }

  /**
   * Create tooltip content for route
   */
  private createRouteTooltip(rId: string): string {
    // Get route data if provider is available
    let routeData: any = null;
    if (this.routeDataProvider) {
      routeData = this.routeDataProvider(rId);
    }

    const routeName = routeData?.name || `Ruta ${rId}`;
    const status = routeData?.status || 'Activa';
    const destination = routeData?.dest ? '📍 Con destino' : '';
    
    return `
      <div class="route-tooltip">
        <div class="route-tooltip-header">
          <strong>${routeName}</strong>
          <span class="status-badge status-${status.toLowerCase()}">${status}</span>
        </div>
        <div class="route-tooltip-body">
          <div class="tooltip-info">
            ${destination ? `<div>${destination}</div>` : ''}
            <div>🚚 Vehículo activo</div>
            <div class="action-hint">👆 Click para seleccionar</div>
          </div>
        </div>
      </div>
      <style>
        .route-hover-tooltip .maplibregl-popup-content {
          padding: 10px 14px;
          border-radius: 8px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.15);
          font-size: 12px;
          border: 1px solid #e5e7eb;
          background: white;
        }
        .route-tooltip-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
          color: #1f2937;
        }
        .status-badge {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 12px;
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
        .route-tooltip-body {
          color: #6b7280;
          font-size: 11px;
        }
        .tooltip-info > div {
          margin: 3px 0;
          display: flex;
          align-items: center;
        }
        .action-hint {
          color: #3b82f6;
          font-weight: 500;
          margin-top: 6px;
          padding-top: 4px;
          border-top: 1px solid #f3f4f6;
        }
      </style>
    `;
  }

  /**
   * Clear all clusters from map
   */
  clearClusters(map: maplibregl.Map) {
    Object.keys(this.clusters).forEach(clusterId => {
      const sourceId = `cluster-source-${clusterId}`;
      const layerId = `cluster-layer-${clusterId}`;
      const backgroundSourceId = `cluster-bg-${clusterId}`;
      const backgroundLayerId = `cluster-bg-layer-${clusterId}`;
      const buttonSourceId = `cluster-btn-${clusterId}`;
      const buttonLayerId = `cluster-btn-layer-${clusterId}`;
      
      // Remove cluster marker
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }

      // Remove background
      if (map.getLayer(backgroundLayerId)) {
        map.removeLayer(backgroundLayerId);
      }
      if (map.getSource(backgroundSourceId)) {
        map.removeSource(backgroundSourceId);
      }

      // Remove collapse button
      if (map.getLayer(buttonLayerId)) {
        map.removeLayer(buttonLayerId);
      }
      if (map.getSource(buttonSourceId)) {
        map.removeSource(buttonSourceId);
      }

      // Show back individual markers
      const cluster = this.clusters[clusterId];
      cluster.routeIds.forEach(rId => {
        this.showRouteMarker(map, rId);
      });
    });

    // Clear expanded clusters
    this.expandedClusters.clear();
    
    // Clear event handlers
    this.routeEventHandlers.forEach((handlers, layerId) => {
      if (map.getLayer(layerId)) {
        map.off('mouseenter', layerId, handlers.mouseenter);
        map.off('mouseleave', layerId, handlers.mouseleave);
        map.off('click', layerId, handlers.click);
      }
    });
    this.routeEventHandlers.clear();
    
    this.clusters = {};
    
    if (this.clusterPopup) {
      this.clusterPopup.remove();
      this.clusterPopup = null;
    }

    if (this.currentHoverPopup) {
      this.currentHoverPopup.remove();
      this.currentHoverPopup = null;
    }
  }

  /**
   * Calculate distance between two coordinates in meters
   */
  private calculateDistance(pos1: [number, number], pos2: [number, number]): number {
    const R = 6371e3; // Earth's radius in meters
    const phi1 = pos1[1] * Math.PI / 180;
    const phi2 = pos2[1] * Math.PI / 180;
    const deltaPhi = (pos2[1] - pos1[1]) * Math.PI / 180;
    const deltaLambda = (pos2[0] - pos1[0]) * Math.PI / 180;

    const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Callback for when a route is selected from cluster popup
   */
  private selectRouteFromCluster(routeId: string) {
    // This will be set by the component using this service
    if (this.onRouteSelected) {
      this.onRouteSelected(routeId);
    }
  }

  /**
   * Callback function for route selection
   */
  public onRouteSelected?: (routeId: string) => void;

  /**
   * Set route data provider for enhanced tooltips
   */
  setRouteDataProvider(provider: (rId: string) => any) {
    this.routeDataProvider = provider;
  }

  /**
   * Set the clustering distance threshold
   */
  setClusterDistance(distance: number) {
    this.clusterDistance = distance;
  }

  /**
   * Get current clusters
   */
  getClusters(): RouteCluster[] {
    return Object.values(this.clusters);
  }

  /**
   * Check if a cluster is expanded
   */
  isClusterExpanded(clusterId: string): boolean {
    return this.expandedClusters.has(clusterId);
  }

  /**
   * Re-cluster expanded routes (useful for re-clustering after movements)
   */
  recheckClustering(map: maplibregl.Map, routes: { [rId: string]: RouteData }) {
    // Clear any expanded clusters that may no longer be valid
    this.expandedClusters.clear();
    
    // Re-run clustering
    this.clusterRoutes(map, routes);
  }

  /**
   * Find which cluster contains a specific route
   */
  findClusterByRouteId(rId: string): RouteCluster | null {
    for (const clusterId in this.clusters) {
      const cluster = this.clusters[clusterId];
      if (cluster.routeIds.includes(rId)) {
        return cluster;
      }
    }
    return null;
  }

  /**
   * Check if a route is currently in a cluster
   */
  isRouteInCluster(rId: string): boolean {
    return this.findClusterByRouteId(rId) !== null;
  }

  /**
   * Expand cluster containing specific route
   */
  expandClusterContainingRoute(map: maplibregl.Map, rId: string): boolean {
    const cluster = this.findClusterByRouteId(rId);
    if (cluster && !cluster.expanded) {
      console.log(`🎯 Auto-expanding cluster for route ${rId}:`, cluster);
      this.expandClusterWithZoom(map, cluster);
      return true;
    }
    return false;
  }
}
