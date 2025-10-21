export type LocationStatus = 'pending' | 'approved' | 'rejected';

export interface LocationSet {
  id: string;
  name: string;
  notes: string;
  status: LocationStatus;
  photos: string[];
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

export function createProject(name: string): Project {
  const now = new Date().toISOString();
  const project: Project = {
    id: createId(),
    name: name.trim(),
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

  const projects = getProjects().map((project) => {
    if (project.id === id) {
      return { ...project, name: trimmed, updatedAt: new Date().toISOString() };
    }

    return project;
  });

  persist(projects);
  return projects.find((project) => project.id === id);
}
