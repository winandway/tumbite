// Acceso a la API de Google Play con la cuenta de servicio de la empresa (26 oct 2026). La llave
// vive fuera del repo, en ~/.config/tumbite/google-play-eas.json, y nunca se imprime.
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const BASE = 'https://androidpublisher.googleapis.com';

export async function googlePlay(paquete) {
  const llave = JSON.parse(
    readFileSync(join(homedir(), '.config', 'tumbite', 'google-play-eas.json'), 'utf8'),
  );
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const ahora = Math.floor(Date.now() / 1000);
  const cuerpo = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: llave.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: llave.token_uri,
    iat: ahora,
    exp: ahora + 3000,
  })}`;
  const firma = createSign('RSA-SHA256').update(cuerpo).sign(llave.private_key, 'base64url');
  const t = await (
    await fetch(llave.token_uri, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${cuerpo}.${firma}`,
    })
  ).json();
  if (!t.access_token) throw new Error(`sin acceso a Google Play: ${t.error}`);
  const auth = { authorization: `Bearer ${t.access_token}` };

  /** Llama a la API; `ruta` va después de applications/<paquete>. Falla con el mensaje de Google. */
  const pedir = async (ruta, { metodo = 'POST', json, binario, subir = false } = {}) => {
    const url = `${BASE}${subir ? '/upload' : ''}/androidpublisher/v3/applications/${paquete}${ruta}${subir ? '?uploadType=media' : ''}`;
    const r = await fetch(url, {
      method: metodo,
      headers: {
        ...auth,
        ...(json ? { 'content-type': 'application/json' } : {}),
        ...(binario ? { 'content-type': 'application/octet-stream' } : {}),
      },
      body: json ? JSON.stringify(json) : binario,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${r.status} ${d.error?.message ?? ''}`);
    return d;
  };

  /** Abre una edición, corre `trabajo(id)` y la confirma; si algo falla, la descarta. */
  const editar = async (trabajo) => {
    const { id } = await pedir('/edits');
    try {
      const res = await trabajo(id);
      await pedir(`/edits/${id}:commit`);
      return res;
    } catch (e) {
      await pedir(`/edits/${id}`, { metodo: 'DELETE' }).catch(() => {});
      throw e;
    }
  };
  return { pedir, editar };
}
