'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Toast } from '@/components/ui/toast';
import { exportProjectPdf } from '@/lib/pdf';
import { createLocation, deleteLocation, findProject, Project, updateProjectName } from '@/lib/storage';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastState {
  message: string;
  variant: ToastVariant;
}

const statusLabels: Record<string, { label: string; badge: 'default' | 'success' | 'danger' }> = {
  pending: { label: 'Pendiente', badge: 'default' },
  approved: { label: 'Apta', badge: 'success' },
  rejected: { label: 'No apta', badge: 'danger' }
};

export default function ProjectPage(): React.ReactElement {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = React.useState<Project | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [projectName, setProjectName] = React.useState('');
  const [locationName, setLocationName] = React.useState('');
  const [toast, setToast] = React.useState<ToastState | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  const showToast = React.useCallback((message: string, variant: ToastVariant) => {
    setToast({ message, variant });
  }, []);

  React.useEffect(() => {
    if (!params?.id) {
      return;
    }

    const current = findProject(params.id);
    if (!current) {
      setIsLoading(false);
      setProject(null);
      return;
    }

    setProject(current);
    setProjectName(current.name);
    setIsLoading(false);
  }, [params?.id]);

  React.useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const sortedLocations = React.useMemo(() => {
    if (!project) {
      return [] as Project['locations'];
    }

    return [...project.locations].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [project]);

  const handleRename = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!project) {
        return;
      }

      const trimmed = projectName.trim();
      if (!trimmed) {
        showToast('Introduce un nombre válido para el proyecto.', 'error');
        return;
      }

      if (trimmed.toLowerCase() === project.name.toLowerCase()) {
        showToast('El nombre ya está actualizado.', 'info');
        return;
      }

      if (!window.confirm('¿Renombrar el proyecto a "' + trimmed + '"?')) {
        return;
      }

      const updated = updateProjectName(project.id, trimmed);
      if (!updated) {
        showToast('Ya existe otro proyecto con ese nombre.', 'error');
        return;
      }

      setProject(updated);
      setProjectName(updated.name);
      showToast('Proyecto renombrado correctamente.', 'success');
    },
    [project, projectName, showToast]
  );

  const handleCreateLocation = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!project) {
        return;
      }

      const trimmed = locationName.trim();
      if (!trimmed) {
        showToast('Introduce un nombre para la localización.', 'error');
        return;
      }

      if (!window.confirm('¿Crear la localización "' + trimmed + '"?')) {
        return;
      }

      try {
        const updated = createLocation(project.id, trimmed);
        if (!updated) {
          showToast('No se pudo crear la localización. Inténtalo de nuevo.', 'error');
          return;
        }

        setProject(updated);
        setLocationName('');
        showToast('Localización añadida.', 'success');
      } catch (error) {
        if (error instanceof Error && error.message === 'DUPLICATE_LOCATION_NAME') {
          showToast('Ya existe una localización con ese nombre en el proyecto.', 'error');
          return;
        }

        showToast('No se pudo crear la localización. Inténtalo de nuevo.', 'error');
      }
    },
    [locationName, project, showToast]
  );

  const handleDeleteLocation = React.useCallback(
    (locationId: string, name: string) => {
      if (!project) {
        return;
      }

      if (!window.confirm('¿Eliminar la localización "' + name + '"?')) {
        return;
      }

      const updated = deleteLocation(project.id, locationId);
      if (!updated) {
        showToast('No se encontró la localización a eliminar.', 'error');
        return;
      }

      setProject(updated);
      showToast('Localización eliminada.', 'success');
    },
    [project, showToast]
  );

  const handleExportPdf = React.useCallback(async () => {
    if (!project) {
      return;
    }

    try {
      setIsExporting(true);
      showToast('Generando PDF del proyecto...', 'info');
      await exportProjectPdf(project);
      showToast('PDF generado correctamente.', 'success');
    } catch (error) {
      showToast('No se pudo generar el PDF. Inténtalo nuevamente.', 'error');
    } finally {
      setIsExporting(false);
    }
  }, [project, showToast]);

  if (isLoading) {
    return <p className='text-sm text-neutral-400'>Cargando proyecto...</p>;
  }

  if (!project) {
    return (
      <section className='space-y-6'>
        <p className='text-sm text-neutral-400'>No encontramos el proyecto solicitado.</p>
        <Button type='button' onClick={() => router.push('/')}>Volver al inicio</Button>
      </section>
    );
  }

  return (
    <section className='space-y-10'>
      <div className='pointer-events-none fixed bottom-6 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 justify-center px-4 sm:left-auto sm:right-6 sm:translate-x-0'>
        {toast ? <Toast message={toast.message} variant={toast.variant} onDismiss={() => setToast(null)} /> : null}
      </div>

      <header className='space-y-3'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div className='space-y-2'>
            <p className='text-xs font-semibold uppercase tracking-wide text-emerald-400'>Proyecto</p>
            <h1 className='text-3xl font-semibold text-neutral-50 sm:text-4xl'>{project.name}</h1>
          </div>
          <Badge variant='default'>ID: {project.id}</Badge>
        </div>
        <p className='max-w-2xl text-sm text-neutral-400'>Gestiona las localizaciones de rodaje, mantén tus notas organizadas y genera informes listos para compartir.</p>
      </header>

      <Card className='border-neutral-800 bg-neutral-900/60'>
        <CardHeader className='space-y-2'>
          <CardTitle>Renombrar proyecto</CardTitle>
          <CardDescription>Actualiza el nombre para mantener la organización clara en tu panel.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className='flex flex-col gap-3 sm:flex-row' onSubmit={handleRename}>
            <Input value={projectName} onChange={(event) => setProjectName(event.target.value)} aria-label='Nombre del proyecto' />
            <Button type='submit' className='sm:w-40'>Guardar cambios</Button>
          </form>
        </CardContent>
        <CardFooter className='flex flex-col gap-2 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between'>
          <span>Creado el {new Date(project.createdAt).toLocaleDateString('es-ES')}</span>
          <span>Última edición: {new Date(project.updatedAt).toLocaleDateString('es-ES')}</span>
        </CardFooter>
      </Card>

      <Card className='border-neutral-800 bg-neutral-900/60'>
        <CardHeader className='space-y-2'>
          <CardTitle>Nueva localización</CardTitle>
          <CardDescription>Añade localizaciones únicas para este proyecto.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className='flex flex-col gap-3 sm:flex-row' onSubmit={handleCreateLocation}>
            <Input value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder='Nombre de la localización' aria-label='Nombre de la localización' />
            <Button type='submit' className='sm:w-48'>Añadir localización</Button>
          </form>
        </CardContent>
      </Card>

      <section className='space-y-6'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-semibold text-neutral-50'>Localizaciones</h2>
            <p className='text-sm text-neutral-500'>Haz clic en una tarjeta para continuar con el detalle y añadir más información.</p>
          </div>
          <Button type='button' variant='secondary' onClick={handleExportPdf} disabled={isExporting}>
            {isExporting ? 'Generando PDF...' : 'Exportar PDF del proyecto'}
          </Button>
        </div>

        <Separator />

        {sortedLocations.length === 0 ? (
          <div className='rounded-lg border border-dashed border-neutral-800 bg-neutral-900/40 p-8 text-center text-sm text-neutral-400'>
            Aún no has creado localizaciones. Añade la primera para comenzar tu scouting.
          </div>
        ) : (
          <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
            {sortedLocations.map((location) => {
              const statusInfo = statusLabels[location.status] ?? statusLabels.pending;
              return (
                <Card key={location.id} className='group border-neutral-800 bg-neutral-900/70 transition hover:border-emerald-500/60 hover:bg-neutral-900'>
                  <CardHeader className='space-y-3'>
                    <div className='flex items-start justify-between gap-3'>
                      <CardTitle className='line-clamp-2 break-words text-lg'>{location.name}</CardTitle>
                      <Badge variant={statusInfo.badge}>{statusInfo.label}</Badge>
                    </div>
                    <CardDescription>ID: {location.id}</CardDescription>
                  </CardHeader>
                  <CardContent className='space-y-2 text-sm text-neutral-400'>
                    <p>Actualizado: {new Date(location.updatedAt).toLocaleDateString('es-ES')}</p>
                    <p>Notas rápidas: {location.notes ? location.notes.split(/\r?\n/)[0] : 'Sin notas'}</p>
                  </CardContent>
                  <CardFooter className='flex items-center justify-between gap-2'>
                    <Button type='button' variant='ghost' onClick={() => handleDeleteLocation(location.id, location.name)}>Eliminar</Button>
                    <Link
                      href={('/project/' + project.id + '/location/' + location.id) as Route}
                      className='inline-flex items-center justify-center rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-neutral-950 transition group-hover:bg-emerald-400'
                    >
                      Ver detalle
                    </Link>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <div className='flex flex-wrap gap-3'>
        <Button type='button' variant='ghost' onClick={() => router.push('/')}>Volver al listado</Button>
      </div>
    </section>
  );
}
