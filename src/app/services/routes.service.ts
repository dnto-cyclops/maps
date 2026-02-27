import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { ApiConfigService } from './api-config.service';

@Injectable({ providedIn: 'root' })
export class RoutesService {
  selected$ = new Subject<string>();
  constructor(private http: HttpClient, private apiConfig: ApiConfigService) {}
  snapshot() { return this.http.get<any[]>(`${this.apiConfig.getBaseUrl()}/routes?onlyactive=true&format=polylines`); }
  details(rId: string) {
    return this.http.get<any>(`${this.apiConfig.getBaseUrl()}/routeDetails/${rId}`); 
  }
  selectRoute(id: string) { this.selected$.next(id); }
}
