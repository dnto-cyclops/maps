import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
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
  stoppedSince: number | null;
}

@Component({
  selector: 'app-route-details-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './route-details.component.html',
  styleUrl: './route-details.component.scss'
})
export class RouteDetailsPanelComponent implements OnInit, OnDestroy, OnChanges {
  @Input() panelCollapsed = false;
  @Input() routeData: any = null;
  route: RouteDetails | null = null;
  visible = false;
  private destroy$ = new Subject<void>();

  constructor(private rs: RoutesService) {}

  ngOnInit() {
    this.rs.selected$
      .pipe(takeUntil(this.destroy$))
      .subscribe(id => {
        if (!id) { this.visible = false; return; }
        this.visible = true;
        this.route = null;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['routeData'] && this.routeData) {
      this.route = this.toViewModel(this.routeData, this.routeData.rId);
    }
  }

  load(id: string) {
    if (!id) return;
    this.visible = true;
    this.route = null;
    
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
    const driverObj = data?.driver && typeof data.driver === 'object' ? data.driver : null;
    const driverName = driverObj?.driver || (typeof data?.driver === 'string' ? data.driver : 'N/D');
    const driverPhone = driverObj?.phone || data?.driverPhone || 'N/D';
    const startTs = data?.startTs;
    const date = startTs
      ? new Date(startTs * 1000).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
      : 'N/D';
    const segments: any[] = data?.segments || [];
    const lastStoppedSegment = [...segments].reverse().find((s: any) => 
      (s.type || '').toLowerCase() === 'stopped'
    );
    const stoppedSince = (status === 'stopped' && lastStoppedSegment?.tsStart) 
      ? lastStoppedSegment.tsStart 
      : null;

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
      driverName: driverName,
      driverPhone: driverPhone,
      vehicle: data?.vehicle || data?.plate || data?.placa || 'N/D',
      stoppedSince
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

  get stoppedDuration(): string {
    if (!this.route?.stoppedSince) return '';
    
    const nowSecs = Math.floor(Date.now() / 1000);
    const diffSecs = nowSecs - this.route.stoppedSince;
    
    if (diffSecs < 60) return `${diffSecs} seg`;
    
    const totalMinutes = Math.floor(diffSecs / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${totalMinutes} min`;
  }

  get isInactiveAlert(): boolean {
    if (!this.route?.stoppedSince) return false;
    const diffSecs = Math.floor(Date.now() / 1000) - this.route.stoppedSince;
    return diffSecs > 30 * 60;
  }
}
