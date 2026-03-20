import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-route-summary-overlay',
  templateUrl: './route-summary-overlay.component.html',
  styleUrls: ['./route-summary-overlay.component.scss']
})
export class RouteSummaryOverlayComponent {
  @Input() panelCollapsed: boolean = false;
}
