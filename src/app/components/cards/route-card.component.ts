import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FruitIconService } from '../../services/fruit-icon.service';

export interface RouteLoad {
  load: string;
  quantity: number;
  unit: string;
}

export interface RouteDest {
  id: number;
  name: string;
  latlong: [number, number];
  estimated_durationS: number;
}

export interface RouteApiResponse {
  rId: string;
  startTs?: number;
  polyline?: string;
  coordinates?: number[][] | null;
  d?: number[] | null;
  dest?: RouteDest | null;
  provider?: string;
  vehicle?: string;
  status?: string;
  load?: RouteLoad;
}

export interface RouteCardData {
  rId: string;
  startTs?: number;
  polyline?: string;
  coordinates?: number[][] | null;
  d?: number[] | null;
  dest?: RouteDest | null;
  status?: string;
  load?: RouteLoad;
  plate?: string;
  route?: string;
  time?: string;
  progress?: number;
  supplier?: string;
}

export function mapApiToRouteCardData(api: RouteApiResponse): RouteCardData {
  return {
    rId: api.rId,
    startTs: api.startTs,
    polyline: api.polyline,
    coordinates: api.coordinates,
    d: api.d,
    dest: api.dest,
    status: api.status,
    load: api.load,
    plate: api.vehicle,
    route: api.dest?.name,
    supplier: api.provider,
    time: undefined,
    progress: undefined
  };
}

@Component({
  selector: 'app-route-card',
  //standalone: true,
  //imports: [CommonModule],
  templateUrl: './route-card.component.html',
  styleUrls: ['./route-card.component.scss']
})
export class RouteCardComponent implements OnInit {
  @Input() route!: RouteCardData;
  @Input() details: boolean = false;
  @Input() selected: boolean = false;
  @Output() cardClick = new EventEmitter<RouteCardData>();

  constructor(
    private router: Router,
    private fruitIconService: FruitIconService
  ) {}

  onViewRoute(event: Event) {
    event.stopPropagation();
    this.router.navigate(['/map'], { queryParams: { rId: this.route.rId } });
  }

  ngOnInit() {
    console.log('[LIST-ROUTES] initialized with route:', this.route);
  }

  onCardClick() {
    this.cardClick.emit(this.route);
  }

  isStatus(status: string): boolean {
    return (this.route?.status || '').toLowerCase() === status;
  }

  formatCoord(c: any): string {
    if (!c || c.length < 2) return 'N/D';
    return `${c[0].toFixed(5)}, ${c[1].toFixed(5)}`;
  }

  get fruitIconPath(): string {
    return this.fruitIconService.getCardIconPath(this.route?.load?.load || null);
  }

  formatEstimatedDuration(seconds?: number): string {
    if (!seconds) return 'Calculando..';

    const totalMinutes = Math.round(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return minutes > 0 ? `${hours}H ${minutes}m` : `${hours}H`;
    }
    return `${minutes}m`;
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

  get statusLabel(): string {
    const map: Record<string, string> = {
      active: 'Activa',
      paused: 'En pausa',
      planned: 'Programada',
      finished: 'Finalizado',
      stopped: 'Detenida'
    };
    const status = (this.route?.status || '').toLowerCase();
    return map[status] || this.route?.status || '';
  }
}
