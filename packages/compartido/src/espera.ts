import { z } from 'zod';

/** Lista de espera de la landing: los tres públicos desde el minuto cero. */
export const TIPOS_ESPERA = ['comensal', 'restaurante', 'repartidor'] as const;
export type TipoEspera = (typeof TIPOS_ESPERA)[number];

const texto = (max: number) => z.string().trim().max(max).default('');

export const esquemaEspera = z
  .object({
    tipo: z.enum(TIPOS_ESPERA),
    nombre: z.string().trim().min(2, { error: 'Escribe tu nombre.' }).max(80),
    correo: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email({ error: 'Escribe un correo válido.' })),
    telefono: texto(30),
    ciudad: z.string().trim().min(2, { error: 'Escribe tu ciudad.' }).max(60),
    codigoPostal: texto(12),
    negocio: texto(80),
    vehiculo: z.enum(['', 'carro', 'moto', 'bicicleta', 'otro']).default(''),
    idioma: z.enum(['es', 'en']).default('es'),
    lat: z.number().min(-90).max(90).nullable().default(null),
    lng: z.number().min(-180).max(180).nullable().default(null),
  })
  .refine((d) => d.tipo !== 'restaurante' || d.negocio.length >= 2, {
    error: 'Escribe el nombre de tu restaurante.',
    path: ['negocio'],
  })
  .refine((d) => d.tipo === 'comensal' || d.telefono.length >= 7, {
    error: 'Escribe un celular para llamarte.',
    path: ['telefono'],
  });

export type DatosEspera = z.input<typeof esquemaEspera>;
