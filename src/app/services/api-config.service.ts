import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ApiConfigService {
  private apiBase: string;
  private deployedUrl = 'https://in-ova-maps.runasp.net';
  private localUrl = 'https://localhost:5001';

  constructor() {
    this.apiBase = this.getApiBase();
  }

  private getApiBase(): string {
    const currentUrl = window.location.origin;
    
    // If running on deployed domain, use the same origin
    if (currentUrl.includes('in-ova-maps.runasp.net')) {
      return `${currentUrl}/api`;
    }
    
    // If running locally (localhost or 127.0.0.1), use local API
    if (currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1')) {
      return `${this.localUrl}/api`;
    }
    
    // Default to deployed URL
    return `${this.deployedUrl}/api`;
  }

  getBaseUrl(): string {
    return this.apiBase;
  }

  getApiUrl(): string {
    return this.apiBase.replace('/api', '');
  }
}
