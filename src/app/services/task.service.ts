import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { Task, TaskCategory, TaskLocation, TaskPriority } from '../models/task.model';
import { AuthService } from './auth.service';
import { ApiService, SyncResult } from './api.service';

const STORAGE_KEY_PREFIX = 'taskflow_cap_tasks_';
const LEGACY_STORAGE_KEY = 'taskflow_app_tasks_v1';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private readonly defaultTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Diseñar arquitectura de la aplicación Ionic',
      description: 'Definir componentes Standalone, servicios con Signals y paleta oscura de alto contraste.',
      category: 'Trabajo',
      priority: 'alta',
      dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      completed: true,
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      completedAt: new Date(Date.now() - 86400000).toISOString(),
      syncedWithCloud: true,
      syncedAt: new Date(Date.now() - 86400000).toISOString(),
      cloudId: 101,
      location: {
        latitude: -33.4372,
        longitude: -70.6506,
        address: 'Plaza de Armas, Santiago, Región Metropolitana',
        recordedAt: new Date(Date.now() - 172800000).toISOString()
      }
    },
    {
      id: 'task-2',
      title: 'Estudiar conceptos de Angular Signals y Capacitor',
      description: 'Revisar plugins de Cámara, GPS y Capacitor Preferences para funcionamiento offline.',
      category: 'Estudio',
      priority: 'media',
      dueDate: new Date(Date.now() + 172800000).toISOString().split('T')[0],
      completed: false,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      syncedWithCloud: true,
      syncedAt: new Date(Date.now() - 80000000).toISOString(),
      cloudId: 102
    },
    {
      id: 'task-3',
      title: 'Comprar insumos y café para la semana',
      description: 'Pasar por el supermercado antes de las 19:00 hrs.',
      category: 'Hogar',
      priority: 'baja',
      dueDate: new Date().toISOString().split('T')[0],
      completed: false,
      createdAt: new Date(Date.now() - 43200000).toISOString(),
      syncedWithCloud: false
    },
    {
      id: 'task-4',
      title: 'Sesión de entrenamiento y cardio 45m',
      description: 'Completar rutina de pesas y estiramiento para mejorar energía diaria.',
      category: 'Salud',
      priority: 'media',
      dueDate: new Date(Date.now() + 259200000).toISOString().split('T')[0],
      completed: false,
      createdAt: new Date(Date.now() - 20000000).toISOString(),
      syncedWithCloud: false
    },
    {
      id: 'task-5',
      title: 'Revisar presupuesto mensual y ahorros',
      description: 'Actualizar planilla de gastos fijos y proyectar metas del trimestre.',
      category: 'Finanzas',
      priority: 'alta',
      dueDate: new Date(Date.now() + 345600000).toISOString().split('T')[0],
      completed: false,
      createdAt: new Date(Date.now() - 10000000).toISOString(),
      syncedWithCloud: true,
      syncedAt: new Date(Date.now() - 9000000).toISOString(),
      cloudId: 103
    }
  ];

  private authService = inject(AuthService);
  private apiService = inject(ApiService);

  // Signal principal que almacena la lista reactiva de tareas
  private tasksSignal = signal<Task[]>(this.loadInitialSynchronous());

  // Señales públicas y computadas
  readonly tasks = this.tasksSignal.asReadonly();

  readonly totalCount = computed(() => this.tasksSignal().length);
  readonly completedCount = computed(() => this.tasksSignal().filter(t => t.completed).length);
  readonly pendingCount = computed(() => this.tasksSignal().filter(t => !t.completed).length);
  readonly highPriorityCount = computed(() => this.tasksSignal().filter(t => t.priority === 'alta' && !t.completed).length);
  readonly unsyncedCount = computed(() => this.tasksSignal().filter(t => !t.syncedWithCloud).length);

  readonly completionPercentage = computed(() => {
    const total = this.totalCount();
    if (total === 0) return 0;
    return Math.round((this.completedCount() / total) * 100);
  });

  constructor() {
    // Carga asíncrona desde Capacitor Preferences al iniciar y al cambiar de usuario
    try {
      effect(() => {
        const user = this.authService.currentUser();
        this.loadFromCapacitorPreferences();
      });
    } catch {
      // Fallback para entornos de pruebas unitarias sin scheduler reactivo
      this.loadFromCapacitorPreferences();
    }
  }

  private getStorageKey(): string {
    const user = this.authService.currentUser();
    return user ? `${STORAGE_KEY_PREFIX}${user.id}` : `${STORAGE_KEY_PREFIX}guest`;
  }

  /**
   * Carga inicial síncrona para que la vista renderice de inmediato
   */
  private loadInitialSynchronous(): Task[] {
    try {
      if (typeof localStorage !== 'undefined') {
        const key = this.getStorageKey();
        const localData = localStorage.getItem(key) || localStorage.getItem(LEGACY_STORAGE_KEY);
        if (localData) {
          const parsed = JSON.parse(localData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Fallback a defaultTasks:', e);
    }
    return this.defaultTasks;
  }

  /**
   * Carga avanzada mediante el plugin oficial @capacitor/preferences
   */
  async loadFromCapacitorPreferences(): Promise<Task[]> {
    try {
      const key = this.getStorageKey();
      const { value } = await Preferences.get({ key });

      if (value) {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          this.tasksSignal.set(parsed);
          // Respaldo en localStorage
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, value);
          }
          return parsed;
        }
      }

      // Si no existe aún en Capacitor Preferences, verificar localStorage legacy
      if (typeof localStorage !== 'undefined') {
        const legacyData = localStorage.getItem(key) || localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyData) {
          const legacyParsed = JSON.parse(legacyData);
          if (Array.isArray(legacyParsed) && legacyParsed.length > 0) {
            await this.saveToStorage(legacyParsed);
            this.tasksSignal.set(legacyParsed);
            return legacyParsed;
          }
        }
      }
    } catch (error) {
      console.error('Error al leer de Capacitor Preferences:', error);
    }

    // Si está completamente vacío, guardar los iniciales
    await this.saveToStorage(this.defaultTasks);
    this.tasksSignal.set(this.defaultTasks);
    return this.defaultTasks;
  }

  /**
   * Persiste la lista de tareas tanto en Capacitor Preferences (nativo) como en localStorage (fallback)
   */
  private async saveToStorage(tasks: Task[]): Promise<void> {
    const key = this.getStorageKey();
    const serialized = JSON.stringify(tasks);
    try {
      // 1. Almacenamiento nativo con Capacitor Preferences
      await Preferences.set({
        key,
        value: serialized
      });
      // 2. Respaldo sincrónico
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, serialized);
      }
    } catch (e) {
      console.error('Error al guardar tareas con Capacitor Preferences:', e);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, serialized);
      }
    }
  }

  getTaskById(id: string): Task | undefined {
    return this.tasksSignal().find(t => t.id === id);
  }

  /**
   * Agrega una nueva tarea con soporte completo para evidencia fotográfica y GPS
   */
  async addTask(data: {
    title: string;
    description?: string;
    category: TaskCategory;
    priority: TaskPriority;
    dueDate?: string;
    photoUrl?: string;
    location?: TaskLocation;
  }): Promise<Task> {
    const newTask: Task = {
      id: 'task-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      title: data.title.trim(),
      description: (data.description || '').trim(),
      category: data.category,
      priority: data.priority,
      dueDate: data.dueDate,
      photoUrl: data.photoUrl,
      location: data.location,
      completed: false,
      createdAt: new Date().toISOString(),
      syncedWithCloud: false
    };

    const updated = [newTask, ...this.tasksSignal()];
    this.tasksSignal.set(updated);
    await this.saveToStorage(updated);
    return newTask;
  }

  /**
   * Actualiza una tarea existente
   */
  async updateTask(updatedTask: Task): Promise<void> {
    const current = this.tasksSignal();
    const index = current.findIndex(t => t.id === updatedTask.id);
    if (index !== -1) {
      const updatedList = [...current];
      updatedList[index] = {
        ...updatedTask,
        title: updatedTask.title.trim(),
        description: (updatedTask.description || '').trim(),
        // Si fue modificada localmente, marcar para volver a sincronizar
        syncedWithCloud: false
      };
      this.tasksSignal.set(updatedList);
      await this.saveToStorage(updatedList);
    }
  }

  /**
   * Alterna el estado de completado de una tarea
   */
  async toggleComplete(id: string): Promise<void> {
    const current = this.tasksSignal();
    const updated = current.map(task => {
      if (task.id === id) {
        const nextCompleted = !task.completed;
        return {
          ...task,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : undefined,
          syncedWithCloud: false
        };
      }
      return task;
    });
    this.tasksSignal.set(updated);
    await this.saveToStorage(updated);
  }

  /**
   * Elimina una tarea
   */
  async deleteTask(id: string): Promise<void> {
    const current = this.tasksSignal();
    const updated = current.filter(t => t.id !== id);
    this.tasksSignal.set(updated);
    await this.saveToStorage(updated);
  }

  /**
   * Limpia las tareas completadas
   */
  async clearCompleted(): Promise<void> {
    const current = this.tasksSignal();
    const updated = current.filter(t => !t.completed);
    this.tasksSignal.set(updated);
    await this.saveToStorage(updated);
  }

  /**
   * Restablece a los datos de ejemplo iniciales
   */
  async resetToDefaults(): Promise<void> {
    this.tasksSignal.set(this.defaultTasks);
    await this.saveToStorage(this.defaultTasks);
  }

  /**
   * Importa tareas desde el servicio web externo (JSONPlaceholder API)
   * y las une a la lista existente sin duplicar por título
   */
  async importTasksFromApi(limit = 5): Promise<{ added: number; total: number }> {
    const externalTasks = await this.apiService.fetchExternalTasks(limit);
    const current = this.tasksSignal();
    const existingTitles = new Set(current.map(t => t.title.toLowerCase().trim()));

    const newTasksToAdd = externalTasks.filter(ext => !existingTitles.has(ext.title.toLowerCase().trim()));
    const updated = [...newTasksToAdd, ...current];

    this.tasksSignal.set(updated);
    await this.saveToStorage(updated);

    return {
      added: newTasksToAdd.length,
      total: updated.length
    };
  }

  /**
   * Sincroniza todas las tareas pendientes con el servicio web remoto
   */
  async syncPendingTasks(): Promise<SyncResult> {
    const unsynced = this.tasksSignal().filter(t => !t.syncedWithCloud);
    if (unsynced.length === 0) {
      return {
        success: true,
        syncedCount: 0,
        failedCount: 0,
        message: 'Todas las tareas ya se encuentran sincronizadas con el servidor remoto.'
      };
    }

    const result = await this.apiService.syncBatch(unsynced);

    if (result.syncedCount > 0) {
      // Marcar como sincronizadas en el estado local
      const now = new Date().toISOString();
      const updated = this.tasksSignal().map(task => {
        if (!task.syncedWithCloud) {
          return {
            ...task,
            syncedWithCloud: true,
            syncedAt: now,
            cloudId: task.cloudId || Math.floor(Math.random() * 9000) + 1000
          };
        }
        return task;
      });

      this.tasksSignal.set(updated);
      await this.saveToStorage(updated);
    }

    return result;
  }
}
