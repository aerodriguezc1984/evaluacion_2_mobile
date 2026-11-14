import { Component, Input, OnInit, inject, signal, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonInput,
  IonTextarea,
  IonIcon,
  IonNote,
  IonSpinner,
  ModalController,
  ToastController,
  AlertController,
  ActionSheetController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  saveOutline,
  briefcaseOutline,
  personOutline,
  bookOutline,
  fitnessOutline,
  homeOutline,
  walletOutline,
  flagOutline,
  calendarOutline,
  pricetagOutline,
  documentTextOutline,
  cameraOutline,
  imageOutline,
  locationOutline,
  navigateOutline,
  trashOutline,
  alertCircleOutline,
  checkmarkCircleOutline,
  pinOutline,
  cloudUploadOutline
} from 'ionicons/icons';
import { CameraSource } from '@capacitor/camera';
import { Task, TaskCategory, TaskLocation, TaskPriority } from '../../models/task.model';
import { CameraService } from '../../services/camera.service';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-task-modal',
  templateUrl: './task-modal.component.html',
  styleUrls: ['./task-modal.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonInput,
    IonTextarea,
    IonIcon,
    IonNote,
    IonSpinner
  ]
})
export class TaskModalComponent implements OnInit {
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() task?: Task;

  private fb = inject(FormBuilder);
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private actionSheetCtrl = inject(ActionSheetController);
  private cameraService = inject(CameraService);
  private locationService = inject(LocationService);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  taskForm!: FormGroup;

  // Estado reactivo con Signals (asegura actualización inmediata del DOM en Angular 22)
  photoUrl = signal<string | undefined>(undefined);
  location = signal<TaskLocation | undefined>(undefined);
  isCapturingPhoto = signal<boolean>(false);
  isCapturingLocation = signal<boolean>(false);

  readonly categories: { name: TaskCategory; icon: string; color: string }[] = [
    { name: 'Trabajo', icon: 'briefcase-outline', color: '#6366f1' },
    { name: 'Personal', icon: 'person-outline', color: '#ec4899' },
    { name: 'Estudio', icon: 'book-outline', color: '#38bdf8' },
    { name: 'Salud', icon: 'fitness-outline', color: '#10b981' },
    { name: 'Hogar', icon: 'home-outline', color: '#f59e0b' },
    { name: 'Finanzas', icon: 'wallet-outline', color: '#8b5cf6' }
  ];

  readonly priorities: { value: TaskPriority; label: string; color: string; desc: string }[] = [
    { value: 'baja', label: 'Baja', color: '#10b981', desc: 'Sin apuro' },
    { value: 'media', label: 'Media', color: '#f59e0b', desc: 'Importante' },
    { value: 'alta', label: 'Alta', color: '#f43f5e', desc: 'Urgente' }
  ];

  constructor() {
    addIcons({
      closeOutline,
      saveOutline,
      briefcaseOutline,
      personOutline,
      bookOutline,
      fitnessOutline,
      homeOutline,
      walletOutline,
      flagOutline,
      calendarOutline,
      pricetagOutline,
      documentTextOutline,
      cameraOutline,
      imageOutline,
      locationOutline,
      navigateOutline,
      trashOutline,
      alertCircleOutline,
      checkmarkCircleOutline,
      pinOutline,
      cloudUploadOutline
    });
  }

  ngOnInit() {
    this.taskForm = this.fb.group({
      title: [this.task?.title || '', [Validators.required, Validators.minLength(3)]],
      description: [this.task?.description || ''],
      category: [this.task?.category || 'Trabajo', [Validators.required]],
      priority: [this.task?.priority || 'media', [Validators.required]],
      dueDate: [this.task?.dueDate || this.getDefaultDueDate()]
    });

    if (this.task) {
      this.photoUrl.set(this.task.photoUrl);
      this.location.set(this.task.location);
    }
  }

  private getDefaultDueDate(): string {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().split('T')[0];
  }

  selectCategory(category: TaskCategory) {
    this.taskForm.patchValue({ category });
  }

  selectPriority(priority: TaskPriority) {
    this.taskForm.patchValue({ priority });
  }

  // --- PERIFÉRICO: CÁMARA CON MENÚ DE OPCIONES ---
  async presentPhotoOptions() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Evidencia Fotográfica',
      buttons: [
        {
          text: 'Tomar foto con la cámara',
          icon: 'camera-outline',
          handler: () => {
            this.capturePhoto(CameraSource.Camera);
          }
        },
        {
          text: 'Elegir desde la galería / archivo',
          icon: 'image-outline',
          handler: () => {
            this.capturePhoto(CameraSource.Photos);
          }
        },
        {
          text: 'Cancelar',
          icon: 'close-outline',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  async capturePhoto(source: CameraSource = CameraSource.Prompt) {
    // Activar spinner dentro de NgZone para renderizado inmediato
    this.ngZone.run(() => {
      this.isCapturingPhoto.set(true);
      this.cdr.detectChanges();
    });

    // Timer de seguridad: desactiva el spinner en 10s máximo si el hardware no responde
    const safetyTimer = setTimeout(() => {
      this.ngZone.run(() => {
        if (this.isCapturingPhoto()) {
          this.isCapturingPhoto.set(false);
          this.cdr.detectChanges();
        }
      });
    }, 10000);

    try {
      const result = await this.cameraService.capturePhoto(source);

      this.ngZone.run(() => {
        clearTimeout(safetyTimer);
        this.isCapturingPhoto.set(false);

        if (result.dataUrl) {
          this.photoUrl.set(result.dataUrl);
          this.showToast('Foto adjuntada exitosamente', 'success');
        } else if (result.error) {
          this.showErrorAlert('Permiso de Cámara', result.error);
        }
        this.cdr.detectChanges();
      });
    } catch (e: any) {
      this.ngZone.run(() => {
        clearTimeout(safetyTimer);
        this.isCapturingPhoto.set(false);
        this.showToast('No se pudo abrir la cámara o fue cancelado', 'warning');
        this.cdr.detectChanges();
      });
    }
  }

  /**
   * Fallback nativo HTML para navegadores web de escritorio o móviles
   */
  onFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target && target.files && target.files.length > 0) {
      const file = target.files[0];
      const reader = new FileReader();

      this.ngZone.run(() => {
        this.isCapturingPhoto.set(true);
        this.cdr.detectChanges();
      });

      reader.onload = () => {
        this.ngZone.run(() => {
          this.photoUrl.set(reader.result as string);
          this.isCapturingPhoto.set(false);
          this.showToast('Foto cargada exitosamente', 'success');
          this.cdr.detectChanges();
        });
      };

      reader.onerror = () => {
        this.ngZone.run(() => {
          this.isCapturingPhoto.set(false);
          this.showToast('Error al leer el archivo seleccionado', 'danger');
          this.cdr.detectChanges();
        });
      };

      reader.readAsDataURL(file);
    }
  }

  removePhoto() {
    this.ngZone.run(() => {
      this.photoUrl.set(undefined);
      this.cdr.detectChanges();
    });
  }

  // --- PERIFÉRICO: GPS / UBICACIÓN ---
  async captureLocation() {
    // Activar spinner inmediatamente dentro de NgZone
    this.ngZone.run(() => {
      this.isCapturingLocation.set(true);
      this.cdr.detectChanges();
    });

    // Timer de seguridad: desactiva el spinner en 8s máximo para evitar cargas infinitas
    const safetyTimer = setTimeout(() => {
      this.ngZone.run(() => {
        if (this.isCapturingLocation()) {
          this.isCapturingLocation.set(false);
          this.showToast('Tiempo de espera agotado al consultar GPS', 'warning');
          this.cdr.detectChanges();
        }
      });
    }, 8000);

    try {
      const result = await this.locationService.getCurrentLocation(true);

      this.ngZone.run(() => {
        clearTimeout(safetyTimer);
        this.isCapturingLocation.set(false);

        if (result.location) {
          this.location.set(result.location);
          this.showToast('Ubicación GPS fijada exitosamente', 'success');
        } else if (result.error) {
          this.showErrorAlert('Acceso a GPS', result.error);
        }
        this.cdr.detectChanges();
      });
    } catch (e: any) {
      this.ngZone.run(() => {
        clearTimeout(safetyTimer);
        this.isCapturingLocation.set(false);
        this.showToast('No se pudo obtener la posición GPS', 'danger');
        this.cdr.detectChanges();
      });
    }
  }

  removeLocation() {
    this.ngZone.run(() => {
      this.location.set(undefined);
      this.cdr.detectChanges();
    });
  }

  cancel() {
    return this.modalCtrl.dismiss(null, 'cancel');
  }

  save() {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      return;
    }

    const formValues = this.taskForm.value;
    if (this.mode === 'edit' && this.task) {
      const updatedTask: Task = {
        ...this.task,
        title: formValues.title,
        description: formValues.description,
        category: formValues.category,
        priority: formValues.priority,
        dueDate: formValues.dueDate || undefined,
        photoUrl: this.photoUrl(),
        location: this.location()
      };
      return this.modalCtrl.dismiss(updatedTask, 'confirm');
    } else {
      const newTaskData = {
        ...formValues,
        photoUrl: this.photoUrl(),
        location: this.location()
      };
      return this.modalCtrl.dismiss(newTaskData, 'confirm');
    }
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'primary' | 'danger' = 'primary') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2200,
      position: 'bottom',
      color
    });
    await toast.present();
  }

  private async showErrorAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['Entendido']
    });
    await alert.present();
  }
}
