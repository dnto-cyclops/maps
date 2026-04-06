import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule, Routes } from '@angular/router';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { App } from './app';
import { SessionListenerComponent } from 'inova-front-core/session';
import { environment } from '../environments/environment';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './services/auth-interceptor.service';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslationHttpLoader } from 'inova-front-core/i18n';
import { HttpClient } from '@angular/common/http';

export function httpLoaderFactory(http: HttpClient): TranslationHttpLoader {
  return new TranslationHttpLoader(http, environment.i18nBaseUrl);
}

const routes: Routes = [
  {
    path: 'session-listener',
    component: SessionListenerComponent,
    data: {
      allowedOrigins: [
        environment.colUrl,
        environment.repUrl,
        environment.biUrl,
        environment.colWebUrl,
        environment.domine,
      ],
    },
  },
  {
    path: '',
    loadChildren: () => import('./layout/main-layout.module').then((m) => m.MainLayoutModule),
  },
];

@NgModule({
  declarations: [App],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    RouterModule.forRoot(routes),
    MatSnackBarModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: httpLoaderFactory,
        deps: [HttpClient]
      }
    })
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ],
  bootstrap: [App],
})
export class AppModule {}
