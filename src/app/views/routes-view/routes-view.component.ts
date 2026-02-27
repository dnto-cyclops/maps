import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouteCardComponent, RouteCardData } from '../../components/cards/route-card.component';
import { RoutesService } from '../../services/routes.service';

type FilterStatus = 'Todos' | 'active' | 'paused' | 'planned' | 'finished';
export const MOCK_ROUTES: RouteCardData[] = [
  {
    rId: "R-001",
    name: "Papaya",
    status: "active",
    start: [4.60971, -74.08175],
    dest: [4.71099, -74.07209],
    current: [4.65001, -74.09000],
  },
  {
    rId: "R-002",
    name: "Papaya",
    status: "paused",
    start: [6.24420, -75.58121],
    dest: [6.30000, -75.56000],
    current: [6.26000, -75.57000],
  },
  {
    rId: "R-003",
    name: "Papaya",
    status: "planned",
    start: [3.45164, -76.53198],
    dest: [3.50000, -76.52000],
    current: [3.46000, -76.52500],
  },
  {
    rId: "R-002",
    name: "Papaya",
    status: "finished",
    start: [6.24420, -75.58121],
    dest: [6.30000, -75.56000],
    current: [6.26000, -75.57000],
  },{
    rId: "R-002",
    name: "Papaya",
    status: "paused",
    start: [6.24420, -75.58121],
    dest: [6.30000, -75.56000],
    current: [6.26000, -75.57000],
  },{
    rId: "R-002",
    name: "Papaya",
    status: "paused",
    start: [6.24420, -75.58121],
    dest: [6.30000, -75.56000],
    current: [6.26000, -75.57000],
  },{
    rId: "R-002",
    name: "Papaya",
    status: "finished",
    start: [6.24420, -75.58121],
    dest: [6.30000, -75.56000],
    current: [6.26000, -75.57000],
  },{
    rId: "R-002",
    name: "Papaya",
    status: "paused",
    start: [6.24420, -75.58121],
    dest: [6.30000, -75.56000],
    current: [6.26000, -75.57000],
  },{
    rId: "R-002",
    name: "Papaya",
    status: "paused",
    start: [6.24420, -75.58121],
    dest: [6.30000, -75.56000],
    current: [6.26000, -75.57000],
  },
];

@Component({
  selector: 'app-routes-view',
  standalone: true,
  imports: [CommonModule, FormsModule, RouteCardComponent],
  templateUrl: './routes-view.component.html',
  styleUrl: './routes-view.component.scss'
})
export class RoutesViewComponent implements OnInit {
  statusFilter = signal<FilterStatus>('Todos');
  loading = signal(true);
  error = signal(false);

  allRoutes: RouteCardData[] = MOCK_ROUTES;

  constructor(private rs: RoutesService) {}

  ngOnInit() {
    this.rs.snapshot().subscribe({
      next: (list: any[]) => {
        this.allRoutes = (list || []).map(r => this.mapToCard(r));
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      }
    });
  }

  private mapToCard(r: any): RouteCardData {
    return {
      rId: r.rId || r.id || r.routeId,
      name: r.name || 'Papaya',
      status: r.status || 'active',
      plate: r.plate || r.placa || '',
      route: r.route || r.destino || '',
      time: r.time || r.duration || '',
      progress: r.progress ?? r.porcentaje ?? 0,
      supplier: r.supplier || r.proveedor || '',
      product: r.product || r.producto || '',
      weight: r.weight || r.peso || '',
      noSchedule: !r.time && !r.duration,
      dest: r.dest || r.destination || null,
      start: r.start || null,
      current: r.current || null,
    };
  }

  get filteredRoutes(): RouteCardData[] {
    return this.allRoutes.filter(r =>
      this.statusFilter() === 'Todos' || r.status === this.statusFilter()
    );
  }

  setStatus(s: FilterStatus) { this.statusFilter.set(s); }
}