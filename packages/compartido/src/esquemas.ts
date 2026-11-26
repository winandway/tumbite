import { z } from 'zod';
import { leerLugarCuenta } from './lugarCuenta';

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
    idioma: z.enum(['es', 'en']).default('en'),
    // C-SMS-CONSENTIMIENTO: la casilla de SMS, aparte y sin marcar. No marcarla no impide registrarse.
    smsConsentimiento: z.boolean().default(false),
    canal: z.enum(['web', 'app']).optional(),
    // C-REFERIDOS-EQUIPOS: el código con el que lo invitaron (de un equipo o de una persona).
    invitacion: z.string().trim().max(20).optional(),
    // C-TELEFONO-E164: el país del celular que eligió en la pantalla (el número se lee con él).
    paisTelefono: z.string().trim().toUpperCase().length(2).optional(),
    // C-TELEFONO-AL-REGISTRARSE (22 nov 2026): la app trae la pantalla del código por SMS. Solo esas
    // cuentas quedan obligadas a confirmar el celular (las apps viejas no la tienen: nadie se atrapa).
    verificaTelefono: z.boolean().optional(),
    // C-REGISTRO-TODO-EL-PAIS (25 nov 2026): dónde vive (`LugarCuenta`, lugarCuenta.ts). Opcional: las
    // apps viejas no lo mandan. El servidor lo lee con `leerLugarCuenta`; uno mal formado se ignora
    // (queda en el registro de errores) y nunca impide crear la cuenta.
    lugar: z.unknown().optional(),
  })
  .refine((d) => !d.correo.endsWith('@windoce.com') || /soporte/i.test(d.nombre), {
    error: 'Las cuentas de nuestro equipo deben llevar «Soporte» en el nombre.',
    path: ['nombre'],
  });
export type DatosRegistro = z.input<typeof esquemaRegistro>;

export const esquemaEntrar = z.object({
  correo,
  clave: z.string().min(1, { error: 'Escribe tu contraseña.' }).max(200),
  // C-CUENTA-UNICA: la app sabe ofrecer el papel que falta (las publicadas antes no lo mandan).
  cuentaUnica: z.boolean().optional(),
  // C-CUENTA-UNICA: la persona tocó «Activar mi cuenta de cliente» / «Empezar mi registro de conductor»
  // y marcó la casilla de los términos de ese papel.
  activarPapel: z.boolean().optional(),
  aceptaTerminosPapel: z.boolean().optional(),
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
