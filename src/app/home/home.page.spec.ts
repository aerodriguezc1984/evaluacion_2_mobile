import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController, AlertController, ToastController } from '@ionic/angular';
import { HomePage } from './home.page';
import { TaskService } from '../services/task.service';
import { AuthService } from '../services/auth.service';

describe('HomePage (Pruebas Unitarias de Vista Principal)', () => {
  let component: HomePage;

  beforeEach(() => {
    const mockAuthService = {
      currentUser: vi.fn().mockReturnValue({ id: 'user-1', name: 'Andrés Demo' })
    };

    const mockTaskService = {
      tasks: vi.fn().mockReturnValue([]),
      totalCount: vi.fn().mockReturnValue(0),
      pendingCount: vi.fn().mockReturnValue(0),
      completedCount: vi.fn().mockReturnValue(0),
      unsyncedCount: vi.fn().mockReturnValue(0),
      completionPercentage: vi.fn().mockReturnValue(0)
    };

    const mockRouter = {
      navigate: vi.fn()
    };

    const mockModalCtrl = {
      create: vi.fn()
    };

    const mockAlertCtrl = {
      create: vi.fn()
    };

    const mockToastCtrl = {
      create: vi.fn().mockResolvedValue({ present: vi.fn() })
    };

    const injector = Injector.create({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: TaskService, useValue: mockTaskService },
        { provide: Router, useValue: mockRouter },
        { provide: ModalController, useValue: mockModalCtrl },
        { provide: AlertController, useValue: mockAlertCtrl },
        { provide: ToastController, useValue: mockToastCtrl }
      ]
    });

    component = runInInjectionContext(injector, () => new HomePage());
  });

  it('debe crearse correctamente la vista HomePage', () => {
    expect(component).toBeTruthy();
  });

  it('debe tener activos los filtros reactivos iniciales por defecto', () => {
    expect(component.statusFilter()).toBe('all');
    expect(component.categoryFilter()).toBe('all');
    expect(component.sortOption()).toBe('priority');
    expect(component.isSyncing()).toBe(false);
    expect(component.isImporting()).toBe(false);
  });

  it('debe calcular las iniciales del usuario correctamente', () => {
    expect(component.getUserInitials()).toBe('AD');
  });
});
