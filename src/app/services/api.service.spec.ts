import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiService } from './api.service';
import { Task } from '../models/task.model';

describe('ApiService (Pruebas Automatizadas de Integración con Servicios Web y APIs)', () => {
  let service: ApiService;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    service = new ApiService();
    vi.spyOn(service, 'isOnline').mockReturnValue(true);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('debe crearse correctamente el servicio de APIs externas', () => {
    expect(service).toBeTruthy();
  });

  it('debe importar tareas desde la API REST externa (JSONPlaceholder) y mapearlas al modelo de la app', async () => {
    const mockApiResponse = [
      { userId: 1, id: 1, title: 'delectus aut autem', completed: false },
      { userId: 1, id: 2, title: 'quis ut nam facilis et officia qui', completed: true }
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse
    } as any);

    const tasks = await service.fetchExternalTasks(2);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/todos?_limit=2'),
      expect.anything()
    );
    expect(tasks.length).toBe(2);
    expect(tasks[0].title).toBe('Delectus aut autem');
    expect(tasks[0].completed).toBe(false);
    expect(tasks[0].syncedWithCloud).toBe(true);
    expect(tasks[0].externalSource).toBe('JSONPlaceholder API');
    expect(tasks[1].completed).toBe(true);
  });

  it('debe lanzar error cuando el servidor remoto responde con código de error HTTP (ej. 500)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500
    } as any);

    await expect(service.fetchExternalTasks(2)).rejects.toThrow('Error en el servidor remoto: HTTP 500');
  });

  it('debe lanzar error de conectividad cuando el dispositivo está offline', async () => {
    vi.spyOn(service, 'isOnline').mockReturnValue(false);

    await expect(service.fetchExternalTasks(2)).rejects.toThrow('Sin conexión a internet');
  });

  it('debe sincronizar una tarea enviándola al servicio web remoto vía POST/PUT', async () => {
    const mockTask: Task = {
      id: 'task-local-1',
      title: 'Comprar materiales para proyecto',
      description: 'Ir a la tienda de electrónica',
      category: 'Trabajo',
      priority: 'alta',
      completed: false,
      createdAt: new Date().toISOString()
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 205 })
    } as any);

    const result = await service.syncTaskToCloud(mockTask);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://jsonplaceholder.typicode.com/posts',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json; charset=UTF-8'
        })
      })
    );
    expect(result.success).toBe(true);
    expect(result.cloudId).toBe(205);
  });

  it('debe sincronizar en lote un conjunto de tareas y reportar el conteo consolidado', async () => {
    const mockTasks: Task[] = [
      { id: '1', title: 'T1', description: '', category: 'Trabajo', priority: 'media', completed: false, createdAt: '' },
      { id: '2', title: 'T2', description: '', category: 'Personal', priority: 'alta', completed: true, createdAt: '' }
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 101 })
    } as any);

    const result = await service.syncBatch(mockTasks);

    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(2);
    expect(result.failedCount).toBe(0);
  });

  it('debe obtener datos meteorológicos de la API Open-Meteo como dato contextual adicional', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        current_weather: {
          temperature: 21.5,
          windspeed: 10.2,
          weathercode: 1
        }
      })
    } as any);

    const weather = await service.fetchWeatherForLocation(-33.4372, -70.6506);

    expect(weather).not.toBeNull();
    expect(weather?.temperature).toBe(21.5);
    expect(weather?.condition).toBe('Parcialmente nublado');
  });
});
