import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CommonModule } from '@angular/common';
import { InovaCoreNavModule, NavServices } from 'inova-front-core/nav';
import { environment } from '../../environments/environment';
import { MainLayoutComponent } from './main-layout.component';
import { GraphQLModule } from '../graphql.module';
import { RouteMapComponent } from '../views/route-map/route-map.component';
import { RoutesViewComponent } from '../views/routes-view/routes-view.component';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { SidebarComponent } from './sidebar.component';
import { RoutePanelComponent } from '../components/panel/route-panel.component';
import { RouteCardComponent } from '../components/cards/route-card.component';
import { RouteDetailsPanelComponent } from '../components/details/route-details.component';
import { RouteSummaryOverlayComponent } from '../components/summary/route-summary-overlay.component';
import { FormsModule } from '@angular/forms';
import { UserLanguagePipe } from 'inova-front-core/helpers/pipes';
import { AuthGuard, ServiceGuard } from 'inova-front-core/helpers/guards';
import { TranslateModule } from '@ngx-translate/core';
import { DashboardComponent } from '../views/dashboard/dashboard.component';
import {
  DashboardPanelComponent,
  DashboardFilterBarComponent,
  DashboardKpiCardComponent,
  ProductTagComponent,
  TrendChartComponent
} from '../components';

const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'map', pathMatch: 'full' },
      {
        path: 'map',
        canActivate: [ServiceGuard],
        data: { serviceRequired: 'rutas' },
        component: RouteMapComponent,
      },
      {
        path: 'routes',
        canActivate: [ServiceGuard],
        data: { serviceRequired: 'rutas' },
        component: RoutesViewComponent,
      },
      {
        path: 'dashboard',
        canActivate: [ServiceGuard],
        data: { serviceRequired: 'rutas' },
        component: DashboardComponent,
      }
    ],
  },
];

@NgModule({
  declarations: [
    MainLayoutComponent,
    SidebarComponent,
    RouteMapComponent,
    RoutesViewComponent,
    RoutePanelComponent,
    RouteCardComponent,
    RouteDetailsPanelComponent,
    RouteSummaryOverlayComponent,
    DashboardComponent,
    DashboardPanelComponent,
    DashboardFilterBarComponent,
    DashboardKpiCardComponent,
    ProductTagComponent,
    TrendChartComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    GraphQLModule,
    MatSnackBarModule,
    InovaCoreNavModule.forRoot({
      repUrl: environment.repUrl,
      colUrl: environment.colUrl,
      biUrl: environment.biUrl,
      itUrl: environment.colWebUrl,
      comUrl: environment.comUrl,
      current: NavServices.ROUTES,
      logout: environment.logout,
      routesUrl: environment.routesUrl,
    }),
    TranslateModule,
  ],
  providers: [
    UserLanguagePipe,
    ServiceGuard,
    AuthGuard
  ]
})
export class MainLayoutModule {}