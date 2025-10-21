'use client';

import Link from 'next/link';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Toast } from '@/components/ui/toast';
import { createProject, deleteProject, getProjects, Project, updateProjectName } from '@/lib/storage';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastState {
  message: string;
  variant: ToastVariant;
}

export default function HomePage(): React.ReactElement {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [projectName, setProjectName] = React.useState('');
  const [editingProjectId, setEditingProjectId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState('');
  const [toast, setToast] = React.useState<ToastState | null>(null);

  const showToast = React.useCallback((message: string, variant: ToastVariant) => {
    setToast({ message, variant });
  }, []);

  React.useEffect(() => {
    setProjects(getProjects());
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const sortedProjects = React.useMemo(() => {
    return [...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [projects]);

  const resetRenameState = React.useCallback(() => {
    setEditingProjectId(null);
    setRenameValue('');
  }, []);

  const handleCreateProject = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = projectName.trim();
      if (!trimmed) {
        showToast('Introduce un nombre para el proyecto.', 'error');
        return;
      }

      if (!window.confirm('¿Crear el proyecto "' + trimmed + '"?')) {
        return;
      }

      try {
        const project = createProject(trimmed);
        setProjects((previous) => [...previous, project]);
        setProjectName('');
        showToast('Proyecto creado correctamente.', 'success');
      } catch (error) {
        if (error instanceof Error && error.message === 'DUPLICATE_PROJECT_NAME') {
          showToast('Ya existe un proyecto con ese nombre.', 'error');
          return;
        }

        showToast('No se pudo crear el proyecto. Inténtalo de nuevo.', 'error');
      }
    },
    [projectName, showToast]
  );

  const handleDeleteProject = React.useCallback(
    (project: Project) => {
      if (!window.confirm('¿Eliminar el proyecto "' + project.name + '"? Esta acción no se puede deshacer.')) {
        return;
      }

      const updated = deleteProject(project.id);
      setProjects(updated);
      if (editingProjectId === project.id) {
        resetRenameState();
      }

      showToast('Proyecto eliminado.', 'success');
    },
    [editingProjectId, resetRenameState, showToast]
  );

  const handleRenameSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>, projectId: string) => {
      event.preventDefault();
      const trimmed = renameValue.trim();
      if (!trimmed) {
        showToast('Introduce un nombre válido.', 'error');
        return;
      }

      if (projects.some((project) => project.id !== projectId && project.name.toLowerCase() === trimmed.toLowerCase())) {
        showToast('Ya tienes otro proyecto con ese nombre.', 'error');
        return;
      }

      const updated = updateProjectName(projectId, trimmed);
      if (!updated) {
        showToast('No se pudo actualizar el nombre. Revisa que no exista otro igual.', 'error');
        return;
      }

      setProjects((previous) => previous.map((project) => (project.id === projectId ? updated : project)));
      resetRenameState();
      showToast('Proyecto actualizado.', 'success');
    },
    [projects, renameValue, resetRenameState, showToast]
  );

  return (
    <section className='space-y-10'>
      <div className='pointer-events-none fixed bottom-6 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 justify-center px-4 sm:left-auto sm:right-6 sm:translate-x-0'>
        {toast ? <Toast message={toast.message} variant={toast.variant} onDismiss={() => setToast(null)} /> : null}
      </div>

      <header className='space-y-4'>
        <div className='space-y-2'>
          <p className='text-xs font-semibold uppercase tracking-wide text-emerald-400'>Panel de proyectos</p>
          <h1 className='text-3xl font-semibold text-neutral-50 sm:text-4xl'>SoundScouting</h1>
        </div>
        <p className='max-w-2xl text-sm text-neutral-400'>Organiza tus proyectos audiovisuales, gestiona sus localizaciones y exporta informes listos para compartir con tu equipo.</p>
      </header>

      <Card className='border-neutral-800 bg-neutral-900/60'>
        <CardHeader className='space-y-2'>
          <CardTitle>Nuevo proyecto</CardTitle>
          <CardDescription>Define un nombre y crea un proyecto para comenzar a registrar localizaciones.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className='flex flex-col gap-3 sm:flex-row' onSubmit={handleCreateProject}>
            <Input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder='Nombre del proyecto'
              aria-label='Nombre del proyecto'
            />
            <Button type='submit' className='sm:w-40'>Crear</Button>
          </form>
        </CardContent>
      </Card>

      <section className='space-y-6'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h2 className='text-2xl font-semibold text-neutral-50'>Proyectos</h2>
            <p className='text-sm text-neutral-500'>Gestiona, renombra y accede rápidamente a tus scouting en curso.</p>
          </div>
          <Badge variant='default'>{sortedProjects.length} proyecto{sortedProjects.length === 1 ? '' : 's'}</Badge>
        </div>

        {isLoading ? (
          <p className='text-sm text-neutral-500'>Cargando proyectos...</p>
        ) : sortedProjects.length === 0 ? (
          <div className='rounded-lg border border-dashed border-neutral-800 bg-neutral-900/40 p-8 text-center text-sm text-neutral-400'>
            Todavía no has creado proyectos. Añade uno nuevo para comenzar tu scouting de sonido.
          </div>
        ) : (
          <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
            {sortedProjects.map((project) => {
              const isEditing = editingProjectId === project.id;
              return (
                <Card key={project.id} className='border-neutral-800 bg-neutral-900/70'>
                  <CardHeader className='space-y-3'>
                    <div className='flex items-start justify-between gap-4'>
                      <div className='min-w-0 space-y-1'>
                        <CardTitle className='text-lg'>
                          {isEditing ? project.name : <span className='line-clamp-2 break-words'>{project.name}</span>}
                        </CardTitle>
                        <CardDescription>ID: {project.id}</CardDescription>
                      </div>
                      <Badge variant='default'>Actualizado {new Date(project.updatedAt).toLocaleDateString('es-ES')}</Badge>
                    </div>
                    <Separator />
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    {isEditing ? (
                      <form className='space-y-3' onSubmit={(event) => handleRenameSubmit(event, project.id)}>
                        <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} autoFocus aria-label='Nuevo nombre del proyecto' />
                        <div className='flex flex-wrap gap-2'>
                          <Button type='submit' className='sm:w-auto'>Guardar</Button>
                          <Button type='button' variant='ghost' onClick={resetRenameState}>Cancelar</Button>
                        </div>
                      </form>
                    ) : (
                      <div className='space-y-2 text-sm text-neutral-400'>
                        <p>Localizaciones registradas: {project.locations.length}</p>
                        <p>Creado el {new Date(project.createdAt).toLocaleDateString('es-ES')}</p>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className='flex-wrap justify-between gap-2'>
                    <div className='flex gap-2'>
                      <Button
                        type='button'
                        variant='ghost'
                        onClick={() => (isEditing ? resetRenameState() : (setEditingProjectId(project.id), setRenameValue(project.name)))}
                      >
                        {isEditing ? 'Cerrar edición' : 'Renombrar'}
                      </Button>
                      <Button type='button' variant='ghost' onClick={() => handleDeleteProject(project)}>Eliminar</Button>
                    </div>
                    <Link
                      href={'/project/' + project.id}
                      className='inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-400'
                    >
                      Abrir
                    </Link>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
