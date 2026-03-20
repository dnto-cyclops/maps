import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouteCardData } from '../cards/route-card.component';


@Component({
  selector: 'app-route-panel',
  templateUrl: './route-panel.component.html',
  styleUrls: ['./route-panel.component.scss']
})
export class RoutePanelComponent implements OnChanges, AfterViewInit {
  @Input() collapsed: boolean = false;
  @Input() routes: RouteCardData[] = [];
  @Input() selectedRouteId: string | null = null;
  @Input() activeCount: number = 0;
  @Input() pausedCount: number = 0;

  @Output() togglePanel = new EventEmitter<void>();
  @Output() routeSelected = new EventEmitter<RouteCardData>();

  @ViewChild('cardsContainer') cardsContainer!: ElementRef<HTMLDivElement>;

  showScrollUp = false;
  showScrollDown = true;
  showFilters = false;

  selectedStatus: string = 'Todos';
  selectedFruit: string = 'Todos';
  dateFromFilter: string = '';
  dateToFilter: string = '';
  statusMap: Record<string, string> = {
    active: 'Activa',
    paused: 'En pausa',
    planned: 'Programada',
    finished: 'Finalizado',
    stopped: 'Detenida'
  };

  get filteredRoutes(): RouteCardData[] {
    return this.routes.filter(route => this.matchFilters(route));
  }

  get uniqueFruits(): string[] {
    const fruits = new Set(this.routes.map(r => r.load?.load || '').filter(f => f));
    return ['Todos', ...Array.from(fruits).sort()];
  }

  onFruitChange(value: string) {
    this.selectedFruit = value;
  }

  private matchFilters(route: RouteCardData): boolean {
    if (this.selectedStatus !== 'Todos') {
      const routeStatus = this.getStatusLabel(route.status || '');
      if (routeStatus !== this.selectedStatus) {
        return false;
      }
    }

    if (this.selectedFruit !== 'Todos') {
      if ((route.load?.load || '') !== this.selectedFruit) return false;
    }
    
    if (this.dateFromFilter || this.dateToFilter) {
      console.log(route)
      const routeTimestamp = route.startTs || 0;

      if (this.dateFromFilter) {
        const fromTimestamp = this.dateToTimestamp(this.dateFromFilter);
        if (routeTimestamp < fromTimestamp) return false;
      }

      if (this.dateToFilter) {
        const toTimestamp = this.dateToTimestamp(this.dateToFilter);
        if (routeTimestamp > toTimestamp + 86400) return false;
      }
    }

    return true;
  }

  private dateToTimestamp(dateString: string): number {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day, 0, 0, 0, 0);
    return Math.floor(date.getTime() / 1000);
  }

  getStatusLabel(status: string): string {
    const normalized = (status || '').toLowerCase();
    return this.statusMap[normalized] || status;
  }

  get uniqueStatusOptions(): string[] {
    const statuses = new Set(this.routes.map(r => this.getStatusLabel(r.status || '')));
    return ['Todos', ...Array.from(statuses).sort()];
  }

  onStatusChange(event: any) {
    this.selectedStatus = event.target.value;
  }

  setDateFrom(date: string) { this.dateFromFilter = date; }
  setDateTo(date: string) { this.dateToFilter = date; }
  toggleFiltersVisibility() {
    this.showFilters = !this.showFilters;
  }

  ngAfterViewInit() {
    this.scrollToSelectedRoute();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['routes'] && changes['routes'].firstChange) {
      this.selectedStatus = 'Todos';
      this.selectedFruit = 'Todos';
    }

    if (changes['selectedRouteId'] || changes['routes'] || changes['collapsed']) {
      setTimeout(() => this.scrollToSelectedRoute(), 0);
    }
  }

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

  private scrollToSelectedRoute() {
    if (this.collapsed || !this.selectedRouteId || !this.cardsContainer) return;

    const container = this.cardsContainer.nativeElement;
    const selectedCard = container.querySelector(`[data-route-id="${this.selectedRouteId}"]`) as HTMLElement | null;
    if (!selectedCard) return;

    selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    this.onScroll();
  }
}
