import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { TaskService } from './task.service';
import { Preferences } from '@capacitor/preferences';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';

vi.mock('@capacitor/preferences', () => {
  return {
    Preferences: {
      get: vi.fn().mockResolvedValue({ value: null }),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined)
    }
  };
});

describe('TaskService (Almacenamiento Local Avanzado con Capacitor y CRUD)', () => {
  let service: TaskService;
  let mockAuthService: any;
  let mockApiService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthService = {
      currentUser: vi.fn().mockReturnValue({
        id: 'user-123',
        name: 'Usuario Demo',
        email: 'demo@test.com',
        createdAt: ''
      })
    };

    mockApiService = {
      fetchExternalTasks: vi.fn().mockResolvedValue([
        {
          id: 'ext-1',
          title: 'Tarea Remota 1',
          description: 'Desc',
          category: 'Trabajo',
          priority: 'alta',
          completed: false,
          createdAt: new Date().toISOString(),
          syncedWithCloud: true
        }
      ]),
      syncBatch: vi.fn().mockResolvedValue({
        success: true,
        syncedCount: 1,
        failedCount: 0,
        message: 'OK'
      })
    };

    const injector = Injector.create({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ApiService, useValue: mockApiService }
      ]
    });

    service = runInInjectionContext(injector, () => new TaskService());
  });

  it('debe inicializarse y cargar tareas reactivas con Signals', () => {
    expect(service).toBeTruthy();
    expect(service.tasks().length).toBeGreaterThan(0);
  });

  it('debe agregar una nueva tarea con evidencia de cámara y ubicación GPS', async () => {
    const initialCount = service.totalCount();

    const created = await service.addTask({
      title: 'Inspeccionar servidor en terreno',
      description: 'Tomar foto del rack de comunicaciones y fijar GPS',
      category: 'Trabajo',
      priority: 'alta',
      photoUrl: 'data:image/jpeg;base64,samplephoto123',
      location: {
        latitude: -33.4372,
        longitude: -70.6506,
        accuracy: 10,
        address: 'Plaza de Armas, Santiago',
        recordedAt: new Date().toISOString()
      }
    });

    expect(service.totalCount()).toBe(initialCount + 1);
    expect(created.photoUrl).toBe('data:image/jpeg;base64,samplephoto123');
    expect(created.location?.latitude).toBe(-33.4372);
    expect(created.syncedWithCloud).toBe(false);

    // Debe persistir mediante Capacitor Preferences
    expect(Preferences.set).toHaveBeenCalled();
  });

  it('debe alternar el estado de completada de una tarea', async () => {
    const first = service.tasks()[0];
    const initialStatus = first.completed;

    await service.toggleComplete(first.id);

    const updated = service.getTaskById(first.id);
    expect(updated?.completed).toBe(!initialStatus);
  });

  it('debe eliminar una tarea de la lista', async () => {
    const first = service.tasks()[0];
    const initialCount = service.totalCount();

    await service.deleteTask(first.id);

    expect(service.totalCount()).toBe(initialCount - 1);
    expect(service.getTaskById(first.id)).toBeUndefined();
  });

  it('debe importar tareas desde la API y agregarlas a la lista sin duplicados', async () => {
    const initialCount = service.totalCount();

    const result = await service.importTasksFromApi(1);

    expect(mockApiService.fetchExternalTasks).toHaveBeenCalled();
    expect(result.added).toBe(1);
    expect(service.totalCount()).toBe(initialCount + 1);
  });

  it('debe sincronizar tareas pendientes con el servicio web y actualizar el indicador syncedWithCloud', async () => {
    // Agregar una tarea no sincronizada
    await service.addTask({
      title: 'Tarea para subir a la nube',
      category: 'Finanzas',
      priority: 'media'
    });

    expect(service.unsyncedCount()).toBeGreaterThan(0);

    const syncResult = await service.syncPendingTasks();

    expect(mockApiService.syncBatch).toHaveBeenCalled();
    expect(syncResult.success).toBe(true);
  });
});
