import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoutesService } from '../../services/routes.service';
import { Subject, takeUntil } from 'rxjs';

export interface RouteDetails {
  rId: string;
  productName: string;
  status: string;
  origin: string;
  destination: string;
  farm: string;
  date: string;
  supplier: string;
  weight: string;
  driverName: string;
  driverPhone: string;
  vehicle: string;
}

@Component({
  selector: 'app-route-details-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './route-details.component.html',
  styleUrl: './route-details.component.scss'
})
export class RouteDetailsPanelComponent implements OnInit, OnDestroy {
  @Input() panelCollapsed = false;
  route: RouteDetails | null = null;
  visible = false;
  private destroy$ = new Subject<void>();

  constructor(private rs: RoutesService) {}

  ngOnInit() {
    this.rs.selected$
      .pipe(takeUntil(this.destroy$))
      .subscribe(id => this.load(id));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(id: string) {
    if (!id) return;
    const fromSnapshot = this.rs.getCurrentRoutes().find(r => {
      const routeId = r?.rId || r?.routeId || r?.id;
      return routeId === id;
    });

    if (fromSnapshot) {
      this.route = this.toViewModel(fromSnapshot, id);
    }

    this.rs.details(id).subscribe(d => {
      const merged = { ...(fromSnapshot || {}), ...(d || {}) };
      this.route = this.toViewModel(merged, id);
    });

    this.visible = true;
  }

  private toViewModel(data: any, fallbackId: string): RouteDetails {
    const status = (data?.status || 'active').toLowerCase();
    const loadObj = data?.load || null;
    const quantity = loadObj?.quantity;
    const unit =  loadObj?.unit || ''
    const productName = loadObj?.load || data?.productName || data?.product || 'N/D';
    const weight = quantity ? `${quantity} ${unit}`.trim() : (data?.weight || 'N/D');;
    const destObj = data?.destination || data?.dest || null;
    const destination = typeof destObj === 'object' && destObj !== null
      ? destObj.name
      : (destObj || 'N/D');
    const origin = data?.origin?.name || data?.origin || data?.provider || 'N/D';
    const supplier = data?.provider || data?.supplier || data?.proveedor || 'N/D';

    const startTs = data?.startTs;
    const date = startTs
      ? new Date(startTs * 1000).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
      : 'N/D';

    console.log(data.driver)
    return {
      rId: data?.rId || data?.routeId || data?.id || fallbackId,
      productName,
      status,
      origin,
      destination,
      farm: data?.farm || origin,
      date,
      supplier,
      weight,
      driverName: data.driver || 'N/D',
      driverPhone: data?.driverPhone || 'N/D',
      vehicle: data?.vehicle || data?.plate || data?.placa || 'N/D'
    };
  }

  close() {
    this.visible = false;
  }

  get statusLabel(): string {
    const map: Record<string, string> = {
      active: 'Activa',
      paused: 'En pausa',
      planned: 'Programada',
      finished: 'Finalizado',
      stopped: 'Detenida'
    };
    return map[this.route?.status || ''] || '';
  }
}
