import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouteCardComponent, RouteCardData } from '../cards/route-card.component';


@Component({
  selector: 'app-route-panel',
  standalone: true,
  imports: [CommonModule, RouteCardComponent],
  templateUrl: './route-panel.component.html',
  styleUrl: './route-panel.component.scss'
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

  ngAfterViewInit() {
    this.scrollToSelectedRoute();
  }

  ngOnChanges(changes: SimpleChanges) {
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
