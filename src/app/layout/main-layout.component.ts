import { Component, OnInit } from '@angular/core';
import { InovaCommonGraphqlApi } from 'inova-front-core/helpers/services/http';
import { UserLanguagePipe } from 'inova-front-core/helpers/pipes';

@Component({
  selector: 'app-main-layout',
  template: `
    <inova-nav></inova-nav>
    <div class="app-shell">
      <app-sidebar></app-sidebar>
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100vh; width: 100%; }
    .app-shell { display: flex; flex: 1; overflow: hidden; }
    .main-content { flex: 1; position: relative; }
  `]
})
export class MainLayoutComponent implements OnInit {
  constructor(
    private inovaCommonGraphqlApi: InovaCommonGraphqlApi,
    private userLanguagePipe: UserLanguagePipe,
  ) {}

  ngOnInit() {
    this.setPrimaryColor();
    this.inovaCommonGraphqlApi.getClientServices().subscribe();
  }

  setPrimaryColor() {
    const mainColor = this.userLanguagePipe.transform("[[mainAppColor]]");
    if (!(mainColor.includes("["))) {
      document.documentElement.style.setProperty('--primary_color', mainColor);
    }
  }
}