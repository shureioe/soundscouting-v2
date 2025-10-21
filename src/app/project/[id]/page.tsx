'use client';

import { useParams, useRouter } from 'next/navigation';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Project, updateProjectName, findProject } from '@/lib/storage';

export default function ProjectPage(): React.ReactElement {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = React.useState<Project | null>(null);
  const [projectName, setProjectName] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (!params?.id) {
      return;
    }

    const current = findProject(params.id);
    if (!current) {
      setIsLoading(false);
      router.replace('/');
      return;
    }

    setProject(current);
    setProjectName(current.name);
    setIsLoading(false);
  }, [params?.id, router]);

  const handleRename = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!project) {
      return;
    }

    const updated = updateProjectName(project.id, projectName);
    if (updated) {
      setProject(updated);
      setProjectName(updated.name);
    }
  };

  if (isLoading) {
    return <p className='text-sm text-neutral-400'>Cargando proyecto...</p>;
  }

  if (!project) {
    return <p className='text-sm text-neutral-400'>Proyecto no encontrado.</p>;
  }

  return (
    <section className='space-y-10'>
      <header className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
        <div className='space-y-2'>
          <h1 className='text-3xl font-semibold text-neutral-50 sm:text-4xl'>{project.name}</h1>
          <p className='text-sm text-neutral-400'>Gestiona las localizaciones y notas de tu proyecto. En el siguiente hito podrás añadir ubicaciones detalladas.</p>
        </div>
        <Badge variant='default'>ID: {project.id.slice(0, 6)}</Badge>
      </header>

      <Card className='border-neutral-800 bg-neutral-900/60'>
        <CardHeader>
          <CardTitle>Renombrar proyecto</CardTitle>
          <CardDescription>Actualiza el nombre del proyecto para mantener la organización clara.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className='flex flex-col gap-4 sm:flex-row' onSubmit={handleRename}>
            <Input value={projectName} onChange={(event) => setProjectName(event.target.value)} required />
            <Button type='submit' className='sm:w-44'>Guardar cambios</Button>
          </form>
        </CardContent>
        <CardFooter className='justify-between'>
          <p className='text-xs text-neutral-500'>Creado el {new Date(project.createdAt).toLocaleDateString('es-ES')}</p>
          <p className='text-xs text-neutral-500'>Última edición: {new Date(project.updatedAt).toLocaleDateString('es-ES')}</p>
        </CardFooter>
      </Card>

      <section className='space-y-4'>
        <div className='flex items-center justify-between'>
          <h2 className='text-2xl font-semibold text-neutral-50'>Localizaciones</h2>
          <Button variant='secondary' disabled>
            Añadir localización
          </Button>
        </div>
        <div className='rounded-lg border border-dashed border-neutral-800 bg-neutral-900/40 p-8 text-center text-sm text-neutral-400'>
          La gestión de localizaciones estará disponible en el siguiente hito. Mientras tanto puedes planificar la estructura del proyecto.
        </div>
      </section>

      <Button variant='ghost' onClick={() => router.push('/')}>Volver al listado</Button>
    </section>
  );
}
