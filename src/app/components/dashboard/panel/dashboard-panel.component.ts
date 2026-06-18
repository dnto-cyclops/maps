import { Component, Input } from '@angular/core';

/**
 * Reusable white card shell used across the dashboard.
 * Projects optional header actions (`[panel-action]`) next to the title
 * and the panel body as default content.
 */
@Component({
  selector: 'app-dashboard-panel',
  templateUrl: './dashboard-panel.component.html',
  styleUrls: ['./dashboard-panel.component.scss']
})
export class DashboardPanelComponent {
  @Input() title = '';
  /** When true, the title is capped to a narrow column so it wraps (matches the design). */
  @Input() narrowTitle = false;
}
