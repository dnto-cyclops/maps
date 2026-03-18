import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-route-summary-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './route-summary-overlay.component.html',
  styleUrl: './route-summary-overlay.component.scss'
})
export class RouteSummaryOverlayComponent {
  @Input() panelCollapsed: boolean = false;
}