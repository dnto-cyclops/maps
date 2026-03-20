import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, Observable, of } from 'rxjs';
import { map, tap, finalize, shareReplay } from 'rxjs/operators';
import { ApiConfigService } from './api-config.service';
import { RoutesRepositoryService } from './routes-repository.service';
import { NotificationType } from '../enums/notification-type.enum';

@Injectable({ providedIn: 'root' })
export class RoutesService {
  selected$ = new Subject<string>();
  get routes$() { return this.repo.routes$; }
  private detailsCache = new Map<string, { data: any; ts: number }>();
  private detailsInFlight = new Map<string, Observable<any>>();

  constructor(
    private http: HttpClient,
    private apiConfig: ApiConfigService,
    private repo: RoutesRepositoryService
  ) {}

  snapshot() {
    return this.http
      .get<any[]>(`${this.apiConfig.getBaseUrl()}/routes?format=polylines&onlyactive=false`)
      .pipe(tap(list => this.repo.setRoutes(list || [])));
  }

  details(rId: string, include: string[] = ['recommendations', 'segments', 'progress']) {
    const includeParam = encodeURIComponent(include.join(','));
    const key = `${rId}|${include.join(',')}`;
    const now = Date.now();
    const ttlMs = 8000;

    const cached = this.detailsCache.get(key);
    if (cached && now - cached.ts < ttlMs) {
      return of(cached.data);
    }

    const pending = this.detailsInFlight.get(key);
    if (pending) {
      return pending;
    }

    const request$ = this.http
      .get<any>(`${this.apiConfig.getBaseUrl()}/routes/${rId}/details?include=${includeParam}&profile=admin`)
      .pipe(
        map((resp: any) => resp?.route || resp?.data || resp),
        tap((data: any) => this.detailsCache.set(key, { data, ts: Date.now() })),
        finalize(() => this.detailsInFlight.delete(key)),
        shareReplay(1)
      );

    this.detailsInFlight.set(key, request$);
    return request$;
  }

  fetchRouteById(rId: string, seed?: any) {
    return this.details(rId).pipe(
      map((resp: any) => {
        const route = resp?.route || resp?.data || resp;
        const merged = { ...(seed || {}), ...(route || {}) };
        if (!merged || Object.keys(merged).length === 0) return null;
        return { ...merged, rId: this.repo.getRouteId(merged) || rId };
      }),
      tap(route => this.upsertRoute(route))
    );
  }

  getCurrentRoutes() {
    return this.repo.getCurrentRoutes();
  }

  setRoutes(routes: any[]) {
    this.repo.setRoutes(routes);
  }

  upsertRoute(route: any) {
    this.repo.upsertRoute(route);
  }

  upsertRouteFromUpdate(evt: any) {
    const route = evt?.data;
    if (!route) return;

    const normalizedStatus = this.resolveStatusFromUpdate(evt);
    const normalizedRoute = normalizedStatus ? { ...route, status: normalizedStatus } : route;

    this.repo.upsertRoute(normalizedRoute);
  }

  private resolveStatusFromUpdate(evt: any): string | null {
    if (evt?.notificationType === NotificationType.Stopped || evt?.type === 'route_stopped') {
      return 'stopped';
    }

    if (evt?.notificationType === NotificationType.Finished || evt?.type === 'route_finished') {
      return 'finished';
    }

    if (evt?.notificationType === NotificationType.Started || evt?.type === 'route_started') {
      return 'active';
    }

    return null;
  }

  selectRoute(id: string) { this.selected$.next(id); }
}
