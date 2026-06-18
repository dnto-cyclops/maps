import { Component, Input } from '@angular/core';
import { TrendBar, TrendData, TrendRange } from '../dashboard.models';

@Component({
  selector: 'app-trend-chart',
  templateUrl: './trend-chart.component.html',
  styleUrls: ['./trend-chart.component.scss']
})
export class TrendChartComponent {
  @Input() title = 'Tendencia de Kilogramos Movilizadas';
  @Input() data!: TrendData;
  @Input() range: TrendRange = 'daily';

  get bars(): TrendBar[] {
    return this.data ? this.data[this.range] : [];
  }

  get maxValue(): number {
    return Math.max(...this.bars.map(b => b.value), 1);
  }

  setRange(range: TrendRange) {
    this.range = range;
  }

  barHeight(value: number): number {
    return Math.round((value / this.maxValue) * 100);
  }
}
