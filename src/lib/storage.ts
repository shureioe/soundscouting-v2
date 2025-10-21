export type LocationStatus = 'pending' | 'approved' | 'rejected';

export interface LocationCoordinates {
  lat: number;
  lng: number;
}

export interface LocationSet {
  id: string;
  name: string;
  notes: string;
  status: LocationStatus;
  photos: string[];
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

    const parsed = JSON.parse(raw) as Project[];
    return Array.isArray(parsed) ? parsed : [];
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

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
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
  if (notes.length > 2000) {
    throw new Error('NOTES_TOO_LONG');
  }

  return updateLocation(projectId, locationId, (location) => {
    if (location.notes === notes) {
      return { ...location };
    }

    return { ...location, notes };
  });
}

export function addSetPhoto(projectId: string, locationId: string, dataUrl: string): Project | undefined {
  return updateLocation(projectId, locationId, (location) => {
    if (location.photos.includes(dataUrl)) {
      return { ...location };
    }

    return { ...location, photos: [...location.photos, dataUrl] };
  });
}

export function removeSetPhoto(projectId: string, locationId: string, dataUrl: string): Project | undefined {
  return updateLocation(projectId, locationId, (location) => {
    const filtered = location.photos.filter((photo) => photo !== dataUrl);
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
