'use client';

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
const MAX_IMAGE_DIMENSION = 1600;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const JPEG_EXPORT_QUALITY = 0.8;

type NormalizedImageType = 'png' | 'jpeg' | 'heic';

interface ToastQueueItem {
  message: string;
  variant: ToastVariant;
}

interface ImageResource {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, targetWidth: number, targetHeight: number) => void;
  cleanup?: () => void;
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    });
    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('READ_ERROR'));
    });
    reader.readAsDataURL(file);
  });
}

function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('IMAGE_LOAD_ERROR'));
    image.src = dataUrl;
  });
}

function detectImageType(file: File): NormalizedImageType | null {
  const mime = (file.type || '').toLowerCase();
  if (mime === 'image/png') {
    return 'png';
  }

  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return 'jpeg';
  }

  if (mime === 'image/heic' || mime === 'image/heif') {
    return 'heic';
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension) {
    return null;
  }

  if (extension === 'png') {
    return 'png';
  }

  if (extension === 'jpg' || extension === 'jpeg') {
    return 'jpeg';
  }

  if (extension === 'heic' || extension === 'heif') {
    return 'heic';
  }

  return null;
}

async function loadImageResource(file: File, type: NormalizedImageType): Promise<ImageResource> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, targetWidth, targetHeight) => {
          ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
        },
        cleanup: () => {
          if (typeof bitmap.close === 'function') {
            bitmap.close();
          }
        }
      };
    } catch (error) {
      if (type === 'heic') {
        throw new Error('HEIC_NOT_SUPPORTED');
      }
    }
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    const image = await loadImageElement(dataUrl);
    return {
      width: image.width,
      height: image.height,
      draw: (ctx, targetWidth, targetHeight) => {
        ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
      }
    };
  } catch (error) {
    if (type === 'heic') {
      throw new Error('HEIC_NOT_SUPPORTED');
    }
    throw error instanceof Error ? error : new Error('IMAGE_LOAD_ERROR');
  }
}

async function convertFileToJpegDataUrl(file: File, type: NormalizedImageType): Promise<string> {
  const resource = await loadImageResource(file, type);
  const { width, height } = resource;
  if (!width || !height) {
    resource.cleanup?.();
    throw new Error('INVALID_IMAGE');
  }

  const maxSide = Math.max(width, height);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / maxSide);
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    resource.cleanup?.();
    throw new Error('CANVAS_UNAVAILABLE');
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  if (type === 'png') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, targetWidth, targetHeight);
  }

  resource.draw(context, targetWidth, targetHeight);
  resource.cleanup?.();

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_EXPORT_QUALITY);
  if (!dataUrl) {
    throw new Error('ENCODE_ERROR');
  }

  return dataUrl;
}

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
        const dataUrls = await Promise.all(files.map((file) => readFileAsDataUrl(file)));
        let currentProject = project;
        let currentLocation = location;
        let addedCount = 0;
        let duplicateCount = 0;
        let limitReached = false;

        for (let index = 0; index < dataUrls.length; index += 1) {
          const dataUrl = dataUrls[index];

          if (addedCount >= remainingSlots) {
            limitReached = true;
            break;
          }

          if (!currentProject || !currentLocation) {
            continue;
          }
      const toastQueue: ToastQueueItem[] = [];
      let currentProject: Project | null = project;
      let currentLocation: LocationSet | null = location;
      let addedCount = 0;
      let duplicateCount = 0;
      let limitReached = false;

      const flushToastQueue = (queue: ToastQueueItem[]) => {
        queue.forEach((item, index) => {
          window.setTimeout(() => {
            showToast(item.message, item.variant);
          }, index * 150);
        });
      };

      for (const file of files) {
        if (!currentProject || !currentLocation) {
          break;
        }

        if (remainingSlots <= 0) {
          limitReached = true;
          break;
        }

        const detectedType = detectImageType(file);
        if (!detectedType) {
          toastQueue.push({ message: 'Formato no soportado para ' + file.name + '.', variant: 'error' });
          continue;
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
          toastQueue.push({ message: 'El archivo ' + file.name + ' supera el límite de 20 MB.', variant: 'error' });
          continue;
        }

        try {
          const dataUrl = await convertFileToJpegDataUrl(file, detectedType);
          const updated = addSetPhoto(currentProject.id, currentLocation.id, dataUrl);

          if (updated === false) {
            duplicateCount += 1;
            toastQueue.push({ message: 'Foto duplicada omitida: ' + file.name + '.', variant: 'info' });
            continue;
          }

          if (!updated) {
            toastQueue.push({ message: 'No se pudo guardar la imagen ' + file.name + '.', variant: 'error' });
            continue;
          }

          currentProject = updated;
          currentLocation =
            updated.locations.find((item) => item.id === currentLocation?.id) ?? currentLocation;
          addedCount += 1;
          remainingSlots -= 1;
        } catch (error) {
          if (error instanceof Error) {
            if (error.message === 'HEIC_NOT_SUPPORTED') {
              toastQueue.push({
                message: 'Formato HEIC no soportado en este navegador: ' + file.name + '.',
                variant: 'error'
              });
            } else if (error.message === 'CANVAS_UNAVAILABLE') {
              toastQueue.push({ message: 'El navegador no pudo procesar ' + file.name + '.', variant: 'error' });
            } else if (error.message === 'ENCODE_ERROR' || error.message === 'INVALID_IMAGE') {
              toastQueue.push({ message: 'La imagen ' + file.name + ' está dañada o no es válida.', variant: 'error' });
            } else {
              toastQueue.push({ message: 'No se pudo procesar ' + file.name + '.', variant: 'error' });
            }
          } else {
            toastQueue.push({ message: 'No se pudo procesar ' + file.name + '.', variant: 'error' });
          }
        }
      }

      if (currentProject) {
        setProject(currentProject);
      }
      if (currentLocation) {
        setLocation(currentLocation);
      }

        if (addedCount > 0) {
          const duplicateNote = duplicateCount > 0 ? ' Algunas imágenes ya existían y se omitieron.' : '';
          const limitNote = limitReached
            ? ' Se alcanzó el máximo de fotos y no se procesaron todas las imágenes seleccionadas.'
            : '';
          const variant: ToastVariant = limitReached ? 'info' : 'success';
          showToast(
            'Se añadieron ' + addedCount + ' foto' + (addedCount === 1 ? '' : 's') + '.' + duplicateNote + limitNote,
            variant
          );
        } else if (limitReached) {
          showToast(
            'Se alcanzó el máximo de fotos para esta localización y no se procesaron todas las imágenes seleccionadas.',
            'info'
          );
        } else if (duplicateCount > 0) {
          showToast('Las imágenes seleccionadas ya estaban guardadas.', 'error');
        } else {
          showToast('No se pudieron añadir las imágenes seleccionadas.', 'error');
        }
      } catch {
        showToast('No se pudieron procesar las imágenes. Inténtalo de nuevo.', 'error');
      } finally {
        setIsUploadingPhotos(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      if (addedCount > 0) {
        toastQueue.push({
          message:
            'Se añadieron ' + addedCount + ' foto' + (addedCount === 1 ? '' : 's') + ' correctamente.',
          variant: 'success'
        });
      }

      if (limitReached) {
        toastQueue.push({
          message: 'Se alcanzó el máximo de 10 fotos para esta localización.',
          variant: 'info'
        });
      }

      if (duplicateCount > 0 && addedCount === 0) {
        toastQueue.push({ message: 'Las imágenes seleccionadas ya estaban guardadas.', variant: 'info' });
      }

      if (toastQueue.length > 0) {
        flushToastQueue(toastQueue);
      }

      setIsUploadingPhotos(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [location, project, showToast]
  );

  const handleRemovePhoto = React.useCallback(
    (photo: string) => {
      if (!project || !location) {
        return;
      }

      if (!window.confirm('¿Eliminar esta foto de la localización?')) {
        return;
      }

      const updated = removeSetPhoto(project.id, location.id, photo);
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
        <Button type='button' onClick={() => router.push('/project/' + project.id)}>Volver al proyecto</Button>
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
          <Button type='button' variant='ghost' onClick={() => router.push('/project/' + project.id)}>
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
                <figure key={photo} className='group relative overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/60'>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt={'Foto de ' + location.name} className='h-40 w-full object-cover' loading='lazy' />
                  <figcaption className='flex items-center justify-between gap-2 px-3 py-2 text-xs text-neutral-300'>
                    <span className='truncate'>{location.name}</span>
                    <Button type='button' variant='ghost' className='px-2 py-1 text-xs' onClick={() => handleRemovePhoto(photo)}>
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
        <Link href={'/project/' + project.id} className='text-emerald-400 underline-offset-4 hover:underline'>
          Volver al proyecto {project.name}
        </Link>
      </footer>
    </section>
  );
}
