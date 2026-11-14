import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CameraService } from './camera.service';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

vi.mock('@capacitor/camera', () => {
  return {
    Camera: {
      checkPermissions: vi.fn(),
      requestPermissions: vi.fn(),
      getPhoto: vi.fn()
    },
    CameraResultType: {
      Uri: 'uri',
      Base64: 'base64',
      DataUrl: 'dataUrl'
    },
    CameraSource: {
      Prompt: 'PROMPT',
      Camera: 'CAMERA',
      Photos: 'PHOTOS'
    }
  };
});

describe('CameraService (Pruebas Automatizadas de Periférico Cámara)', () => {
  let service: CameraService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CameraService();
  });

  it('debe crearse correctamente el servicio de cámara', () => {
    expect(service).toBeTruthy();
  });

  it('debe verificar los permisos de cámara y galería de forma segura', async () => {
    vi.mocked(Camera.checkPermissions).mockResolvedValue({
      camera: 'granted',
      photos: 'granted'
    });

    const status = await service.checkPermissions();
    expect(Camera.checkPermissions).toHaveBeenCalled();
    expect(status.camera).toBe('granted');
  });

  it('debe solicitar permisos si no están otorgados', async () => {
    vi.mocked(Camera.requestPermissions).mockResolvedValue({
      camera: 'granted',
      photos: 'granted'
    });

    const granted = await service.requestPermissions();
    expect(Camera.requestPermissions).toHaveBeenCalledWith({ permissions: ['camera', 'photos'] });
    expect(granted).toBe(true);
  });

  it('debe capturar una fotografía y retornar la imagen en formato DataUrl', async () => {
    vi.mocked(Camera.checkPermissions).mockResolvedValue({
      camera: 'granted',
      photos: 'granted'
    });

    const mockPhotoDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';
    vi.mocked(Camera.getPhoto).mockResolvedValue({
      dataUrl: mockPhotoDataUrl,
      format: 'jpeg',
      saved: false
    });

    const result = await service.capturePhoto(CameraSource.Prompt);

    expect(Camera.getPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        quality: 80,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt
      })
    );
    expect(result.dataUrl).toBe(mockPhotoDataUrl);
    expect(result.cancelled).toBe(false);
  });

  it('debe manejar adecuadamente cuando el usuario cancela la captura', async () => {
    vi.mocked(Camera.checkPermissions).mockResolvedValue({
      camera: 'granted',
      photos: 'granted'
    });
    vi.mocked(Camera.getPhoto).mockRejectedValue(new Error('User cancelled photos app'));

    const result = await service.capturePhoto();

    expect(result.cancelled).toBe(true);
    expect(result.dataUrl).toBeUndefined();
  });

  it('debe retornar un mensaje descriptivo si los permisos son denegados', async () => {
    vi.mocked(Camera.checkPermissions).mockResolvedValue({
      camera: 'denied',
      photos: 'denied'
    });
    vi.mocked(Camera.requestPermissions).mockResolvedValue({
      camera: 'denied',
      photos: 'denied'
    });

    const result = await service.capturePhoto();

    expect(result.error).toContain('Permiso de cámara denegado');
  });
});
