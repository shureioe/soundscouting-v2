'use client';

import Link from 'next/link';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { createProject, deleteProject, getProjects, Project } from '@/lib/storage';

export default function HomePage(): React.ReactElement {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [projectName, setProjectName] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    setProjects(getProjects());
    setIsLoading(false);
  }, []);

  const sortedProjects = React.useMemo(() => {
    return [...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [projects]);

  const handleCreateProject = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = projectName.trim();
    if (!trimmed) {
      return;
    }

    const project = createProject(trimmed);
    setProjects((previous) => [...previous, project]);
    setProjectName('');
  };

  const handleDeleteProject = (id: string) => {
    const updated = deleteProject(id);
    setProjects(updated);
  };

  const linkButtonClasses = cn(
    'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors',
    'bg-neutral-800 text-neutral-100 hover:bg-neutral-700'
  );

  return (
    <section className='space-y-10'>
      <header className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <h1 className='text-3xl font-semibold text-neutral-50 sm:text-4xl'>SoundScouting</h1>
          <p className='mt-2 max-w-xl text-sm text-neutral-400'>Gestiona y organiza proyectos audiovisuales antes de salir a rodar. Crea un proyecto para comenzar a registrar localizaciones y notas clave.</p>
        </div>
        <Badge variant='success'>Hito 1</Badge>
      </header>

      <Card className='border-neutral-800 bg-neutral-900/60'>
        <CardHeader>
          <CardTitle>Nuevo proyecto</CardTitle>
          <CardDescription>Asigna un nombre para crear un nuevo proyecto de scouting.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className='flex flex-col gap-4 sm:flex-row' onSubmit={handleCreateProject}>
            <Input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder='Nombre del proyecto'
              aria-label='Nombre del proyecto'
              required
            />
            <Button type='submit' className='sm:w-40'>Crear</Button>
          </form>
        </CardContent>
      </Card>

      <section className='space-y-6'>
        <div className='flex items-center justify-between'>
          <h2 className='text-2xl font-semibold text-neutral-50'>Proyectos recientes</h2>
          <span className='text-sm text-neutral-500'>{sortedProjects.length} proyecto{sortedProjects.length === 1 ? '' : 's'}</span>
        </div>

        {isLoading ? (
          <p className='text-sm text-neutral-500'>Cargando proyectos...</p>
        ) : sortedProjects.length === 0 ? (
          <div className='rounded-lg border border-dashed border-neutral-800 bg-neutral-900/40 p-8 text-center text-sm text-neutral-400'>
            Aún no hay proyectos. Crea el primero para comenzar tu scouting de sonido.
          </div>
        ) : (
          <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
            {sortedProjects.map((project) => (
              <Card key={project.id} className='border-neutral-800 bg-neutral-900/60'>
                <CardHeader>
                  <CardTitle className='flex items-center justify-between gap-2'>
                    <span className='truncate'>{project.name}</span>
                    <Badge variant='default'>
                      {new Date(project.updatedAt).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'short'
                      })}
                    </Badge>
                  </CardTitle>
                  <CardDescription>Creado el {new Date(project.createdAt).toLocaleDateString('es-ES')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className='text-sm text-neutral-400'>Localizaciones guardadas: {project.locations.length}</p>
                </CardContent>
                <CardFooter className='flex items-center justify-between gap-2'>
                  <Button variant='ghost' className='text-sm' onClick={() => handleDeleteProject(project.id)}>Eliminar</Button>
                  <Link href={`/project/${project.id}`} className={linkButtonClasses}>
                    Abrir proyecto
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
