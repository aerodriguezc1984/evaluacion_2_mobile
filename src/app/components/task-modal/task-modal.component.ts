import { Component, Input, OnInit, inject } from '@angular/core';
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
  AlertController
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
  pinOutline
} from 'ionicons/icons';
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
  private cameraService = inject(CameraService);
  private locationService = inject(LocationService);

  taskForm!: FormGroup;

  // Estado de periféricos
  photoUrl?: string;
  location?: TaskLocation;
  isCapturingPhoto = false;
  isCapturingLocation = false;

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
      pinOutline
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
      this.photoUrl = this.task.photoUrl;
      this.location = this.task.location;
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

  // --- PERIFÉRICO: CÁMARA ---
  async capturePhoto() {
    this.isCapturingPhoto = true;
    try {
      const result = await this.cameraService.capturePhoto();
      if (result.dataUrl) {
        this.photoUrl = result.dataUrl;
        await this.showToast('Foto adjuntada exitosamente', 'success');
      } else if (result.error) {
        await this.showErrorAlert('Permiso de Cámara', result.error);
      }
    } catch (e: any) {
      await this.showToast('No se pudo abrir la cámara', 'danger');
    } finally {
      this.isCapturingPhoto = false;
    }
  }

  removePhoto() {
    this.photoUrl = undefined;
  }

  // --- PERIFÉRICO: GPS / UBICACIÓN ---
  async captureLocation() {
    this.isCapturingLocation = true;
    try {
      const result = await this.locationService.getCurrentLocation(true);
      if (result.location) {
        this.location = result.location;
        await this.showToast('Ubicación GPS registrada correctamente', 'success');
      } else if (result.error) {
        await this.showErrorAlert('Permiso de GPS', result.error);
      }
    } catch (e: any) {
      await this.showToast('No se pudo obtener la posición GPS', 'danger');
    } finally {
      this.isCapturingLocation = false;
    }
  }

  removeLocation() {
    this.location = undefined;
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
        photoUrl: this.photoUrl,
        location: this.location
      };
      return this.modalCtrl.dismiss(updatedTask, 'confirm');
    } else {
      const newTaskData = {
        ...formValues,
        photoUrl: this.photoUrl,
        location: this.location
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
