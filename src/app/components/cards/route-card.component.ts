  import { Component, Input, Output, EventEmitter } from '@angular/core';
  import { CommonModule } from '@angular/common';


export interface RouteCardData {
  rId: string;
  name?: string;
  status?: string;
  plate?: string;
  route?: string;
  time?: string;
  progress?: number;
  supplier?: string;
  product?: string;
  weight?: string;
  noSchedule?: boolean;
  dest?: [number, number] | null;
  start?: number[] | null;
  current?: number[] | null;
}

  @Component({
    selector: 'app-route-card',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './route-card.component.html',
    styleUrls: ['./route-card.component.scss']
  })
  export class RouteCardComponent {
    @Input() route!: RouteCardData;
    @Input() details: boolean = false;
    @Input() selected: boolean = false;
    @Output() cardClick = new EventEmitter<RouteCardData>();

    onCardClick() {
      this.cardClick.emit(this.route);
    }

    formatCoord(c: any): string {
      if (!c || c.length < 2) return 'N/D';
      return `${c[0].toFixed(5)}, ${c[1].toFixed(5)}`;
    }

    get statusLabel(): string {
  const map: Record<string, string> = {
    active: 'Activa',
    paused: 'En pausa',
    planned: 'Programada',
    finished: 'Finalizado'
  };
  return map[this.route.status || ''] || this.route.status || '';
} 
  }
