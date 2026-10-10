import { z } from 'zod';

/** Esquemas de datos compartidos: el servidor valida con ellos y las apps los usan para sus tipos. */

export const ROLES = ['cliente', 'repartidor', 'restaurante', 'admin'] as const;
export type Rol = (typeof ROLES)[number];
export const ROLES_PUBLICOS = ['cliente', 'repartidor', 'restaurante'] as const;

const correo = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Escribe un correo válido.' }));
const clave = z
  .string()
  .min(8, { error: 'La contraseña debe tener al menos 8 caracteres.' })
  .max(200, { error: 'La contraseña es demasiado larga.' });

export const esquemaRegistro = z
  .object({
    nombre: z.string().trim().min(2, { error: 'Escribe tu nombre.' }).max(80),
    correo,
    clave,
    rol: z.enum(ROLES_PUBLICOS),
    telefono: z.string().trim().max(30).optional(),
    fechaNacimiento: z.iso.date({ error: 'La fecha debe ser AAAA-MM-DD.' }).optional(),
    idioma: z.enum(['es', 'en']).default('es'),
  })
  .refine((d) => !d.correo.endsWith('@windoce.com') || /soporte/i.test(d.nombre), {
    error: 'Las cuentas de nuestro equipo deben llevar «Soporte» en el nombre.',
    path: ['nombre'],
  });
export type DatosRegistro = z.input<typeof esquemaRegistro>;

export const esquemaEntrar = z.object({
  correo,
  clave: z.string().min(1, { error: 'Escribe tu contraseña.' }).max(200),
});
export type DatosEntrar = z.infer<typeof esquemaEntrar>;

export const esquemaUsuario = z.object({
  id: z.string(),
  nombre: z.string(),
  correo: z.string(),
  rol: z.enum(ROLES),
  idioma: z.enum(['es', 'en']),
});
export type Usuario = z.infer<typeof esquemaUsuario>;

export type RespuestaSesion = { token: string; usuario: Usuario };
