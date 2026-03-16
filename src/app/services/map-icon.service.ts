import { Injectable } from '@angular/core';
import maplibregl from 'maplibre-gl';

@Injectable({
  providedIn: 'root',
})
export class MapIconService {
  private iconsLoaded = false;

  async loadIcons(map: maplibregl.Map): Promise<void> {
    if (this.iconsLoaded) return;

    const icons = [
      {
        id: 'start-flag',
        svg: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9.5" fill="#306C2D" stroke="#306C2D"/></svg>`,
      },
      {
        id: 'end-flag',
        svg: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9" fill="white" stroke="#306C2D" stroke-width="2"/></svg>`,
      },
      {
        id: 'stop-marker',
        svg: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="9" r="7" fill="#BE0000" stroke="white" stroke-width="2"/></svg>`,
      },
      {
        id: 'vehicle-icon',
        svg: `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
<circle cx="18" cy="18" r="17" fill="#306C2D" stroke="#F4F4F4" stroke-width="2"/>
<path d="M27.9547 17.1406L26.8609 14.4062C26.7681 14.1749 26.608 13.9767 26.4013 13.8374C26.1946 13.6982 25.9508 13.6241 25.7016 13.625H23V13C23 12.8342 22.9342 12.6753 22.8169 12.5581C22.6997 12.4408 22.5408 12.375 22.375 12.375H10.5C10.1685 12.375 9.85054 12.5067 9.61612 12.7411C9.3817 12.9755 9.25 13.2935 9.25 13.625V22.375C9.25 22.7065 9.3817 23.0245 9.61612 23.2589C9.85054 23.4933 10.1685 23.625 10.5 23.625H11.8281C11.9658 24.1628 12.2786 24.6394 12.7171 24.9798C13.1556 25.3202 13.6949 25.5049 14.25 25.5049C14.8051 25.5049 15.3444 25.3202 15.7829 24.9798C16.2214 24.6394 16.5342 24.1628 16.6719 23.625H20.5781C20.7158 24.1628 21.0286 24.6394 21.4671 24.9798C21.9056 25.3202 22.4449 25.5049 23 25.5049C23.5551 25.5049 24.0944 25.3202 24.5329 24.9798C24.9714 24.6394 25.2842 24.1628 25.4219 23.625H26.75C27.0815 23.625 27.3995 23.4933 27.6339 23.2589C27.8683 23.0245 28 22.7065 28 22.375V17.375C28.0002 17.2947 27.9848 17.2151 27.9547 17.1406ZM23 14.875H25.7016L26.4516 16.75H23V14.875ZM10.5 13.625H21.75V18.625H10.5V13.625ZM14.25 24.25C14.0028 24.25 13.7611 24.1767 13.5555 24.0393C13.35 23.902 13.1898 23.7068 13.0952 23.4784C13.0005 23.2499 12.9758 22.9986 13.024 22.7561C13.0722 22.5137 13.1913 22.2909 13.3661 22.1161C13.5409 21.9413 13.7637 21.8222 14.0061 21.774C14.2486 21.7258 14.4999 21.7505 14.7284 21.8451C14.9568 21.9398 15.152 22.1 15.2893 22.3055C15.4267 22.5111 15.5 22.7528 15.5 23C15.5 23.3315 15.3683 23.6495 15.1339 23.8839C14.8995 24.1183 14.5815 24.25 14.25 24.25ZM20.5781 22.375H16.6719C16.5342 21.8372 16.2214 21.3606 15.7829 21.0202C15.3444 20.6798 14.8051 20.4951 14.25 20.4951C13.6949 20.4951 13.1556 20.6798 12.7171 21.0202C12.2786 21.3606 11.9658 21.8372 11.8281 22.375H10.5V19.875H21.75V20.8367C21.4626 21.0028 21.211 21.2243 21.0099 21.4884C20.8087 21.7525 20.662 22.0538 20.5781 22.375ZM23 24.25C22.7528 24.25 22.5111 24.1767 22.3055 24.0393C22.1 23.902 21.9398 23.7068 21.8451 23.4784C21.7505 23.2499 21.7258 22.9986 21.774 22.7561C21.8222 22.5137 21.9413 22.2909 22.1161 22.1161C22.2909 21.9413 22.5137 21.8222 22.7561 21.774C22.9986 21.7258 23.2499 21.7505 23.4784 21.8451C23.7068 21.9398 23.902 22.1 24.0393 22.3055C24.1767 22.5111 24.25 22.7528 24.25 23C24.25 23.3315 24.1183 23.6495 23.8839 23.8839C23.6495 24.1183 23.3315 24.25 23 24.25ZM26.75 22.375H25.4219C25.2825 21.8385 24.9692 21.3635 24.5309 21.0242C24.0927 20.6849 23.5543 20.5005 23 20.5V18H26.75V22.375Z" fill="#F4F4F4"/>
</svg>
`,
      },
      {
        id: 'vehicle-icon-selected',
        svg: `<svg width="42" height="43" viewBox="0 0 42 43" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g filter="url(#filter0_d_885_660)">
              <circle cx="21" cy="18" r="18" fill="white"/>
              <circle cx="21" cy="18" r="17.5" stroke="#306C2D"/>
              </g>
              <path d="M30.9547 17.1406L29.8609 14.4062C29.7681 14.1749 29.608 13.9767 29.4013 13.8374C29.1946 13.6982 28.9508 13.6241 28.7016 13.625H26V13C26 12.8342 25.9342 12.6753 25.8169 12.5581C25.6997 12.4408 25.5408 12.375 25.375 12.375H13.5C13.1685 12.375 12.8505 12.5067 12.6161 12.7411C12.3817 12.9755 12.25 13.2935 12.25 13.625V22.375C12.25 22.7065 12.3817 23.0245 12.6161 23.2589C12.8505 23.4933 13.1685 23.625 13.5 23.625H14.8281C14.9658 24.1628 15.2786 24.6394 15.7171 24.9798C16.1556 25.3202 16.6949 25.5049 17.25 25.5049C17.8051 25.5049 18.3444 25.3202 18.7829 24.9798C19.2214 24.6394 19.5342 24.1628 19.6719 23.625H23.5781C23.7158 24.1628 24.0286 24.6394 24.4671 24.9798C24.9056 25.3202 25.4449 25.5049 26 25.5049C26.5551 25.5049 27.0944 25.3202 27.5329 24.9798C27.9714 24.6394 28.2842 24.1628 28.4219 23.625H29.75C30.0815 23.625 30.3995 23.4933 30.6339 23.2589C30.8683 23.0245 31 22.7065 31 22.375V17.375C31.0002 17.2947 30.9848 17.2151 30.9547 17.1406ZM26 14.875H28.7016L29.4516 16.75H26V14.875ZM13.5 13.625H24.75V18.625H13.5V13.625ZM17.25 24.25C17.0028 24.25 16.7611 24.1767 16.5555 24.0393C16.35 23.902 16.1898 23.7068 16.0952 23.4784C16.0005 23.2499 15.9758 22.9986 16.024 22.7561C16.0722 22.5137 16.1913 22.2909 16.3661 22.1161C16.5409 21.9413 16.7637 21.8222 17.0061 21.774C17.2486 21.7258 17.4999 21.7505 17.7284 21.8451C17.9568 21.9398 18.152 22.1 18.2893 22.3055C18.4267 22.5111 18.5 22.7528 18.5 23C18.5 23.3315 18.3683 23.6495 18.1339 23.8839C17.8995 24.1183 17.5815 24.25 17.25 24.25ZM23.5781 22.375H19.6719C19.5342 21.8372 19.2214 21.3606 18.7829 21.0202C18.3444 20.6798 17.8051 20.4951 17.25 20.4951C16.6949 20.4951 16.1556 20.6798 15.7171 21.0202C15.2786 21.3606 14.9658 21.8372 14.8281 22.375H13.5V19.875H24.75V20.8367C24.4626 21.0028 24.211 21.2243 24.0099 21.4884C23.8087 21.7525 23.662 22.0538 23.5781 22.375ZM26 24.25C25.7528 24.25 25.5111 24.1767 25.3055 24.0393C25.1 23.902 24.9398 23.7068 24.8451 23.4784C24.7505 23.2499 24.7258 22.9986 24.774 22.7561C24.8222 22.5137 24.9413 22.2909 25.1161 22.1161C25.2909 21.9413 25.5137 21.8222 25.7561 21.774C25.9986 21.7258 26.2499 21.7505 26.4784 21.8451C26.7068 21.9398 26.902 22.1 27.0393 22.3055C27.1767 22.5111 27.25 22.7528 27.25 23C27.25 23.3315 27.1183 23.6495 26.8839 23.8839C26.6495 24.1183 26.3315 24.25 26 24.25ZM29.75 22.375H28.4219C28.2825 21.8385 27.9692 21.3635 27.5309 21.0242C27.0927 20.6849 26.5543 20.5005 26 20.5V18H29.75V22.375Z" fill="#306C2D"/>
              <defs>
              <filter id="filter0_d_885_660" x="0" y="0" width="42" height="43" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
              <feFlood flood-opacity="0" result="BackgroundImageFix"/>
              <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
              <feMorphology radius="3" operator="erode" in="SourceAlpha" result="effect1_dropShadow_885_660"/>
              <feOffset dy="4"/>
              <feGaussianBlur stdDeviation="3"/>
              <feComposite in2="hardAlpha" operator="out"/>
              <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
              <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_885_660"/>
              <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_885_660" result="shape"/>
              </filter>
              </defs>
              </svg>
        `,
      },
      {
        id: 'cluster-icon',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#3b82f6" stroke="#ffffff" stroke-width="2"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">{{count}}</text></svg>',
      },
    ];

    const loadPromises = icons.map((icon) => this.loadIcon(map, icon.id, icon.svg));
    await Promise.all(loadPromises);
    this.iconsLoaded = true;
  }

  private loadIcon(map: maplibregl.Map, id: string, svg: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image(32, 32);
      img.onload = () => {
        try {
          if (!map.hasImage(id)) {
            map.addImage(id, img);
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error(`Failed to load icon: ${id}`));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  /**
   * Create a cluster icon with the given count number
   */
  createClusterIcon(map: maplibregl.Map, count: number): Promise<void> {
    const iconId = `cluster-${count}`;

    // Check if already loaded
    if (map.hasImage(iconId)) {
      return Promise.resolve();
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" fill="#3b82f6" stroke="#ffffff" stroke-width="2"/>
      <text x="20" y="25" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${count}</text>
    </svg>`;

    return this.loadIcon(map, iconId, svg);
  }

  /**
   * Create collapse button icon for expanded clusters
   */
  createCollapseButtonIcon(map: maplibregl.Map): Promise<void> {
    const iconId = 'collapse-btn';

    // Check if already loaded
    if (map.hasImage(iconId)) {
      return Promise.resolve();
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="16" fill="#ffffff" fill-opacity="0.95" stroke="#3b82f6" stroke-width="2"/>
      <path d="M12 12 L24 24 M24 12 L12 24" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`;

    return this.loadIcon(map, iconId, svg);
  }

  isLoaded(): boolean {
    return this.iconsLoaded;
  }

  async loadFruitIcons(map: maplibregl.Map, slugs: string[]): Promise<void> {
    const promises = slugs.flatMap(slug => [
      this.loadSvgFromAssets(map, `fruit-${slug}`,          `assets/icons/fruits/${slug}.svg`),      // ← fruits/
      this.loadSvgFromAssets(map, `fruit-${slug}-selected`, `assets/icons/fruits/${slug}-selected.svg`), // ← fruits/
    ]);
    await Promise.allSettled(promises);
  }

  private loadSvgFromAssets(map: maplibregl.Map, iconId: string, url: string): Promise<void> {
    return new Promise((resolve) => {
      if (map.hasImage(iconId)) { resolve(); return; }
      const img = new Image(36, 36);
      img.onload = () => {
        try { if (!map.hasImage(iconId)) map.addImage(iconId, img); } catch {}
        resolve();
      };

      img.src = url;
    });
  }
}
