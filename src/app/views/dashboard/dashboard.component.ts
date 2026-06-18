import { Component } from '@angular/core';
import {
  DashboardFilter,
  DashboardKpi,
  MovementRow,
  ProductWeight,
  ProviderRow,
  TrendData,
  TrendRange
} from '../../components/dashboard/dashboard.models';

type MovementStatus = MovementRow['status'];

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {
  filter: DashboardFilter = {
    range: 'all',
    date: new Date().toISOString().slice(0, 10)
  };

  kpis: DashboardKpi[] = [
    { key: 'trips', label: 'Viajes Totales', value: '142', icon: 'trips', trend: { value: '12%', direction: 'up' } },
    { key: 'weight', label: 'Kg Transportadas', value: '2,450', icon: 'weight', trend: { value: '5%', direction: 'down' } },
    { key: 'completed', label: 'Completados', value: '128', icon: 'completed', trend: { value: '8%', direction: 'up' } },
    { key: 'time', label: 'Tiempo Promedio', value: '4.2h', icon: 'time', trend: { value: '10%', direction: 'up' } },
    { key: 'incidents', label: 'Incidencias Críticas', value: '3', icon: 'alert', alert: true }
  ];

  productWeights: ProductWeight[] = [
    { product: 'Papaya', kg: 850 },
    { product: 'Melón', kg: 620 },
    { product: 'Mora', kg: 410 },
    { product: 'Tomate de árbol', kg: 320 },
    { product: 'Guayabas', iconKey: 'guayaba', kg: 180 }
  ];

  trendRange: TrendRange = 'daily';

  trendData: TrendData = {
    daily: [
      { label: 'Lun', value: 420, color: '#E2E9DE' },
      { label: 'Mar', value: 510, color: '#C7D6C1' },
      { label: 'Mié', value: 300, color: '#9CB995' },
      { label: 'Jue', value: 720, color: '#5E8F56' },
      { label: 'Vie', value: 560, color: '#7FA577' },
      { label: 'Sáb', value: 810, color: '#1E4620' },
      { label: 'Dom', value: 390, color: '#AEC4A8' }
    ],
    weekly: [
      { label: 'S1', value: 3200, color: '#C7D6C1' },
      { label: 'S2', value: 4100, color: '#7FA577' },
      { label: 'S3', value: 2800, color: '#9CB995' },
      { label: 'S4', value: 5200, color: '#1E4620' }
    ],
    monthly: [
      { label: 'Ene', value: 12000, color: '#AEC4A8' },
      { label: 'Feb', value: 9800, color: '#C7D6C1' },
      { label: 'Mar', value: 14500, color: '#5E8F56' },
      { label: 'Abr', value: 11200, color: '#7FA577' },
      { label: 'May', value: 16000, color: '#1E4620' },
      { label: 'Jun', value: 13400, color: '#3F7438' }
    ]
  };

  topProviders: ProviderRow[] = [
    { provider: 'Finca la Esperanza', kg: '845.2 kg', trips: 48 },
    { provider: 'AgroIndustrial', kg: '612.2 kg', trips: 32 },
    { provider: 'Plantaciones El Sol', kg: '534.5 kg', trips: 29 },
    { provider: 'EcoFruta S.A.', kg: '245.0 kg', trips: 18 }
  ];

  recentMovements: MovementRow[] = [
    { time: '09:42 AM', product: 'Papaya', kg: '22.5 kg', km: '200 km', provider: 'AgroIndustrial', destination: 'Planta Malambo', status: 'delivered' },
    { time: '09:15 AM', product: 'Melón', kg: '18.0 kg', km: '240 km', provider: 'Finca Esperanza', destination: 'Planta Malambo', status: 'en_route' },
    { time: '08:50 AM', product: 'Mora', kg: '12.2 kg', km: '650 km', provider: 'Cultivos San José', destination: 'Planta Tuluá', status: 'delivered' },
    { time: '08:22 AM', product: 'Tomate de árbol', iconKey: 'tomate de árbol', kg: '25.0 kg', km: '260 km', provider: 'Frutas Tropicales', destination: 'Planta Malambo', status: 'delivered' }
  ];

  onFilterChange(filter: DashboardFilter) {
    this.filter = filter;
    // Data is currently static mock; re-query KPIs / charts / tables here once
    // the dashboard is wired to the maps REST API.
  }

  statusLabel(status: MovementStatus): string {
    return status === 'delivered' ? 'ENTREGADO' : 'EN RUTA';
  }

  onProvidersViewAll() {
    // TODO: navigate to the full providers report once available.
  }

  onMovementsFilter() {
    // TODO: open movements filter once wired to the maps REST API.
  }

  onMovementsDownload() {
    // TODO: export recent movements once wired to the maps REST API.
  }
}
