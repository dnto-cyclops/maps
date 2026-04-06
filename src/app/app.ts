import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  constructor(private translateService: TranslateService) {
    translateService.addLangs(['en', 'es', 'pt']);
    translateService.setDefaultLang('es');
  }
}