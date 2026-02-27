import { Component, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouteCardComponent, RouteCardData } from '../cards/route-card.component';

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
  selector: 'app-route-panel',
  standalone: true,
  imports: [CommonModule, RouteCardComponent],
  templateUrl: './route-panel.component.html',
  styleUrl: './route-panel.component.scss'
})
export class RoutePanelComponent {
  @Input() collapsed: boolean = false;
  @Input() routes: RouteCardData[] = MOCK_ROUTES;
  @Input() selectedRouteId: string | null = null;
  @Input() activeCount: number = 0;
  @Input() pausedCount: number = 0;

  @Output() togglePanel = new EventEmitter<void>();
  @Output() routeSelected = new EventEmitter<RouteCardData>();

  @ViewChild('cardsContainer') cardsContainer!: ElementRef<HTMLDivElement>;

  showScrollUp = false;
  showScrollDown = true;

  onTogglePanel() {
    this.togglePanel.emit();
  }

  onRouteSelected(route: RouteCardData) {
    this.routeSelected.emit(route);
  }

  onScroll() {
    const el = this.cardsContainer.nativeElement;
    this.showScrollUp = el.scrollTop > 20;
    this.showScrollDown = el.scrollTop < el.scrollHeight - el.clientHeight - 20;
  }

  scrollUp() {
    this.cardsContainer.nativeElement.scrollBy({ top: -320, behavior: 'smooth' });
  }

  scrollDown() {
    this.cardsContainer.nativeElement.scrollBy({ top: 320, behavior: 'smooth' });
  }
}