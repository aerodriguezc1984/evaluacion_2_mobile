import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, PermissionStatus } from '@capacitor/camera';

export interface CameraActionResult {
  dataUrl?: string;
  format?: string;
  cancelled?: boolean;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CameraService {
  /**
   * Verifica los permisos de acceso a la cámara y galería
   */
  async checkPermissions(): Promise<PermissionStatus> {
    try {
      return await Camera.checkPermissions();
    } catch (e: any) {
      console.warn('Error al verificar permisos de cámara:', e);
      return { camera: 'prompt', photos: 'prompt' } as PermissionStatus;
    }
  }

  /**
   * Solicita explícitamente los permisos de usuario de acuerdo con las mejores prácticas de seguridad
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const status = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
      return status.camera === 'granted' || status.photos === 'granted';
    } catch (e: any) {
      console.error('Error al solicitar permisos de cámara:', e);
      return false;
    }
  }

  /**
   * Captura una fotografía utilizando la cámara física del dispositivo o permite seleccionarla de la galería
   * @param source Origen de la imagen (Prompt para preguntar, Camera para directa, Photos para galería)
   */
  async capturePhoto(source: CameraSource = CameraSource.Prompt): Promise<CameraActionResult> {
    try {
      // 1. Verificar y solicitar permisos de usuario si es necesario
      const currentStatus = await this.checkPermissions();
      if (currentStatus.camera === 'denied') {
        const granted = await this.requestPermissions();
        if (!granted) {
          return {
            error: 'Permiso de cámara denegado. Por favor, habilita el acceso a la cámara en los ajustes de tu dispositivo.'
          };
        }
      }

      // 2. Ejecutar captura optimizada para dispositivos móviles (calidad 80 para balance entre nitidez y tamaño)
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source,
        correctOrientation: true,
        saveToGallery: false,
        promptLabelHeader: 'Evidencia fotográfica',
        promptLabelPhoto: 'Elegir de la galería',
        promptLabelPicture: 'Tomar foto con la cámara',
        promptLabelCancel: 'Cancelar'
      });

      if (!image.dataUrl) {
        return { error: 'No se pudo obtener la imagen capturada.' };
      }

      return {
        dataUrl: image.dataUrl,
        format: image.format,
        cancelled: false
      };
    } catch (error: any) {
      const errMsg = error?.message || '';
      // Si el usuario canceló la captura de manera intencional, no tratarlo como un error crítico
      if (errMsg.includes('User cancelled') || errMsg.includes('cancelled') || errMsg.includes('closed')) {
        return { cancelled: true };
      }

      console.error('Fallo al interactuar con el periférico de cámara:', error);
      return {
        error: 'No se pudo acceder a la cámara del dispositivo: ' + (errMsg || 'Error desconocido.')
      };
    }
  }

  /**
   * Método de conveniencia para tomar foto directa con la cámara
   */
  async takeDirectPhoto(): Promise<CameraActionResult> {
    return this.capturePhoto(CameraSource.Camera);
  }

  /**
   * Método de conveniencia para seleccionar foto desde el álbum
   */
  async selectFromGallery(): Promise<CameraActionResult> {
    return this.capturePhoto(CameraSource.Photos);
  }
}
