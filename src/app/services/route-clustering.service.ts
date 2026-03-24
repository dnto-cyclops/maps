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
private clusterDistance = 60; // Distance in pixels to group routes
private clusterRenderVersion = 0;
private clusterPopup: maplibregl.Popup | null = null;
private routeDataProvider?: (rId: string) => any;
private currentHoverPopup: maplibregl.Popup | null = null;
private routeEventHandlers = new Map<string, any>();
private lastKnownPositions = new Map<string, [number, number]>();

constructor(private mapIconService: MapIconService) {}

  private calculateClusterCenter(positions: [number, number][]): [number, number] {
    if (!positions || positions.length === 0) return [0, 0];
    const sum = positions.reduce((acc, pos) => {
      acc[0] += pos[0];
      acc[1] += pos[1];
      return acc;
    }, [0, 0] as [number, number]);

    return [sum[0] / positions.length, sum[1] / positions.length];
  }

  /**
   * Group routes by proximity and create clusters
   */
  clusterRoutes(map: maplibregl.Map, routes: { [rId: string]: RouteData }): RouteCluster[] {
    // Clear existing clusters
    this.clearClusters(map);
    const renderVersion = ++this.clusterRenderVersion;

    const activeClusters: {
      id: string;
      routeIds: string[];
      positions: [number, number][];
      center: [number, number];
    }[] = [];

    // Extract current positions for all routes
    Object.keys(routes).forEach(rId => {
      const route = routes[rId];
      const pos = route.currentVehiclePos || route.coords[route.coords.length - 1];
      if (pos) {
        const point: [number, number] = [pos[0], pos[1]];
        this.lastKnownPositions.set(rId, point);
        activeClusters.push({
          id: `cluster-${Date.now()}-${Math.random()}`,
          routeIds: [rId],
          positions: [point],
          center: point
        });
      }
    });

    // Agglomerative clustering: merge closest pairs of clusters until all distances > clusterDistance
    let merged = true;
    while (merged && activeClusters.length > 1) {
      merged = false;
      let minDistance = Infinity;
      let mergeA = -1;
      let mergeB = -1;

      for (let i = 0; i < activeClusters.length; i++) {
        for (let j = i + 1; j < activeClusters.length; j++) {
          const dist = this.calculateDistance(map, activeClusters[i].center, activeClusters[j].center);
          if (dist < minDistance) {
            minDistance = dist;
            mergeA = i;
            mergeB = j;
          }
        }
      }

      if (minDistance <= this.clusterDistance) {
        // Merge cluster B into cluster A
        const cA = activeClusters[mergeA];
        const cB = activeClusters[mergeB];

        cA.routeIds.push(...cB.routeIds);
        cA.positions.push(...cB.positions);
        cA.center = this.calculateClusterCenter(cA.positions);

        activeClusters.splice(mergeB, 1);
        merged = true;
      }
    }

    const newClusters: RouteCluster[] = [];

    activeClusters.forEach(c => {
      if (c.routeIds.length > 1) {
        const cluster: RouteCluster = {
          id: c.id,
          position: c.center,
          routeIds: c.routeIds,
          isVisible: true,
          expanded: false
        };
        newClusters.push(cluster);
        this.clusters[cluster.id] = cluster;
      }
    });

    // Add cluster markers to map
    newClusters.forEach(cluster => {
      this.addClusterMarker(map, cluster, renderVersion);
    });

    return newClusters;
  }

  /**
   * Add a cluster marker to the map
   */
  private async addClusterMarker(map: maplibregl.Map, cluster: RouteCluster, renderVersion?: number) {
    const count = cluster.routeIds.length;
    const sourceId = `cluster-source-${cluster.id}`;
    const layerId = `cluster-layer-${cluster.id}`;
    
    // Create cluster icon
    await this.mapIconService.createClusterIcon(map, count);

    // Ignore stale async renders that completed after clusters were cleared/rebuilt
    if (renderVersion !== undefined && renderVersion !== this.clusterRenderVersion) return;
    if (!this.clusters[cluster.id]) return;

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: cluster.position
          },
          properties: {
            clusterId: cluster.id,
            count
          }
        }
      });
    }

    (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: cluster.position
      },
      properties: {
        clusterId: cluster.id,
        count
      }
    });

    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: 'symbol',
        source: sourceId,
        layout: {
          'icon-image': `cluster-${count}`,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-size': 1.2,
          'icon-anchor': 'bottom'
        }
      });
    }

    const eventHandlers = {
      mouseenter: () => {
        map.getCanvas().style.cursor = 'pointer';
      },
      mouseleave: () => {
        map.getCanvas().style.cursor = '';
      },
      click: (e: any) => {
        this.handleClusterClick(map, cluster, e);
      }
    };

    const existingHandlers = this.routeEventHandlers.get(layerId);
    if (existingHandlers) {
      map.off('mouseenter', layerId, existingHandlers.mouseenter);
      if (existingHandlers.mousemove) {
        map.off('mousemove', layerId, existingHandlers.mousemove);
      }
      map.off('mouseleave', layerId, existingHandlers.mouseleave);
      map.off('click', layerId, existingHandlers.click);
    }

    map.on('mouseenter', layerId, eventHandlers.mouseenter);
    map.on('mouseleave', layerId, eventHandlers.mouseleave);
    map.on('click', layerId, eventHandlers.click);

    this.routeEventHandlers.set(layerId, eventHandlers);
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
    const existingHandlers = this.routeEventHandlers.get(layerId);
    if (existingHandlers) {
      map.off('mouseenter', layerId, existingHandlers.mouseenter);
      map.off('mouseleave', layerId, existingHandlers.mouseleave);
      map.off('click', layerId, existingHandlers.click);
      this.routeEventHandlers.delete(layerId);
    }
    
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
    const sourceId = `vehicle-${rId}`;

    // Restore original position if we have it
    const pos = this.lastKnownPositions.get(rId);
    if (pos && map.getSource(sourceId)) {
      (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: pos
        },
        properties: { rId }
      });
    }

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
            'icon-anchor': 'center'
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
    const showHoverCard = (e: any) => {
      map.getCanvas().style.cursor = 'pointer';

      if (this.onRouteHoverChanged) {
        this.onRouteHoverChanged(true, rId);
      }
    };

    // Store event handlers to properly remove them later
    const eventHandlers = {
      mouseenter: showHoverCard,
      mousemove: showHoverCard,

      mouseleave: () => {
        map.getCanvas().style.cursor = '';
        if (this.onRouteHoverChanged) {
          this.onRouteHoverChanged(false, rId);
        }
      },

      click: (e: any) => {
        this.selectRouteFromCluster(rId);
      }
    };

    // Remove existing listeners if they exist
    const existingHandlers = this.routeEventHandlers.get(layerId);
    if (existingHandlers) {
      map.off('mouseenter', layerId, existingHandlers.mouseenter);
      if (existingHandlers.mousemove) {
        map.off('mousemove', layerId, existingHandlers.mousemove);
      }
      map.off('mouseleave', layerId, existingHandlers.mouseleave);  
      map.off('click', layerId, existingHandlers.click);
    }

    // Add new listeners
    map.on('mouseenter', layerId, eventHandlers.mouseenter);
    map.on('mousemove', layerId, eventHandlers.mousemove);
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
    const centerHandlers = this.routeEventHandlers.get(centerLayerId);
    if (centerHandlers) {
      map.off('mouseenter', centerLayerId, centerHandlers.mouseenter);
      if (centerHandlers.mousemove) {
        map.off('mousemove', centerLayerId, centerHandlers.mousemove);
      }
      map.off('mouseleave', centerLayerId, centerHandlers.mouseleave);
      map.off('click', centerLayerId, centerHandlers.click);
      this.routeEventHandlers.delete(centerLayerId);
    }
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
        if (existingHandlers.mousemove) {
          map.off('mousemove', layerId, existingHandlers.mousemove);
        }
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
    if (!map.hasImage(`cluster-${count}`)) {
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
      this.routeEventHandlers.set(centerLayerId, {
        click: clickHandler,
        mouseenter: mouseEnterHandler,
        mouseleave: mouseLeaveHandler
      });
    }
  }

  /**
   * Clear all clusters from map
   */
  clearClusters(map: maplibregl.Map) {
    this.clusterRenderVersion++;

    Object.keys(this.clusters).forEach(clusterId => {
      const sourceId = `cluster-source-${clusterId}`;
      const layerId = `cluster-layer-${clusterId}`;
      const backgroundSourceId = `cluster-bg-${clusterId}`;
      const backgroundLayerId = `cluster-bg-layer-${clusterId}`;
      const centerSourceId = `cluster-center-${clusterId}`;
      const centerLayerId = `cluster-center-layer-${clusterId}`;
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

      // Remove expanded cluster center marker
      if (map.getLayer(centerLayerId)) {
        map.removeLayer(centerLayerId);
      }
      if (map.getSource(centerSourceId)) {
        map.removeSource(centerSourceId);
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

    this.removeAllClusterArtifacts(map);

    // Clear expanded clusters
    this.expandedClusters.clear();
    
    // Clear event handlers
    this.routeEventHandlers.forEach((handlers, layerId) => {
      if (map.getLayer(layerId)) {
        map.off('mouseenter', layerId, handlers.mouseenter);
        if (handlers.mousemove) {
          map.off('mousemove', layerId, handlers.mousemove);
        }
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

    // if (this.currentHoverPopup) {
    //   this.currentHoverPopup.remove();
    //   this.currentHoverPopup = null;
    // }
  }

  private removeAllClusterArtifacts(map: maplibregl.Map) {
    const style = map.getStyle();
    if (!style) return;

    const layerPrefixes = [
      'cluster-layer-',
      'cluster-bg-layer-',
      'cluster-center-layer-',
      'cluster-btn-layer-'
    ];
    const sourcePrefixes = [
      'cluster-source-',
      'cluster-bg-',
      'cluster-center-',
      'cluster-btn-'
    ];

    (style.layers || [])
      .map(l => l.id)
      .filter(id => layerPrefixes.some(prefix => id.startsWith(prefix)))
      .forEach(id => {
        if (map.getLayer(id)) {
          map.removeLayer(id);
        }
      });

    Object.keys((style as any).sources || {})
      .filter(id => sourcePrefixes.some(prefix => id.startsWith(prefix)))
      .forEach(id => {
        if (map.getSource(id)) {
          map.removeSource(id);
        }
      });
  }

  /**
   * Calculate distance between two coordinates in pixels
   */
  private calculateDistance(map: maplibregl.Map, pos1: [number, number], pos2: [number, number]): number {
    const p1 = map.project(pos1);
    const p2 = map.project(pos2);
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
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

  public onRouteHoverChanged?: (isHovering: boolean, routeId: string) => void;

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

  getClusterPositionByRouteId(rId: string): [number, number] | null {
    const cluster = this.findClusterByRouteId(rId);
    return cluster?.position || null;
  }

  /**
   * Check if a route is currently in a cluster
   */
  isRouteInCluster(rId: string): boolean {
    return this.findClusterByRouteId(rId) !== null;
  }

  isRouteInExpandedCluster(rId: string): boolean {
    const cluster = this.findClusterByRouteId(rId);
    return !!cluster?.expanded;
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
