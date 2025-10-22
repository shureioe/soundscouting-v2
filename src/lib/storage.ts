export type LocationStatus = 'pending' | 'approved' | 'rejected';

export interface LocationCoordinates {
  lat: number;
  lng: number;
}

export interface LocationPhoto {
  id: string;
  dataUrl: string;
  createdAt: string;
  fileName?: string;
}

export interface LocationSet {
  id: string;
  name: string;
  notes: string;
  status: LocationStatus;
  photos: LocationPhoto[];
  coords?: LocationCoordinates | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  locations: LocationSet[];
}

const STORAGE_KEY = 'soundscouting-projects';

let memoryProjects: Project[] = [];

interface NormalizedProjects {
  projects: Project[];
  changed: boolean;
}

type StoredPhoto = string | LocationPhoto | null | undefined;

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
}

function normalizePhoto(entry: StoredPhoto, fallbackDate: string): { photo: LocationPhoto | null; changed: boolean } {
  if (!entry) {
    return { photo: null, changed: true };
  }

  if (typeof entry === 'string') {
    return {
      photo: {
        id: createId(),
        dataUrl: entry,
        createdAt: fallbackDate
      },
      changed: true
    };
  }

  if (typeof entry === 'object' && typeof entry.dataUrl === 'string') {
    const createdAt = typeof entry.createdAt === 'string' ? entry.createdAt : fallbackDate;
    const id = entry.id || createId();
    return {
      photo: {
        id,
        dataUrl: entry.dataUrl,
        createdAt,
        fileName: entry.fileName && typeof entry.fileName === 'string' ? entry.fileName : undefined
      },
      changed: !entry.id || entry.createdAt !== createdAt
    };
  }

  return { photo: null, changed: true };
}

function normalizeLocation(location: any): { location: LocationSet | null; changed: boolean } {
  if (!location || typeof location !== 'object') {
    return { location: null, changed: true };
  }

  const createdAt = typeof location.createdAt === 'string' ? location.createdAt : new Date().toISOString();
  const updatedAt = typeof location.updatedAt === 'string' ? location.updatedAt : createdAt;
  const photos: StoredPhoto[] = Array.isArray(location.photos) ? location.photos : [];
  const normalizedPhotos: LocationPhoto[] = [];
  let photosChanged = false;
  let coordsChanged = false;

  photos.forEach((entry: StoredPhoto) => {
    const { photo, changed } = normalizePhoto(entry, updatedAt);
    if (photo) {
      normalizedPhotos.push(photo);
    }
    if (changed) {
      photosChanged = true;
    }
  });

  let coords: LocationCoordinates | null = null;
  if (location.coords && typeof location.coords === 'object') {
    const lat = Number(location.coords.lat);
    const lng = Number(location.coords.lng);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      coords = { lat, lng };
    } else {
      coordsChanged = true;
    }
  }

  const status: LocationStatus =
    location.status === 'approved' || location.status === 'rejected' || location.status === 'pending'
      ? location.status
      : 'pending';

  return {
    location: {
      id: typeof location.id === 'string' ? location.id : createId(),
      name: typeof location.name === 'string' ? location.name : 'Localización',
      notes: typeof location.notes === 'string' ? location.notes : '',
      status,
      photos: normalizedPhotos,
      coords,
      createdAt,
      updatedAt
    },
    changed:
      photosChanged ||
      coordsChanged ||
      typeof location.id !== 'string' ||
      typeof location.name !== 'string' ||
      typeof location.notes !== 'string' ||
      location.status !== status ||
      typeof location.createdAt !== 'string' ||
      typeof location.updatedAt !== 'string'
  };
}

function normalizeProject(project: any): { project: Project | null; changed: boolean } {
  if (!project || typeof project !== 'object') {
    return { project: null, changed: true };
  }

  const createdAt = typeof project.createdAt === 'string' ? project.createdAt : new Date().toISOString();
  const updatedAt = typeof project.updatedAt === 'string' ? project.updatedAt : createdAt;
  const locations = Array.isArray(project.locations) ? project.locations : [];
  const normalizedLocations: LocationSet[] = [];
  let locationsChanged = false;

  locations.forEach((item: any) => {
    const result = normalizeLocation(item);
    if (result.location) {
      normalizedLocations.push(result.location);
    }
    if (result.changed) {
      locationsChanged = true;
    }
  });

  return {
    project: {
      id: typeof project.id === 'string' ? project.id : createId(),
      name: typeof project.name === 'string' ? project.name : 'Proyecto sin título',
      createdAt,
      updatedAt,
      locations: normalizedLocations
    },
    changed:
      locationsChanged ||
      typeof project.id !== 'string' ||
      typeof project.name !== 'string' ||
      typeof project.createdAt !== 'string' ||
      typeof project.updatedAt !== 'string'
  };
}

function normalizeProjects(raw: unknown): NormalizedProjects {
  if (!Array.isArray(raw)) {
    return { projects: [], changed: true };
  }

  const projects: Project[] = [];
  let changed = false;

  raw.forEach((item: any) => {
    const result = normalizeProject(item);
    if (result.project) {
      projects.push(result.project);
    }
    if (result.changed) {
      changed = true;
    }
  });

  return { projects, changed };
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readFromLocalStorage(): Project[] | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    const { projects, changed } = normalizeProjects(parsed);
    if (changed) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    }

    return projects;
  } catch {
    return [];
  }
}

function persist(projects: Project[]): void {
  memoryProjects = projects;
  if (isBrowser()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }
}

export function getProjects(): Project[] {
  const browserProjects = readFromLocalStorage();
  if (browserProjects) {
    memoryProjects = browserProjects;
    return browserProjects;
  }

  return memoryProjects;
}

export function saveProjects(projects: Project[]): void {
  persist(projects);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function projectNameExists(name: string, excludeId?: string): boolean {
  const normalized = normalize(name);
  return getProjects().some((project) => project.id !== excludeId && normalize(project.name) === normalized);
}

function locationNameExists(project: Project, name: string, excludeId?: string): boolean {
  const normalized = normalize(name);
  return project.locations.some((location) => location.id !== excludeId && normalize(location.name) === normalized);
}

export function createProject(name: string): Project {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('EMPTY_PROJECT_NAME');
  }

  if (projectNameExists(trimmed)) {
    throw new Error('DUPLICATE_PROJECT_NAME');
  }

  const now = new Date().toISOString();
  const project: Project = {
    id: createId(),
    name: trimmed,
    createdAt: now,
    updatedAt: now,
    locations: []
  };

  const projects = [...getProjects(), project];
  persist(projects);
  return project;
}

export function deleteProject(id: string): Project[] {
  const projects = getProjects().filter((project) => project.id !== id);
  persist(projects);
  return projects;
}

export function findProject(id: string): Project | undefined {
  return getProjects().find((project) => project.id === id);
}

export function updateProjectName(id: string, name: string): Project | undefined {
  const trimmed = name.trim();
  if (!trimmed) {
    return findProject(id);
  }

  if (projectNameExists(trimmed, id)) {
    return undefined;
  }

  const projects = getProjects().map((project) => {
    if (project.id === id) {
      return { ...project, name: trimmed, updatedAt: new Date().toISOString() };
    }

    return project;
  });

  persist(projects);
  return projects.find((project) => project.id === id);
}

export function createLocation(projectId: string, name: string): Project | undefined {
  const trimmed = name.trim();
  if (!trimmed) {
    return findProject(projectId);
  }

  const projects = getProjects().map((project) => {
    if (project.id !== projectId) {
      return project;
    }

    if (locationNameExists(project, trimmed)) {
      throw new Error('DUPLICATE_LOCATION_NAME');
    }

    const now = new Date().toISOString();
    const location: LocationSet = {
      id: createId(),
      name: trimmed,
      notes: '',
      status: 'pending',
      photos: [],
      coords: null,
      createdAt: now,
      updatedAt: now
    };

    return {
      ...project,
      updatedAt: now,
      locations: [...project.locations, location]
    };
  });

  persist(projects);
  return projects.find((project) => project.id === projectId);
}

function updateLocation(
  projectId: string,
  locationId: string,
  updater: (location: LocationSet) => LocationSet | null
): Project | undefined {
  let updatedProject: Project | undefined;

  const projects = getProjects().map((project) => {
    if (project.id !== projectId) {
      return project;
    }

    const index = project.locations.findIndex((location) => location.id === locationId);
    if (index === -1) {
      return project;
    }

    const currentLocation = project.locations[index];
    const result = updater(currentLocation);
    if (!result) {
      return project;
    }

    const now = new Date().toISOString();
    const updatedLocation: LocationSet = { ...result, id: currentLocation.id, createdAt: currentLocation.createdAt, updatedAt: now };
    const updatedLocations = [...project.locations];
    updatedLocations[index] = updatedLocation;
    updatedProject = { ...project, updatedAt: now, locations: updatedLocations };
    return updatedProject;
  });

  if (!updatedProject) {
    return undefined;
  }

  persist(projects);
  return updatedProject;
}

export function setSetStatus(projectId: string, locationId: string, status: LocationStatus): Project | undefined {
  return updateLocation(projectId, locationId, (location) => {
    if (location.status === status) {
      return { ...location };
    }

    return { ...location, status };
  });
}

export function setSetNotes(projectId: string, locationId: string, notes: string): Project | undefined {
  const trimmed = notes.trim();
  if (trimmed.length > 2000) {
    throw new Error('NOTES_TOO_LONG');
  }

  return updateLocation(projectId, locationId, (location) => {
    if (location.notes === trimmed) {
      return { ...location };
    }

    return { ...location, notes: trimmed };
  });
}

export interface AddPhotoInput {
  dataUrl: string;
  createdAt?: string;
  fileName?: string;
}

export async function preparePhoto(file: File): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('IMAGE_PROCESSING_NOT_SUPPORTED');
  }

  const bitmap =
    typeof createImageBitmap === 'function'
      ? await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions).catch(() => null)
      : null;

  let objectUrl: string | null = null;
  const imageElement = bitmap
    ? null
    : await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        objectUrl = URL.createObjectURL(file);
        image.onload = () => resolve(image);
        image.onerror = () => {
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
          }
          reject(new Error('IMAGE_LOAD_ERROR'));
        };
        image.src = objectUrl;
      });

  const width = bitmap ? bitmap.width : imageElement?.naturalWidth ?? 0;
  const height = bitmap ? bitmap.height : imageElement?.naturalHeight ?? 0;

  if (!width || !height) {
    throw new Error('INVALID_IMAGE_DIMENSIONS');
  }

  const MAX_SIZE = 2560;
  const scale = Math.min(1, MAX_SIZE / Math.max(width, height));
  const targetWidth = Math.round(width * scale) || width;
  const targetHeight = Math.round(height * scale) || height;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('CANVAS_CONTEXT_UNAVAILABLE');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, targetWidth, targetHeight);

  if (bitmap) {
    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();
  } else if (imageElement) {
    context.drawImage(imageElement, 0, 0, targetWidth, targetHeight);
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  return dataUrl;
}

export function addSetPhoto(projectId: string, locationId: string, input: string | AddPhotoInput): Project {
  const project = updateLocation(projectId, locationId, (location) => {
    const dataUrl = typeof input === 'string' ? input : input.dataUrl;
    if (location.photos.some((photo) => photo.dataUrl === dataUrl)) {
      return { ...location };
    }

    const photo: LocationPhoto = {
      id: createId(),
      dataUrl,
      createdAt: typeof input === 'string' ? new Date().toISOString() : input.createdAt ?? new Date().toISOString(),
      fileName: typeof input === 'string' ? undefined : input.fileName
    };

    return { ...location, photos: [...location.photos, photo] };
  });

  if (!project) {
    throw new Error('ADD_SET_PHOTO_FAILED');
  }

  return project;
}

export function removeSetPhoto(projectId: string, locationId: string, identifier: string): Project | undefined {
  return updateLocation(projectId, locationId, (location) => {
    const filtered = location.photos.filter((photo) => photo.id !== identifier && photo.dataUrl !== identifier);
    if (filtered.length === location.photos.length) {
      return null;
    }

    return { ...location, photos: filtered };
  });
}

export function setSetCoords(
  projectId: string,
  locationId: string,
  coords: LocationCoordinates | null
): Project | undefined {
  return updateLocation(projectId, locationId, (location) => {
    if (
      location.coords &&
      coords &&
      location.coords.lat === coords.lat &&
      location.coords.lng === coords.lng
    ) {
      return { ...location };
    }

    return { ...location, coords };
  });
}

export function deleteLocation(projectId: string, locationId: string): Project | undefined {
  const projects = getProjects().map((project) => {
    if (project.id !== projectId) {
      return project;
    }

    const filtered = project.locations.filter((location) => location.id !== locationId);
    if (filtered.length === project.locations.length) {
      return project;
    }

    const now = new Date().toISOString();
    return {
      ...project,
      updatedAt: now,
      locations: filtered
    };
  });

  persist(projects);
  return projects.find((project) => project.id === projectId);
}
