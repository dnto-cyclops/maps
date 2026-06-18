export type DateRangeOption = 'all' | 'today' | 'week' | 'month';

export interface DashboardFilter {
  /** Preset date range (maps to the "Todos" select in the design). */
  range: DateRangeOption;
  /** Specific date in ISO `yyyy-mm-dd` format (bound to the native date input). */
  date: string;
}

export interface DashboardKpi {
  key: string;
  label: string;
  value: string;
  icon: 'trips' | 'weight' | 'completed' | 'time' | 'alert';
  trend?: { value: string; direction: 'up' | 'down' };
  alert?: boolean;
}

export interface ProductWeight {
  product: string;
  iconKey?: string;
  kg: number;
}

export interface TrendBar {
  label: string;
  value: number;
  /** Fill color for the bar (the design uses a varied green scale rather than a uniform fill). */
  color: string;
}

export type TrendRange = 'daily' | 'weekly' | 'monthly';

export type TrendData = Record<TrendRange, TrendBar[]>;

export interface ProviderRow {
  provider: string;
  kg: string;
  trips: number;
}

export interface MovementRow {
  time: string;
  product: string;
  iconKey?: string;
  kg: string;
  km: string;
  provider: string;
  destination: string;
  status: 'delivered' | 'en_route';
}
