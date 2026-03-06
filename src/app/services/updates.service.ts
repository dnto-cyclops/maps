import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import { NotificationType } from '../enums/notification-type.enum';

@Injectable({ providedIn: 'root' })
export class UpdatesService {
  es: EventSource | null = null;
  private updates = new Subject<any>();
  
  constructor(private apiConfig: ApiConfigService) {}

  private getNotificationTypeFromEventName(eventName: string): NotificationType | null {
    switch (eventName) {
      case 'route_started':
        return NotificationType.Started;
      case 'route_updated':
        return NotificationType.Updated;
      case 'route_finished':
        return NotificationType.Finished;
      case 'route_stopped':
        return NotificationType.Stopped;
      default:
        return null;
    }
  }

  connect() {
    if (this.es) return;

    this.es = new EventSource(`${this.apiConfig.getApiUrl()}/api/updates/stream`);
    
    const handler = (eventName: string, e: Event) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        const notificationType = this.getNotificationTypeFromEventName(eventName);
        this.updates.next({ type: eventName, data, notificationType });
      } catch (err) {
        console.error('sse parse', err);
      }
    };

    this.es.addEventListener('route_started', e => handler('route_started', e));
    this.es.addEventListener('route_updated', e => handler('route_updated', e));
    this.es.addEventListener('route_finished', e => handler('route_finished', e));
    this.es.addEventListener('route_stopped', e => handler('route_stopped', e));
    this.es.addEventListener('pos_update', e => handler('pos_update', e)); // Fallback for legacy
    
    this.es.onerror = (err) => console.error('sse', err);
  }

  onUpdate(): Observable<any> { 
    return this.updates.asObservable(); 
  }
}
