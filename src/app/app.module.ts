import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common'; // Para *ngIf, *ngFor
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router'; // Para RouterLink y RouterLinkActive

import { App } from './app';
import { SidebarComponent } from './layout/sidebar.component';
import { RouteMapComponent } from './views/route-map/route-map.component';
import { RoutePanelComponent } from './components/panel/route-panel.component';
import { RouteCardComponent } from './components/cards/route-card.component';
import { RouteDetailsPanelComponent } from './components/details/route-details.component';
import { RouteSummaryOverlayComponent } from './components/summary/route-summary-overlay.component';
import { RoutesViewComponent } from './views/routes-view/routes-view.component';

const routes = [
  { path: 'map', component: RouteMapComponent },
  { path: 'routes', component: RoutesViewComponent },
  { path: '', redirectTo: '/map', pathMatch: 'full' } // Esto redirige al inicio a /map
];

@NgModule({
  declarations: [
    App,
    SidebarComponent,
    RouteMapComponent,
    RoutePanelComponent,
    RouteCardComponent,
    RouteDetailsPanelComponent,
    RouteSummaryOverlayComponent,
    RoutesViewComponent
  ],
  imports: [
    BrowserModule,
    CommonModule,
    FormsModule,
    HttpClientModule,
    RouterModule.forRoot(routes) 
  ],
  providers: [],
  bootstrap: [App]
})
export class AppModule { }
