export type TaskPriority = 'alta' | 'media' | 'baja';

export type TaskCategory = 'Trabajo' | 'Personal' | 'Estudio' | 'Salud' | 'Hogar' | 'Finanzas';

export interface TaskLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  recordedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  dueDate?: string; // Formato YYYY-MM-DD
  completed: boolean;
  createdAt: string; // ISO String
  completedAt?: string; // ISO String
  photoUrl?: string; // Base64 Data URL o ruta de la foto capturada con la cámara
  location?: TaskLocation; // Ubicación geográfica obtenida con GPS
  syncedWithCloud?: boolean; // Estado de sincronización con API / Servicio Web
  syncedAt?: string; // Timestamp de la última sincronización
  cloudId?: string | number; // Identificador en la API externa
  externalSource?: string; // 'API Remota' | 'Local'
}

export type TaskStatusFilter = 'all' | 'pending' | 'completed';
export type TaskSortOption = 'dateDesc' | 'dateAsc' | 'priority' | 'alphabetical';
