import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouteCardComponent, RouteCardData } from '../../components/cards/route-card.component';
import { RoutesService } from '../../services/routes.service';
import { UpdatesService } from '../../services/updates.service';
import { NotificationType } from '../../enums/notification-type.enum';
import { Subject, takeUntil } from 'rxjs';

type FilterStatus = 'Todos' | 'active' | 'paused' | 'planned' | 'finished';


@Component({
  selector: 'app-routes-view',
  standalone: true,
  imports: [CommonModule, FormsModule, RouteCardComponent],
  templateUrl: './routes-view.component.html',
  styleUrl: './routes-view.component.scss'
})
export class RoutesViewComponent implements OnInit, OnDestroy {
  statusFilter = signal<FilterStatus>('Todos');
  searchPlate = signal<string>('');
  selectedFruit = signal<string>('Todos');
  selectedProvider = signal<string>('Todos');
  selectedDestination = signal<string>('Todos');
  dateFromFilter = signal<string>('');
  dateToFilter = signal<string>('');
  loading = signal(true);
  error = signal(false);
  filtersOpen = signal<boolean>(false);
  private destroy$ = new Subject<void>();

  allRoutes: RouteCardData[] = [];

  statusMap: Record<string, string> = {
    active: 'Activa',
    paused: 'En pausa',
    planned: 'Programada',
    finished: 'Finalizado',
    stopped: 'Detenida'
  };

  constructor(
    private rs: RoutesService,
    private us: UpdatesService
  ) {}

  ngOnInit() {
    const cached = this.rs.getCurrentRoutes();
    if (cached.length > 0) {
      this.allRoutes = cached.map(r => this.mapToCard(r));
      this.loading.set(false);
    }

    this.rs.routes$
      .pipe(takeUntil(this.destroy$))
      .subscribe(list => {
        this.allRoutes = (list || []).map(r => this.mapToCard(r));
        this.loading.set(false);
      });

    this.rs.snapshot().subscribe({
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      }
    });

    this.us.connect();
    this.us.onUpdate()
      .pipe(takeUntil(this.destroy$))
      .subscribe((evt: any) => {
        const rId = evt?.data?.rId || evt?.data?.routeId || evt?.data?.id;
        if (!rId) return;

        if (evt?.notificationType === NotificationType.Started || evt?.type === 'route_started') {
          this.rs.upsertRouteFromUpdate(evt);
          return;
        }

        this.rs.upsertRouteFromUpdate(evt);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private mapToCard(r: any): RouteCardData {
    return {
      rId: r.rId || r.id || r.routeId,
      startTs: r.startTs,
      status: r.status || 'active',
      plate: r.plate || r.vehicle || r.placa || '',        
      route: r.route || r.dest?.name || r.destino || '',   
      time: r.time || r.duration || '',
      progress: r.progress ?? r.porcentaje ?? 0,
      supplier: r.supplier || r.provider || r.proveedor || '',
      dest: r.dest || r.destination || null,
      load: r.load || null,
    };
  }

  get filteredRoutes(): RouteCardData[] {
    return this.allRoutes.filter(r => this.matchFilters(r));
  }

  private matchFilters(route: RouteCardData): boolean {
    if (this.statusFilter() !== 'Todos') {
      if (route.status !== this.statusFilter()) {
        return false;
      }
    }

    if (this.searchPlate().trim()) {
      const plateLower = (route.plate || '').toLowerCase();
      const searchLower = this.searchPlate().toLowerCase();
      if (!plateLower.includes(searchLower)) {
        return false;
      }
    }

    if (this.selectedFruit() !== 'Todos') {
      if ((route.load?.load || '') !== this.selectedFruit()) {
        return false;
      }
    }

    if (this.selectedProvider() !== 'Todos') {
      if ((route.supplier || '') !== this.selectedProvider()) {
        return false;
      }
    }

    if (this.selectedDestination() !== 'Todos') {
      if ((route.route || '') !== this.selectedDestination()) {
        return false;
      }
    }

    if (this.dateFromFilter() || this.dateToFilter()) {
      const routeTimestamp = route.startTs || 0;
      
      if (this.dateFromFilter()) {
        const fromTimestamp = this.dateToTimestamp(this.dateFromFilter());
        if (routeTimestamp < fromTimestamp) {
          return false;
        }
      }

      if (this.dateToFilter()) {
        const toTimestamp = this.dateToTimestamp(this.dateToFilter());
        if (routeTimestamp > toTimestamp + 86400) {
          return false;
        }
      }
    }

    return true;
  }

  private dateToTimestamp(dateString: string): number {
    return Math.floor(new Date(dateString).getTime() / 1000);
  }

  get uniqueFruits(): string[] {
    const fruits = new Set(this.allRoutes.map(r => r.load?.load || '').filter(f => f));
    return ['Todos', ...Array.from(fruits).sort()];
  }

  get uniqueProviders(): string[] {
    const providers = new Set(this.allRoutes.map(r => r.supplier || '').filter(p => p));
    return ['Todos', ...Array.from(providers).sort()];
  }

  get uniqueDestinations(): string[] {
    const destinations = new Set(this.allRoutes.map(r => r.route || '').filter(d => d));
    return ['Todos', ...Array.from(destinations).sort()];
  }

  setStatus(s: FilterStatus) { this.statusFilter.set(s); }
  setSearchPlate(plate: string) { this.searchPlate.set(plate); }
  setFruit(fruit: string) { this.selectedFruit.set(fruit); }
  setProvider(provider: string) { this.selectedProvider.set(provider); }
  setDestination(destination: string) { this.selectedDestination.set(destination); }
  setDateFrom(date: string) { this.dateFromFilter.set(date); }
  setDateTo(date: string) { this.dateToFilter.set(date); }
  toggleFilters() { this.filtersOpen.set(!this.filtersOpen()); }
}
