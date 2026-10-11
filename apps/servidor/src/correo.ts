import { MARCA } from '@tumbite/compartido';
import type { Env } from './env';

/**
 * Correos que manda el sitio, por la API de YaDominios Cloud (incluida en el plan,
 * firmada con DKIM desde tumbite.com). Un solo lugar para enviar: nada manda correos por fuera.
 * Nunca falla en silencio: el último error queda en el canario de /datos/salud.
 */
export const SITIO = 'tumbite';
export const DOMINIO_CORREO = 'tumbite.com';

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

/** Plantilla sencilla con la marca: título rojo, texto, y los enlaces como botón. */
export function aHtml(texto: string): string {
  const parrafos = texto
    .trim()
    .split(/\n{2,}/)
    .map((p) => {
      const t = escapar(p.trim());
      const m = t.match(/^(https?:\/\/\S+)$/);
      if (m)
        return `<p style="margin:24px 0"><a href="${m[1]}" style="background:#FF3008;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px;display:inline-block">${m[1]}</a></p>`;
      return `<p style="margin:0 0 14px;line-height:1.5">${t.replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
  return `<!doctype html><html><body style="margin:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#191919"><div style="max-width:560px;margin:0 auto;padding:24px"><div style="background:#fff;border-radius:16px;padding:28px"><p style="margin:0 0 20px;font-size:22px;font-weight:800;color:#FF3008">${MARCA.nombre}</p>${parrafos}</div><p style="font-size:12px;color:#777;text-align:center;margin:16px 0 0">${MARCA.nombre} · ${DOMINIO_CORREO}</p></div></body></html>`;
}
