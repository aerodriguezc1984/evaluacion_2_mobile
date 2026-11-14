import { Injectable } from '@angular/core';
import { Geolocation, PermissionStatus, Position } from '@capacitor/geolocation';
import { TaskLocation } from '../models/task.model';

export interface LocationResult {
  location?: TaskLocation;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  /**
   * Verifica los permisos de geolocalización
   */
  async checkPermissions(): Promise<PermissionStatus> {
    try {
      return await Geolocation.checkPermissions();
    } catch (e: any) {
      console.warn('Error al verificar permisos de geolocalización:', e);
      return { location: 'prompt', coarseLocation: 'prompt' } as PermissionStatus;
    }
  }

  /**
   * Solicita explícitamente los permisos de GPS al usuario
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const status = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
      return status.location === 'granted' || status.coarseLocation === 'granted';
    } catch (e: any) {
      console.error('Error al solicitar permisos de geolocalización:', e);
      return false;
    }
  }

  /**
   * Obtiene las coordenadas geográficas actuales del dispositivo (GPS)
   * y opcionalmente resuelve el nombre de la dirección mediante geocodificación inversa.
   */
  async getCurrentLocation(resolveAddress = true): Promise<LocationResult> {
    try {
      // 1. Verificación y solicitud de permisos
      const currentStatus = await this.checkPermissions();
      if (currentStatus.location === 'denied') {
        const granted = await this.requestPermissions();
        if (!granted) {
          return {
            error: 'Permiso de ubicación denegado. Habilita los permisos de GPS en los ajustes de tu dispositivo.'
          };
        }
      }

      // 2. Consulta de coordenadas con alta precisión y timeout controlado
      const position: Position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 5000
      });

      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const accuracy = Math.round(position.coords.accuracy);

      let address: string | undefined = undefined;

      // 3. Geocodificación inversa para traducir coordenadas a dirección humana
      if (resolveAddress) {
        try {
          address = await this.reverseGeocode(lat, lon);
        } catch (geoErr) {
          console.warn('No se pudo resolver la dirección textual:', geoErr);
          address = `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;
        }
      }

      const taskLocation: TaskLocation = {
        latitude: lat,
        longitude: lon,
        accuracy,
        address,
        recordedAt: new Date(position.timestamp).toISOString()
      };

      return { location: taskLocation };
    } catch (error: any) {
      console.error('Error al obtener ubicación GPS:', error);
      let errorMsg = 'No se pudo obtener la ubicación actual.';

      const errLower = (error?.message || '').toLowerCase();
      if (errLower.includes('timeout') || errLower.includes('timed out') || error?.code === 3) {
        errorMsg = 'Tiempo de espera agotado al buscar señal GPS. Asegúrate de tener el GPS activado.';
      } else if (errLower.includes('denied') || error?.code === 1) {
        errorMsg = 'Acceso a la ubicación denegado por el usuario o por el sistema.';
      } else if (error?.message) {
        errorMsg = error.message;
      }

      return { error: errorMsg };
    }
  }

  /**
   * Geocodificación inversa utilizando la API abierta de OpenStreetMap Nominatim
   */
  async reverseGeocode(lat: number, lon: number): Promise<string> {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TaskFlowApp-IonicEvaluation2/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }

    const data = await response.json();
    if (data && data.address) {
      const road = data.address.road || data.address.pedestrian || data.address.suburb || '';
      const houseNumber = data.address.house_number ? ` ${data.address.house_number}` : '';
      const city = data.address.city || data.address.town || data.address.village || data.address.county || '';
      const state = data.address.state || '';

      const parts = [
        road ? `${road}${houseNumber}` : '',
        city,
        state
      ].filter(Boolean);

      if (parts.length > 0) {
        return parts.join(', ');
      }
    }

    return data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }

  /**
   * Genera el enlace directo para visualizar la ubicación en Google Maps
   */
  getGoogleMapsUrl(latitude: number, longitude: number): string {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }
}
