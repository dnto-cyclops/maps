import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RoutesRepositoryService {
  private readonly storageKey = 'maps.routes.cache';
  private routesSubject = new BehaviorSubject<any[]>(this.readCachedRoutes());
  routes$ = this.routesSubject.asObservable();

  getCurrentRoutes() {
    return this.routesSubject.value;
  }

  setRoutes(routes: any[]) {
    const deduped = new Map<string, any>();
    (routes || []).forEach(route => {
      const routeId = this.getRouteId(route);
      if (routeId) deduped.set(routeId, route);
    });

    const next = Array.from(deduped.values());
    this.routesSubject.next(next);
    this.persistRoutes(next);
  }

  upsertRoute(route: any) {
    if (!route) return;

    const routeId = this.getRouteId(route);
    if (!routeId) return;

    const current = this.routesSubject.value;
    const idx = current.findIndex(r => this.getRouteId(r) === routeId);
    const next = [...current];

    if (idx >= 0) next[idx] = { ...next[idx], ...route };
    else next.unshift(route);

    this.routesSubject.next(next);
    this.persistRoutes(next);
  }

  getRouteId(route: any): string | null {
    return route?.rId || route?.routeId || route?.id || null;
  }

  private readCachedRoutes(): any[] {
    if (typeof window === 'undefined') return [];

    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private persistRoutes(routes: any[]) {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(routes));
    } catch {
      // ignore storage failures
    }
  }
}
