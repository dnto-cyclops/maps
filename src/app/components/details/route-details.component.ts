import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoutesService } from '../../services/routes.service';

export interface RouteDetails {
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
}

@Component({
  selector: 'app-route-details-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './route-details.component.html',
  styleUrl: './route-details.component.scss'
})
export class RouteDetailsPanelComponent implements OnInit {
  @Input() panelCollapsed = false;
  route: RouteDetails | null = null;
  visible = false;

  constructor(private rs: RoutesService) {}

  ngOnInit() {
    this.rs.selected$.subscribe(id => this.load(id));
  }

  load(id: string) {
    if (!id) return;
    this.rs.details(id).subscribe(d => this.route = d);
    // this.route = {
    //   productName: 'Papaya',
    //   status: 'active',
    //   origin: 'Malambo',
    //   destination: 'Medellín',
    //   farm: 'Finca 01',
    //   date: '22 de Enero, 2026',
    //   supplier: 'Alfredo Carlos Cotes Fernández',
    //   weight: '200 kg',
    //   driverName: 'Osmar Gomez Cotes',
    //   driverPhone: '3015367821'
    // };

    this.visible = true;
  }

  close() {
    this.visible = false;
  }

  get statusLabel(): string {
    const map: Record<string, string> = {
      active: 'Activa',
      paused: 'En pausa',
      planned: 'Programada',
      finished: 'Finalizado'
    };
    return map[this.route?.status || ''] || '';
  }
}