import { Component, Input } from '@angular/core';
import { DashboardKpi } from '../dashboard.models';

@Component({
  selector: 'app-dashboard-kpi-card',
  templateUrl: './dashboard-kpi-card.component.html',
  styleUrls: ['./dashboard-kpi-card.component.scss']
})
export class DashboardKpiCardComponent {
  @Input() kpi!: DashboardKpi;
}
