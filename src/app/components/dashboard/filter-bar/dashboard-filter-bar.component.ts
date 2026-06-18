import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DashboardFilter, DateRangeOption } from '../dashboard.models';

@Component({
  selector: 'app-dashboard-filter-bar',
  templateUrl: './dashboard-filter-bar.component.html',
  styleUrls: ['./dashboard-filter-bar.component.scss']
})
export class DashboardFilterBarComponent {
  @Input() filter!: DashboardFilter;
  @Output() filterChange = new EventEmitter<DashboardFilter>();

  rangeOptions: { value: DateRangeOption; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'today', label: 'Hoy' },
    { value: 'week', label: 'Esta semana' },
    { value: 'month', label: 'Este mes' }
  ];

  onRangeChange(range: DateRangeOption) {
    this.emit({ ...this.filter, range });
  }

  onDateChange(date: string) {
    this.emit({ ...this.filter, date });
  }

  private emit(filter: DashboardFilter) {
    this.filter = filter;
    this.filterChange.emit(filter);
  }
}
