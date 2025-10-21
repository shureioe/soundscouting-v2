'use client';

import { useParams, useRouter } from 'next/navigation';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LocationPlaceholderPage(): React.ReactElement {
  const params = useParams<{ id: string; setId: string }>();
  const router = useRouter();

  return (
    <section className='space-y-8'>
      <header className='flex flex-col gap-2'>
        <Badge variant='success'>Próximamente</Badge>
        <h1 className='text-3xl font-semibold text-neutral-50'>Localización en preparación</h1>
        <p className='text-sm text-neutral-400'>En el próximo hito podrás editar los detalles completos de esta localización, adjuntar fotografías y exportar la ficha a PDF.</p>
      </header>

      <Card className='border-neutral-800 bg-neutral-900/60'>
        <CardHeader>
          <CardTitle>Información preliminar</CardTitle>
          <CardDescription>Identificadores temporales de la ruta.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-2 text-sm text-neutral-400'>
          <p>Proyecto: {params?.id}</p>
          <p>Localización: {params?.setId}</p>
        </CardContent>
      </Card>

      <Button variant='ghost' onClick={() => router.push(params?.id ? `/project/${params.id}` : '/')}>Volver al proyecto</Button>
    </section>
  );
}
