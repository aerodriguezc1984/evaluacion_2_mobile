import { Injectable } from '@angular/core';
import { Task, TaskCategory, TaskPriority } from '../models/task.model';

export interface ExternalTodoDto {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  message: string;
}

export interface WeatherData {
  temperature: number;
  windspeed: number;
  weathercode: number;
  condition: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = 'https://jsonplaceholder.typicode.com';

  /**
   * Determina si el dispositivo cuenta con conexión a internet activa
   */
  isOnline(): boolean {
    if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined') {
      return window.navigator.onLine ?? true;
    }
    return true;
  }

  /**
   * Importa tareas desde un servicio web REST externo (JSONPlaceholder)
   * y las mapea al formato de la aplicación con categorías y prioridades acordes.
   * @param limit Número máximo de tareas a importar (por defecto 6)
   */
  async fetchExternalTasks(limit = 6): Promise<Task[]> {
    if (!this.isOnline()) {
      throw new Error('Sin conexión a internet. No se pueden importar tareas remotas.');
    }

    try {
      const response = await fetch(`${this.baseUrl}/todos?_limit=${limit}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Error en el servidor remoto: HTTP ${response.status}`);
      }

      const externalTodos: ExternalTodoDto[] = await response.json();

      const categories: TaskCategory[] = ['Trabajo', 'Estudio', 'Personal', 'Hogar', 'Finanzas'];
      const priorities: TaskPriority[] = ['alta', 'media', 'baja'];

      const mappedTasks: Task[] = externalTodos.map((todo, idx) => {
        // Asignación distribuida de categorías y prioridades
        const category = categories[idx % categories.length];
        const priority = priorities[idx % priorities.length];

        return {
          id: `ext-task-${Date.now()}-${todo.id}`,
          title: this.capitalizeTitle(todo.title),
          description: `Tarea importada desde API Externa (ID remoto: ${todo.id}). Sincronizada con el servicio web.`,
          category,
          priority,
          completed: todo.completed,
          createdAt: new Date().toISOString(),
          dueDate: new Date(Date.now() + 86400000 * ((idx % 4) + 1)).toISOString().split('T')[0],
          completedAt: todo.completed ? new Date().toISOString() : undefined,
          syncedWithCloud: true,
          syncedAt: new Date().toISOString(),
          cloudId: todo.id,
          externalSource: 'JSONPlaceholder API'
        };
      });

      return mappedTasks;
    } catch (error: any) {
      console.error('Error al importar tareas desde la API externa:', error);
      throw new Error(error.message || 'Error desconocido al comunicar con el servicio web.');
    }
  }

  /**
   * Sincroniza una tarea individual enviándola al servicio web remoto vía HTTP POST / PUT
   */
  async syncTaskToCloud(task: Task): Promise<{ success: boolean; cloudId?: number; error?: string }> {
    if (!this.isOnline()) {
      return { success: false, error: 'Dispositivo sin conexión a internet.' };
    }

    try {
      const payload = {
        title: task.title,
        body: task.description || 'Sin descripción',
        userId: 1,
        completed: task.completed,
        category: task.category,
        priority: task.priority,
        location: task.location || null
      };

      const endpoint = task.cloudId
        ? `${this.baseUrl}/posts/${task.cloudId}`
        : `${this.baseUrl}/posts`;

      const method = task.cloudId ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json; charset=UTF-8'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        return { success: false, error: `Respuesta del servidor: HTTP ${response.status}` };
      }

      const result = await response.json();
      return {
        success: true,
        cloudId: result.id || Math.floor(Math.random() * 1000) + 100
      };
    } catch (error: any) {
      console.error('Fallo en sincronización con la nube:', error);
      return { success: false, error: error.message || 'Error de red al sincronizar' };
    }
  }

  /**
   * Sincroniza en lote todas las tareas pendientes de sincronización
   */
  async syncBatch(tasks: Task[]): Promise<SyncResult> {
    if (!this.isOnline()) {
      return {
        success: false,
        syncedCount: 0,
        failedCount: tasks.length,
        message: 'No hay conexión de red para sincronizar tareas con el servicio web.'
      };
    }

    let synced = 0;
    let failed = 0;

    for (const task of tasks) {
      const res = await this.syncTaskToCloud(task);
      if (res.success) {
        synced++;
      } else {
        failed++;
      }
    }

    return {
      success: failed === 0,
      syncedCount: synced,
      failedCount: failed,
      message: `Sincronización finalizada: ${synced} sincronizadas correctamente${failed > 0 ? `, ${failed} con fallos` : ''}.`
    };
  }

  /**
   * Obtiene datos meteorológicos en tiempo real desde la API Open-Meteo
   * como dato adicional enriquecido para la ubicación de una tarea.
   */
  async fetchWeatherForLocation(lat: number, lon: number): Promise<WeatherData | null> {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
      const res = await fetch(url);
      if (!res.ok) return null;

      const data = await res.json();
      const current = data.current_weather;
      if (!current) return null;

      return {
        temperature: current.temperature,
        windspeed: current.windspeed,
        weathercode: current.weathercode,
        condition: this.interpretWeatherCode(current.weathercode)
      };
    } catch (e) {
      console.warn('No se pudo obtener datos del clima:', e);
      return null;
    }
  }

  private interpretWeatherCode(code: number): string {
    if (code === 0) return 'Despejado';
    if (code === 1 || code === 2 || code === 3) return 'Parcialmente nublado';
    if (code >= 45 && code <= 48) return 'Niebla';
    if (code >= 51 && code <= 67) return 'Llovizna / Lluvia ligera';
    if (code >= 71 && code <= 77) return 'Nieve';
    if (code >= 80 && code <= 82) return 'Chubascos';
    if (code >= 95) return 'Tormenta';
    return 'Nublado';
  }

  private capitalizeTitle(text: string): string {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}
