import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CoordinateService {
  
  /**
   * Convert position array to [longitude, latitude] format
   * Handles various coordinate formats and validates ranges
   */
  toLngLat(pos: number[]): [number, number] | null {
    if (!pos || pos.length < 2) {
      return null;
    }

    const a = pos[0];
    const b = pos[1];
    
    // Validate that coordinates are in valid range
    if (Math.abs(a) > 180 || Math.abs(b) > 180) {
      return null;
    }
    
    // If first value is outside latitude range (-90 to 90), it must be longitude
    if (Math.abs(a) > 90) {
      // a is longitude, b must be latitude
      if (Math.abs(b) <= 90) {
        return [a, b]; // Already in [lng, lat] format
      }
      return null;
    }
    
    // If second value is outside latitude range, it must be longitude
    if (Math.abs(b) > 90) {
      // b is longitude, a is latitude - need to swap
      if (Math.abs(a) <= 90) {
        return [b, a]; // Swap to [lng, lat] format
      }
      return null;
    }

    // Filter out coordinates near Null Island (0,0) — within ~110km radius
    // Any real coordinate within 1° of the origin is invalid for this app
    if (Math.abs(a) < 1.0 && Math.abs(b) < 1.0) {
        return null;
    }
    
    // Both values are in the overlapping range (-90 to 90)
    // Heuristic: if the second value has larger magnitude (common for longitude)
    // treat input as [lat, lng] and swap; otherwise keep as [lng, lat].
    if (Math.abs(b) > Math.abs(a) && Math.abs(b) > 20) {
      return [b, a];
    }
    return [a, b];
  }

  /**
   * Validate if coordinates are within valid bounds
   */
  isValidCoordinate(pos: number[]): boolean {
    const coord = this.toLngLat(pos);
    return coord !== null;
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(pos1: [number, number], pos2: [number, number]): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = pos1[1] * Math.PI / 180;
    const φ2 = pos2[1] * Math.PI / 180;
    const Δφ = (pos2[1] - pos1[1]) * Math.PI / 180;
    const Δλ = (pos2[0] - pos1[0]) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Validate and convert a decoded polyline point to [lng, lat] format.
   * The @googlemaps/polyline-codec decode() function ALWAYS returns [lat, lng] pairs,
   * so no heuristic is needed — the swap is deterministic.
   * Only basic range validation and null-island filtering are applied.
   */
  validatePolylinePoint(lat: number, lng: number): [number, number] | null {
    if (!isFinite(lat) || !isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    if (Math.abs(lat) < 1.0 && Math.abs(lng) < 1.0) return null;
    return [lng, lat];
  }

  /**
   * Check if two coordinates are significantly different (> ~1 meter)
   */
  isSignificantlyDifferent(pos1: number[], pos2: number[]): boolean {
    if (!pos1 || !pos2) return true;
    
    const dx = Math.abs(pos1[0] - pos2[0]);
    const dy = Math.abs(pos1[1] - pos2[1]);
    
    // ~1 meter threshold (approx)
    return dx >= 0.00001 || dy >= 0.00001;
  }
}
