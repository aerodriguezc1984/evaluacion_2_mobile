import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocationService } from './location.service';
import { Geolocation } from '@capacitor/geolocation';

vi.mock('@capacitor/geolocation', () => {
  return {
    Geolocation: {
      checkPermissions: vi.fn(),
      requestPermissions: vi.fn(),
      getCurrentPosition: vi.fn()
    }
  };
});

describe('LocationService (Pruebas Automatizadas de Periférico GPS)', () => {
  let service: LocationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LocationService();
  });

  it('debe crearse correctamente el servicio de geolocalización', () => {
    expect(service).toBeTruthy();
  });

  it('debe verificar los permisos de ubicación con buenas prácticas', async () => {
    vi.mocked(Geolocation.checkPermissions).mockResolvedValue({
      location: 'granted',
      coarseLocation: 'granted'
    });

    const status = await service.checkPermissions();
    expect(Geolocation.checkPermissions).toHaveBeenCalled();
    expect(status.location).toBe('granted');
  });

  it('debe solicitar permisos si no han sido otorgados previamente', async () => {
    vi.mocked(Geolocation.requestPermissions).mockResolvedValue({
      location: 'granted',
      coarseLocation: 'granted'
    });

    const granted = await service.requestPermissions();
    expect(Geolocation.requestPermissions).toHaveBeenCalledWith({
      permissions: ['location', 'coarseLocation']
    });
    expect(granted).toBe(true);
  });

  it('debe obtener la posición GPS actual con precisión y timestamp', async () => {
    vi.mocked(Geolocation.checkPermissions).mockResolvedValue({
      location: 'granted',
      coarseLocation: 'granted'
    });

    vi.mocked(Geolocation.getCurrentPosition).mockResolvedValue({
      coords: {
        latitude: -33.4372,
        longitude: -70.6506,
        accuracy: 12,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      } as any,
      timestamp: 1700000000000
    });

    // Mock de reverse geocode para no depender de red externa en test unitario
    vi.spyOn(service, 'reverseGeocode').mockResolvedValue('Plaza de Armas, Santiago, Chile');

    const result = await service.getCurrentLocation(true);

    expect(Geolocation.getCurrentPosition).toHaveBeenCalledWith(
      expect.objectContaining({
        enableHighAccuracy: false,
        timeout: 3500
      })
    );
    expect(result.location).toBeDefined();
    expect(result.location?.latitude).toBe(-33.4372);
    expect(result.location?.longitude).toBe(-70.6506);
    expect(result.location?.accuracy).toBe(12);
    expect(result.location?.address).toBe('Plaza de Armas, Santiago, Chile');
  });

  it('debe capturar errores de timeout o señal GPS no disponible de forma clara', async () => {
    vi.mocked(Geolocation.checkPermissions).mockResolvedValue({
      location: 'granted',
      coarseLocation: 'granted'
    });

    vi.mocked(Geolocation.getCurrentPosition).mockRejectedValue(new Error('Location request timed out'));

    const result = await service.getCurrentLocation(false);

    expect(result.location).toBeUndefined();
    expect(result.error).toContain('Tiempo de espera agotado al buscar señal GPS');
  });

  it('debe generar la URL correcta para abrir la ubicación en Google Maps', () => {
    const url = service.getGoogleMapsUrl(-33.4372, -70.6506);
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=-33.4372,-70.6506');
  });
});
