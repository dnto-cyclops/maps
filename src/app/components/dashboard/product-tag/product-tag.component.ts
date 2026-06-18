import { Component, Input } from '@angular/core';
import { FruitIconService } from '../../../services/fruit-icon.service';

/**
 * Fruit icon + product name pairing, reused by the product-weights list
 * and the recent-movements table. Resolves the icon from `iconKey` when the
 * display name differs from the marker key (e.g. "Guayabas" → "guayaba").
 */
@Component({
  selector: 'app-product-tag',
  templateUrl: './product-tag.component.html',
  styleUrls: ['./product-tag.component.scss']
})
export class ProductTagComponent {
  @Input() product = '';
  @Input() iconKey?: string;

  constructor(private fruitIconService: FruitIconService) {}

  get icon(): string {
    return this.fruitIconService.getMarkerIconPath(this.iconKey || this.product);
  }
}
