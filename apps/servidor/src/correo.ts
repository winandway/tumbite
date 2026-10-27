import { MARCA } from '@tumbite/compartido';
import type { Env } from './env';

/**
 * Correos que manda el sitio, por la API de YaDominios Cloud (incluida en el plan,
 * firmada con DKIM desde tumbite.com). Un solo lugar para enviar: nada manda correos por fuera.
 * Nunca falla en silencio: el último error queda en el canario de /datos/salud.
 */
export const SITIO = 'tumbite';
export const DOMINIO_CORREO = 'tumbite.com';
/** Lo que ve la gente al pie de cada correo: la marca y su dominio público (no el del remitente). */
export const DOMINIO_PUBLICO = 'divoox.com';

/** Remitentes oficiales (en inglés, como pidió Richard). Nombre visible bilingüe no hace falta. */
export const REMITENTES = {
  avisos: { address: `no-reply@${DOMINIO_CORREO}`, name: MARCA.nombre },
  soporte: { address: `support@${DOMINIO_CORREO}`, name: `${MARCA.nombre} Support` },
  ventas: { address: `sales@${DOMINIO_CORREO}`, name: `${MARCA.nombre} Sales` },
  pedidos: { address: `orders@${DOMINIO_CORREO}`, name: `${MARCA.nombre} Orders` },
  cuentas: { address: `billing@${DOMINIO_CORREO}`, name: `${MARCA.nombre} Billing` },
  hola: { address: `hello@${DOMINIO_CORREO}`, name: MARCA.nombre },
} as const;
export type Remitente = keyof typeof REMITENTES;

export type Correo = {
  de: Remitente;
  para: string;
  asunto: string;
  texto: string;
  html?: string;
  responderA?: string;
};

export type ResultadoCorreo =
  { ok: true; id: string; rebotado: false } | { ok: false; motivo: string; rebotado: boolean };

const ENDPOINT = 'https://yapanel.yadominios.com/api/hosting/correo/enviar';

/** Último fallo de envío (para el canario). null = todo bien o nada enviado aún. */
export let ultimoErrorCorreo: { cuando: string; motivo: string } | null = null;

type Transporte = (entrada: string, init: RequestInit) => Promise<Response>;
let transporte: Transporte = (e, i) => fetch(e, i);
/** Solo para pruebas: nunca se le pega al servicio real desde una prueba. */
export function usarTransporteCorreo(t: Transporte | null) {
  transporte = t ?? ((e, i) => fetch(e, i));
  ultimoErrorCorreo = null;
}

export function correoConfigurado(env: Env): boolean {
  return Boolean(env.YAD_TOKEN);
}

export async function enviarCorreo(env: Env, correo: Correo): Promise<ResultadoCorreo> {
  if (!env.YAD_TOKEN) {
    const motivo = 'Falta YAD_TOKEN: el sitio no puede mandar correos.';
    ultimoErrorCorreo = { cuando: new Date().toISOString(), motivo };
    console.error('correo:', motivo);
    return { ok: false, motivo, rebotado: false };
  }
  const cuerpo = {
    sitio: SITIO,
    token: env.YAD_TOKEN,
    from: REMITENTES[correo.de],
    to: [{ address: correo.para }],
    subject: correo.asunto,
    text: correo.texto,
    html: correo.html ?? aHtml(correo.texto),
    ...(correo.responderA ? { reply_to: { address: correo.responderA } } : {}),
  };
  let res: Response;
  try {
    res = await transporte(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
  } catch (e) {
    const motivo = `No se pudo hablar con el servicio de correo: ${String(e)}`;
    ultimoErrorCorreo = { cuando: new Date().toISOString(), motivo };
    console.error('correo:', motivo);
    return { ok: false, motivo, rebotado: false };
  }
  const datos = (await res.json().catch(() => null)) as {
    success?: boolean;
    message_id?: string;
    error?: string;
    rebotados?: string[];
  } | null;
  if (!res.ok || !datos?.success) {
    const motivo = datos?.error ?? `El servicio de correo respondió ${res.status}.`;
    ultimoErrorCorreo = { cuando: new Date().toISOString(), motivo };
    console.error('correo:', motivo, correo.para);
    return { ok: false, motivo, rebotado: false };
  }
  if (datos.rebotados?.length) {
    // Un «enviado» no es un «llegó»: la dirección no existe. Se avisa, no se reintenta.
    const motivo = `Rebote permanente: ${datos.rebotados.join(', ')}`;
    ultimoErrorCorreo = { cuando: new Date().toISOString(), motivo };
    console.error('correo:', motivo);
    return { ok: false, motivo, rebotado: true };
  }
  return { ok: true, id: datos.message_id ?? '', rebotado: false };
}

function escapar(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Etiqueta del botón según la página a la que lleva el enlace (los correos salen en los dos idiomas). */
function etiquetaBoton(url: string, en: boolean): string {
  const ruta = url.replace(/^https?:\/\/[^/]+/, '');
  if (ruta.includes('/confirm-email')) return en ? 'Confirm my email' : 'Confirmar mi correo';
  if (ruta.includes('/reset-password'))
    return en ? 'Reset my password' : 'Restablecer mi contraseña';
  if (ruta.includes('/app/order/')) return en ? 'Follow my order' : 'Seguir mi pedido';
  if (ruta.includes('/panel')) return en ? 'Open my panel' : 'Abrir mi panel';
  if (ruta.includes('/driver')) return en ? 'Open Divoox Driver' : 'Abrir Divoox Driver';
  return en ? 'Open Divoox' : 'Abrir Divoox';
}

/** Un párrafo de líneas «Etiqueta: valor» (detalle del pedido) se pinta como tabla limpia. */
function esDetalle(lineas: string[]): boolean {
  return lineas.length >= 2 && lineas.every((l) => /^[^:]{1,40}:\s.+$/.test(l));
}

/**
 * Plantilla de todos los correos (27 oct 2026, pedido de Richard: diseño serio). Logo real de la
 * marca, texto limpio, los enlaces como botón con etiqueta (y la dirección completa debajo, por si el
 * botón no se ve), los detalles en tabla y un pie con la empresa y el soporte. Sin franjas gruesas de
 * color ni adornos: borde fino y sombra suave, como en la web.
 */
export function aHtml(texto: string): string {
  const limpio = texto.trim();
  const en = !/\b(Hola|Toca|Tu pedido|Recibimos|Bienvenid[oa])\b/.test(limpio);
  const parrafos = limpio.split(/\n{2,}/).map((p) => {
    const bruto = p.trim();
    const m = bruto.match(/^(https?:\/\/\S+)$/);
    if (m?.[1]) {
      const url = escapar(m[1]);
      return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0 8px"><tr><td style="background:#F20D20;border-radius:10px"><a href="${url}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;font-family:Arial,Helvetica,sans-serif">${etiquetaBoton(m[1], en)}</a></td></tr></table><p style="margin:0 0 18px;font-size:12px;line-height:1.5;color:#666B73;word-break:break-all">${url}</p>`;
    }
    const lineas = bruto.split('\n');
    if (esDetalle(lineas))
      return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:6px 0 18px;border-collapse:collapse;width:100%">${lineas
        .map((l) => {
          const i = l.indexOf(':');
          const k = escapar(l.slice(0, i).trim());
          const v = escapar(l.slice(i + 1).trim());
          const total = /^total$/i.test(k);
          return `<tr><td style="padding:8px 0;border-bottom:1px solid #ECECEC;color:#666B73;font-size:15px${total ? ';font-weight:700;color:#101010' : ''}">${k}</td><td align="right" style="padding:8px 0;border-bottom:1px solid #ECECEC;font-size:15px${total ? ';font-weight:700' : ''}">${v}</td></tr>`;
        })
        .join('')}</table>`;
    return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#101010">${escapar(bruto).replace(/\n/g, '<br>')}</p>`;
  });
  const pie = en
    ? `Need help? <a href="https://${DOMINIO_PUBLICO}/support" style="color:#101010">${DOMINIO_PUBLICO}/support</a>`
    : `¿Necesitas ayuda? <a href="https://${DOMINIO_PUBLICO}/es/support" style="color:#101010">${DOMINIO_PUBLICO}/support</a>`;
  const anio = new Date().getUTCFullYear();
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${MARCA.nombre}</title></head><body style="margin:0;padding:0;background:#F4F4F4;font-family:Arial,Helvetica,sans-serif;color:#101010"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F4F4"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px"><tr><td style="padding:0 0 20px"><img src="https://${DOMINIO_PUBLICO}/marca/divoox-logo-correo.png" width="160" height="39" alt="${MARCA.nombre}" style="display:block;border:0"></td></tr><tr><td style="background:#FFFFFF;border:1px solid #E6E6E6;border-radius:12px;padding:32px 28px">${parrafos.join('')}</td></tr><tr><td style="padding:20px 8px 0;font-size:12px;line-height:1.7;color:#666B73;text-align:center">${pie}<br>© ${anio} ${MARCA.empresa} · <a href="https://${DOMINIO_PUBLICO}" style="color:#666B73">${DOMINIO_PUBLICO}</a></td></tr></table></td></tr></table></body></html>`;
}
