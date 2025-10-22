'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Toast } from '@/components/ui/toast';
import { exportLocationPdf } from '@/lib/pdf';
import {
  addSetPhoto,
  findProject,
  LocationSet,
  LocationStatus,
  preparePhoto,
  Project,
  removeSetPhoto,
  setSetCoords,
  setSetNotes,
  setSetStatus
} from '@/lib/storage';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastState {
  message: string;
  variant: ToastVariant;
}

const statusOptions: { value: LocationStatus; label: string }[] = [
  { value: 'approved', label: 'Apta' },
  { value: 'rejected', label: 'No apta' },
  { value: 'pending', label: 'Pendiente' }
];

const MAX_NOTES_LENGTH = 2000;
const MAX_PHOTOS = 10;

export default function LocationDetailPage(): React.ReactElement {
  const params = useParams<{ id: string; setId: string }>();
  const router = useRouter();

  const [project, setProject] = React.useState<Project | null>(null);
  const [location, setLocation] = React.useState<LocationSet | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [statusValue, setStatusValue] = React.useState<LocationStatus>('pending');
  const [notesValue, setNotesValue] = React.useState('');
  const [isExporting, setIsExporting] = React.useState(false);
  const [isRequestingCoords, setIsRequestingCoords] = React.useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = React.useState(false);
  const [toast, setToast] = React.useState<ToastState | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const showToast = React.useCallback((message: string, variant: ToastVariant) => {
    setToast({ message, variant });
  }, []);

  React.useEffect(() => {
    if (!params?.id || !params?.setId) {
      return;
    }

    const currentProject = findProject(params.id);
    if (!currentProject) {
      setProject(null);
      setLocation(null);
      setIsLoading(false);
      return;
    }

    const currentLocation = currentProject.locations.find((item) => item.id === params.setId) ?? null;
    setProject(currentProject);
    setLocation(currentLocation);
    if (currentLocation) {
      setStatusValue(currentLocation.status);
      setNotesValue(currentLocation.notes);
    }
    setIsLoading(false);
  }, [params?.id, params?.setId]);

  React.useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const refreshLocation = React.useCallback(
    (updatedProject: Project | undefined, showError = true) => {
      if (!updatedProject) {
        if (showError) {
          showToast('No se pudo actualizar la localización.', 'error');
        }
        return false;
      }

      const updatedLocation = updatedProject.locations.find((item) => item.id === params?.setId) ?? null;
      setProject(updatedProject);
      setLocation(updatedLocation);
      if (updatedLocation) {
        setStatusValue(updatedLocation.status);
        setNotesValue(updatedLocation.notes);
      }

      return Boolean(updatedLocation);
    },
    [params?.setId, showToast]
  );

  const handleStatusChange = React.useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      if (!project || !location) {
        return;
      }

      const nextStatus = event.target.value as LocationStatus;
      const previousStatus = location.status;
      setStatusValue(nextStatus);
      const updated = setSetStatus(project.id, location.id, nextStatus);
      if (refreshLocation(updated)) {
        showToast('Estado actualizado.', 'success');
        return;
      }

      setStatusValue(previousStatus);
    },
    [location, project, refreshLocation, showToast]
  );

  const handleNotesBlur = React.useCallback(() => {
    if (!project || !location) {
      return;
    }

    if (notesValue === location.notes) {
      return;
    }

    try {
      const updated = setSetNotes(project.id, location.id, notesValue);
      if (refreshLocation(updated)) {
        showToast('Notas guardadas.', 'success');
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'NOTES_TOO_LONG') {
        showToast('Las notas no pueden superar los 2000 caracteres.', 'error');
        return;
      }

      showToast('No se pudieron guardar las notas.', 'error');
    }
  }, [location, notesValue, project, refreshLocation, showToast]);

  const handlePhotoSelection = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!project || !location) {
        return;
      }

      const files = Array.from(event.target.files ?? []);
      if (files.length === 0) {
        return;
      }

      let remainingSlots = MAX_PHOTOS - (location.photos?.length ?? 0);
      if (remainingSlots <= 0) {
        showToast('Has alcanzado el límite de 10 fotos para esta localización.', 'error');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      setIsUploadingPhotos(true);

      try {
        let currentProject = project;
        let currentLocation = location;
        let addedCount = 0;
        let duplicateCount = 0;
        let failedCount = 0;
        let limitReached = false;
        const toastQueue: ToastState[] = [];

        for (const file of files) {
          if (remainingSlots <= 0) {
            limitReached = true;
            break;
          }

          if (!currentProject || !currentLocation) {
            break;
          }

          let dataUrl: string;
          try {
            dataUrl = await preparePhoto(file);
          } catch {
            failedCount += 1;
            continue;
          }

          if (currentLocation.photos.some((photoItem) => photoItem.dataUrl === dataUrl)) {
            duplicateCount += 1;
            continue;
          }

          try {
            const updated = addSetPhoto(currentProject.id, currentLocation.id, {
              dataUrl,
              createdAt: new Date().toISOString(),
              fileName: file.name
            });
            currentProject = updated;
            currentLocation =
              updated.locations.find((item) => item.id === currentLocation?.id) ?? currentLocation;

            addedCount += 1;
            remainingSlots -= 1;
          } catch (error) {
            if (error instanceof Error && error.message === 'HEIC_NOT_SUPPORTED') {
              toastQueue.push({
                message: 'Formato HEIC no soportado en este navegador.',
                variant: 'info'
              });
            } else {
              failedCount += 1;
              toastQueue.push({
                message: 'Error al procesar ' + file.name + '.',
                variant: 'error'
              });
            }
            continue;
          }
        }

        // Actualiza estado en memoria para que la UI refleje los cambios
        if (currentProject) {
          setProject(currentProject);
        }
        if (currentLocation) {
          setLocation(currentLocation);
        }

        // Mensajes de resumen
        const duplicateNote =
          duplicateCount > 0 ? ' Las imágenes seleccionadas ya estaban guardadas.' : '';
        const failureNote =
          failedCount > 0 ? ' No se pudieron procesar algunas imágenes. Inténtalo de nuevo.' : '';
        const limitNote =
          limitReached
            ? ' Se alcanzó el máximo de fotos y no se procesaron todas las imágenes seleccionadas.'
            : '';

        const variant: ToastVariant = limitReached ? 'info' : 'success';

        showToast(
          'Se añadieron ' +
            addedCount +
            ' foto' +
            (addedCount === 1 ? '' : 's') +
            '.' +
            duplicateNote +
            failureNote +
            limitNote,
          variant
        );
      } catch {
        showToast('No se pudieron procesar las imágenes. Inténtalo de nuevo.', 'error');
      } finally {
        setIsUploadingPhotos(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [location, project, showToast]
  );

  const handleRemovePhoto = React.useCallback(
    (photoId: string) => {
      if (!project || !location) {
        return;
      }

      if (!window.confirm('¿Eliminar esta foto de la localización?')) {
        return;
      }

      const updated = removeSetPhoto(project.id, location.id, photoId);
      if (!updated) {
        showToast('No se pudo eliminar la foto seleccionada.', 'error');
        return;
      }

      if (refreshLocation(updated)) {
        showToast('Foto eliminada.', 'success');
      }
    },
    [location, project, refreshLocation, showToast]
  );

  const handleUseMyLocation = React.useCallback(() => {
    if (!project || !location) {
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showToast('La geolocalización no está disponible en este dispositivo.', 'error');
      return;
    }

    setIsRequestingCoords(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: parseFloat(position.coords.latitude.toFixed(6)),
          lng: parseFloat(position.coords.longitude.toFixed(6))
        };
        const updated = setSetCoords(project.id, location.id, coords);
        if (refreshLocation(updated)) {
          showToast('Coordenadas guardadas correctamente.', 'success');
        }
        setIsRequestingCoords(false);
      },
      (error) => {
        setIsRequestingCoords(false);
        if (error.code === error.PERMISSION_DENIED) {
          showToast('Permiso de geolocalización denegado.', 'error');
          return;
        }

        showToast('No se pudo obtener tu ubicación.', 'error');
      }
    );
  }, [location, project, refreshLocation, showToast]);

  const handleExportPdf = React.useCallback(async () => {
    if (!project || !location) {
      return;
    }

    try {
      setIsExporting(true);
      showToast('Generando PDF de la localización...', 'info');
      await exportLocationPdf(project, location);
      showToast('PDF generado correctamente.', 'success');
    } catch {
      showToast('No se pudo generar el PDF. Inténtalo nuevamente.', 'error');
    } finally {
      setIsExporting(false);
    }
  }, [location, project, showToast]);

  const notesRemaining = MAX_NOTES_LENGTH - notesValue.length;

  if (isLoading) {
    return <p className='text-sm text-neutral-400'>Cargando localización...</p>;
  }

  if (!project) {
    return (
      <section className='space-y-6'>
        <p className='text-sm text-neutral-400'>No encontramos el proyecto solicitado.</p>
        <Button type='button' onClick={() => router.push('/')}>Volver al inicio</Button>
      </section>
    );
  }

  if (!location) {
    return (
      <section className='space-y-6'>
        <p className='text-sm text-neutral-400'>No encontramos la localización solicitada.</p>
        <Button type='button' onClick={() => router.push(('/project/' + project.id) as Route)}>
          Volver al proyecto
        </Button>
      </section>
    );
  }

  return (
    <section className='space-y-10'>
      <div className='pointer-events-none fixed bottom-6 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 justify-center px-4 sm:left-auto sm:right-6 sm:translate-x-0'>
        {toast ? <Toast message={toast.message} variant={toast.variant} onDismiss={() => setToast(null)} /> : null}
      </div>

      <header className='flex flex-col gap-4 border-b border-neutral-800 pb-6 sm:flex-row sm:items-center sm:justify-between'>
        <div className='space-y-2'>
          <p className='text-xs font-semibold uppercase tracking-wide text-emerald-400'>Localización del proyecto</p>
          <h1 className='text-3xl font-semibold text-neutral-50 sm:text-4xl'>{location.name}</h1>
          <p className='text-sm text-neutral-400'>Proyecto: {project.name}</p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            variant='ghost'
            onClick={() => router.push(('/project/' + project.id) as Route)}
          >
            Volver al proyecto
          </Button>
          <Button type='button' variant='secondary' disabled={isExporting} onClick={handleExportPdf}>
            {isExporting ? 'Generando PDF...' : 'Exportar PDF de esta localización'}
          </Button>
        </div>
      </header>

      <div className='grid gap-6 lg:grid-cols-[2fr,1fr]'>
        <Card className='border-neutral-800 bg-neutral-900/60'>
          <CardHeader className='space-y-2'>
            <CardTitle>Estado y notas</CardTitle>
            <CardDescription>Actualiza el estado operativo y registra información relevante.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div className='space-y-2'>
              <label className='text-sm font-medium text-neutral-200' htmlFor='location-status'>Estado</label>
              <select
                id='location-status'
                className='h-10 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950'
                value={statusValue}
                onChange={handleStatusChange}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <Separator />

            <div className='space-y-2'>
              <div className='flex items-center justify-between text-xs text-neutral-400'>
                <label className='text-sm font-medium text-neutral-200' htmlFor='location-notes'>Notas</label>
                <span>{notesRemaining} caracteres restantes</span>
              </div>
              <Textarea
                id='location-notes'
                value={notesValue}
                onChange={(event) => {
                  if (event.target.value.length <= MAX_NOTES_LENGTH) {
                    setNotesValue(event.target.value);
                  }
                }}
                onBlur={handleNotesBlur}
                placeholder='Añade detalles relevantes de la localización, incidencias o recordatorios.'
                maxLength={MAX_NOTES_LENGTH}
              />
              <p className='text-xs text-neutral-500'>Las notas se guardan automáticamente al salir del campo.</p>
            </div>
          </CardContent>
        </Card>

        <Card className='border-neutral-800 bg-neutral-900/60'>
          <CardHeader className='space-y-2'>
            <CardTitle>Coordenadas</CardTitle>
            <CardDescription>Captura la ubicación de la localización con GPS.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <Button type='button' variant='secondary' disabled={isRequestingCoords} onClick={handleUseMyLocation}>
              {isRequestingCoords ? 'Obteniendo ubicación...' : 'Usar mi ubicación'}
            </Button>
            {location.coords ? (
              <div className='rounded-lg border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-300'>
                <p>Latitud: {location.coords.lat.toFixed(6)}</p>
                <p>Longitud: {location.coords.lng.toFixed(6)}</p>
                <p className='text-xs text-neutral-500'>Última actualización: {new Date(location.updatedAt).toLocaleString('es-ES')}</p>
              </div>
            ) : (
              <p className='text-sm text-neutral-500'>Aún no se han registrado coordenadas para esta localización.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className='border-neutral-800 bg-neutral-900/60'>
        <CardHeader className='space-y-2'>
          <CardTitle>Galería de fotos</CardTitle>
          <CardDescription>Sube referencias visuales para facilitar el scouting.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
            <Input
              ref={fileInputRef}
              type='file'
              accept='image/*'
              multiple
              onChange={handlePhotoSelection}
              disabled={isUploadingPhotos}
              aria-label='Añadir fotos a la localización'
            />
            <p className='text-xs text-neutral-500'>Hasta {MAX_PHOTOS} fotos por localización. Tamaño recomendado: menor a 1&nbsp;MB.</p>
          </div>

          {location.photos.length === 0 ? (
            <p className='text-sm text-neutral-500'>Aún no hay fotos asociadas a esta localización.</p>
          ) : (
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
              {location.photos.map((photo) => (
                <figure
                  key={photo.id}
                  className='group relative overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/60'
                >
                  <img
                    src={photo.dataUrl}
                    alt={'Foto de ' + location.name}
                    className='h-40 w-full object-cover'
                    loading='lazy'
                  />
                  <figcaption className='flex items-center justify-between gap-2 px-3 py-2 text-xs text-neutral-300'>
                    <span className='truncate'>
                      {new Date(photo.createdAt).toLocaleString('es-ES')}
                    </span>
                    <Button
                      type='button'
                      variant='ghost'
                      className='px-2 py-1 text-xs'
                      onClick={() => handleRemovePhoto(photo.id)}
                    >
                      Borrar
                    </Button>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <footer className='flex flex-col gap-4 border-t border-neutral-800 pt-6 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <p>ID de la localización: {location.id}</p>
          <p>Última actualización: {new Date(location.updatedAt).toLocaleString('es-ES')}</p>
        </div>
        <Link href={('/project/' + project.id) as Route} className='text-emerald-400 underline-offset-4 hover:underline'>
          Volver al proyecto {project.name}
        </Link>
      </footer>
    </section>
  );
}
