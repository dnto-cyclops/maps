import { Component, OnInit } from '@angular/core';
import { InovaCommonGraphqlApi } from 'inova-front-core/helpers/services/http';
import { UserLanguagePipe } from 'inova-front-core/helpers/pipes';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-main-layout',
  template: `
  <div class="nav-wrapper">
    <img class="nav-logo" [src]="getLogoUrl()" alt="logo">
    <inova-nav></inova-nav>
  </div>
  <div class="app-shell">
    <app-sidebar></app-sidebar>
    <main class="main-content">
      <router-outlet></router-outlet>
    </main>
  </div>
`,
  styles: [`
  :host { display: flex; flex-direction: column; height: 100vh; width: 100%; }
  
  .nav-wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: #2d5a27;
    width: 100%;
    height: 50px;        /* ← controla la altura del nav */
    padding: 0 12px;
  }
  
  .nav-logo {
    height: 32px;        /* ← controla el tamaño del logo */
    object-fit: contain;
  }
  
  inova-nav {
    flex: 1;
    display: flex;
    justify-content: flex-end;
  }

  .app-shell { display: flex; flex: 1; overflow: hidden; }
  .main-content { flex: 1; position: relative; }
`]
})
export class MainLayoutComponent implements OnInit {
  constructor(
    private inovaCommonGraphqlApi: InovaCommonGraphqlApi,
    private userLanguagePipe: UserLanguagePipe,
    private domSanitizer: DomSanitizer,
  ) { }

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

  getLogoUrl(): SafeUrl {
    const url = this.userLanguagePipe.transform('[[mainAppLogo]]');
    if (url && url.includes('http')) {
      return this.domSanitizer.bypassSecurityTrustUrl(url);
    }
    return this.domSanitizer.bypassSecurityTrustUrl('https://in-ova-bi.co/assets/images/logo.svg');
  }
}