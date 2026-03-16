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
  loading = signal(true);
  error = signal(false);
  private destroy$ = new Subject<void>();

  allRoutes: RouteCardData[] = [];

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
    return this.allRoutes.filter(r =>
      this.statusFilter() === 'Todos' || r.status === this.statusFilter()
    );
  }

  setStatus(s: FilterStatus) { this.statusFilter.set(s); }
}
