import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'map', pathMatch: 'full' },
  {
    path: 'map',
    loadComponent: () =>
      import('./views/route-map/route-map.component').then(m => m.RouteMapComponent)
  },
  {
    path: 'routes',
    loadComponent: () =>
      import('./views/routes-view/routes-view.component').then(m => m.RoutesViewComponent)
  }
];