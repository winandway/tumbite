/**
 * C-PERFIL-CHILE (10 nov 2026, punto B4) — Chile. Perfil del país en UNA sola pieza (regla «cada
 * país es su propio sistema»), APAGADO. Sale de la ficha
 * docs/investigaciones-rea/2026-11-10-perfil-chile.md: cada dato lleva ahí su fuente y su etiqueta.
 * Nada de aquí cobra ni enciende una ciudad: Chile se enciende cuando Richard abra la cuenta de
 * cobro local (Stripe no ofrece cuentas conectadas a comercios chilenos) y un contador y un abogado
 * de Chile confirmen el IVA, la boleta y la Ley 21.431.
 */
export type DocumentoPais = {
  id: string;
  nombre: { es: string; en: string };
  obligatorio: boolean;
};

export const PERFIL_CHILE = {
  codigo: 'CL',
  /** Apagado: no aparece en ningún selector ni enciende zonas. */
  activo: false,
  moneda: 'CLP',
  /** El peso chileno no usa decimales: los montos se guardan en pesos enteros. */
  decimales: 0,
  idioma: 'es',
  impuesto: { nombre: 'IVA', porcentaje: 19, incluidoEnPrecio: true },
  telefono: { prefijo: '+56', ejemplo: '9 1234 5678' },
  direccion: {
    /** En Chile la comuna y la región son campos propios (no «ciudad y estado»). */
    campos: ['calle', 'numero', 'comuna', 'region'],
    codigoPostalObligatorio: false,
  },
  /** Cómo se paga allá, en el orden en que conviene ofrecerlo. Ninguno está conectado todavía. */
  pagos: [
    { id: 'tarjeta', nombre: { es: 'Tarjeta de débito o crédito', en: 'Debit or credit card' } },
    { id: 'webpay', nombre: { es: 'Webpay (Transbank)', en: 'Webpay (Transbank)' } },
    { id: 'mercado_pago', nombre: { es: 'Mercado Pago', en: 'Mercado Pago' } },
    { id: 'mach', nombre: { es: 'MACH', en: 'MACH' } },
    { id: 'transferencia', nombre: { es: 'Transferencia (Khipu)', en: 'Bank transfer (Khipu)' } },
  ],
  cobro: {
    /** 👤 Richard: cuenta con un procesador chileno (dLocal, Mercado Pago o Transbank). */
    procesador: null as string | null,
    /** Stripe Connect no admite cuentas conectadas de comercios ni repartidores chilenos. */
    stripeConnect: false,
  },
  documentos: {
    restaurante: [
      {
        id: 'rut_empresa',
        nombre: { es: 'RUT de la empresa', en: 'Company RUT' },
        obligatorio: true,
      },
      {
        id: 'inicio_actividades',
        nombre: { es: 'Inicio de actividades en el SII', en: 'SII start of activities' },
        obligatorio: true,
      },
      {
        id: 'patente_municipal',
        nombre: { es: 'Patente municipal', en: 'Municipal business license' },
        obligatorio: true,
      },
      {
        id: 'resolucion_sanitaria',
        nombre: { es: 'Resolución sanitaria', en: 'Health authorization' },
        obligatorio: true,
      },
    ],
    repartidor: [
      {
        id: 'cedula',
        nombre: { es: 'Cédula de identidad vigente', en: 'Valid national ID card' },
        obligatorio: true,
      },
      {
        id: 'licencia',
        nombre: {
          es: 'Licencia de conducir (clase C para moto, clase B para auto)',
          en: 'Driver’s license (class C for motorcycles, class B for cars)',
        },
        obligatorio: false,
      },
      {
        id: 'permiso_circulacion',
        nombre: { es: 'Permiso de circulación', en: 'Vehicle circulation permit' },
        obligatorio: false,
      },
      {
        id: 'soap',
        nombre: { es: 'Seguro obligatorio (SOAP)', en: 'Mandatory insurance (SOAP)' },
        obligatorio: false,
      },
      {
        id: 'revision_tecnica',
        nombre: { es: 'Revisión técnica', en: 'Vehicle inspection' },
        obligatorio: false,
      },
    ] as DocumentoPais[],
  },
  /** Ley 21.431 (trabajadores de plataformas): lo que hay que cumplir antes de encender. */
  pendienteLegal: [
    'Contrato en pesos y con domicilio en Chile',
    'Pago mínimo por hora trabajada y seguro de daños',
    'Derecho a desconexión de 12 horas',
    'Quién emite la boleta electrónica al cliente',
  ],
} as const;

/** RUT sin puntos ni guion, en mayúscula: «12.345.678-5» → «123456785». */
export const rutNormal = (texto: string) => texto.replace(/[\s.-]/g, '').toUpperCase();

/** ¿El RUT (o RUN) tiene bien su dígito verificador? Módulo 11, como lo calcula el SII. */
export function rutValido(texto: string): boolean {
  const limpio = rutNormal(texto);
  if (limpio.length < 2 || limpio.length > 9) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo) || !/^[\dK]$/.test(dv)) return false;
  let suma = 0;
  let factor = 2;
  for (const cifra of [...cuerpo].reverse()) {
    suma += Number(cifra) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  return dv === esperado;
}

/** Celular chileno: +56 9 y ocho cifras (con o sin el prefijo del país). */
export function telefonoChileValido(texto: string): boolean {
  const cifras = texto.replace(/\D/g, '');
  const local = cifras.startsWith('56') && cifras.length === 11 ? cifras.slice(2) : cifras;
  return /^9\d{8}$/.test(local);
}
