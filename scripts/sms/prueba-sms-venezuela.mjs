// Prueba de UN SMS por número con SMS Masivo Venezuela (C-SMS-VENEZUELA, 22 nov 2026) — Venezuela.
// Envía un mensaje real que cuesta un crédito: SOLO se corre con el número que Richard autorizó y con
// la bandera --enviar. Sin la bandera no manda nada: solo dice qué haría.
// La llave se lee de la carpeta de configuración del proyecto y nunca se imprime. Los números van como
// argumentos (no se guardan en el repositorio); en el registro queda solo su terminación.
// Texto fijo, corporativo, con la palabra «prueba», sin montos ni datos de pago, y dentro de un solo
// SMS (letras sin acentos: 85 caracteres de los 160).
//   node scripts/sms/prueba-sms-venezuela.mjs +58XXXXXXXXXX [+58…]            (ensayo: no envía)
//   node scripts/sms/prueba-sms-venezuela.mjs --enviar +58XXXXXXXXXX [+58…]   (envía uno a cada uno)
//   node scripts/sms/prueba-sms-venezuela.mjs --estado <id-de-la-solicitud>   (pregunta cómo quedó)
// El registro de cada respuesta (estado, identificador y hora) queda en
// Documentos → Entregas → Divoox → pruebas-sms-venezuela.
/* eslint-disable security/detect-non-literal-fs-filename -- guion local: carpetas fijas de esta computadora */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROVEEDOR = 'https://smsmasivovenezuela.com';
export const TEXTO =
  'Divoox: prueba de mensajes. Si recibes este texto, nuestro sistema funciona. Gracias.';
const SALIDA = join(homedir(), 'Documents', 'Entregas', 'Divoox', 'pruebas-sms-venezuela');
const args = process.argv.slice(2);
const enviar = args.includes('--enviar');
const estado = args.includes('--estado') ? args[args.indexOf('--estado') + 1] : null;
const numeros = args.filter((a) => a.startsWith('+'));

// Un solo SMS: solo letras del alfabeto básico de los SMS y 160 caracteres como mucho.
if (TEXTO.length > 160 || /[^A-Za-z0-9 .,:;!?()'-]/.test(TEXTO))
  throw new Error('el texto de prueba no cabe en un solo SMS');
for (const n of numeros)
  if (!/^\+58(4\d{9})$/.test(n))
    throw new Error(`solo celulares de Venezuela (+58 4XX…): ${n.slice(0, 4)}…${n.slice(-2)}`);
if (!estado && !numeros.length) throw new Error('falta el número (+58…) o --estado <id>');

const llave = () =>
  readFileSync(join(homedir(), '.config', 'tumbite', 'smsmasivo-api-key'), 'utf8').trim();
const ahora = () => new Date().toISOString();
const guardar = (nombre, datos) => {
  mkdirSync(SALIDA, { recursive: true });
  writeFileSync(join(SALIDA, nombre), `${JSON.stringify(datos, null, 2)}\n`);
  console.log(`registro: ${nombre}`);
};

if (estado) {
  const r = await fetch(`${PROVEEDOR}/api/v1/messages/${encodeURIComponent(estado)}`, {
    headers: { authorization: `Bearer ${llave()}` },
  });
  const cuerpo = await r.json().catch(() => null);
  guardar(`estado-${estado}-${ahora().replace(/[:.]/g, '-')}.json`, {
    consultadoEn: ahora(),
    http: r.status,
    respuesta: cuerpo,
  });
  console.log(r.status, JSON.stringify(cuerpo));
} else if (!enviar) {
  console.log(`ENSAYO, no se envió nada. Texto (${TEXTO.length} caracteres): ${TEXTO}`);
  for (const n of numeros) console.log(`  iría a …${n.slice(-4)}`);
  console.log('Para enviar de verdad: la misma orden con --enviar.');
} else {
  for (const n of numeros) {
    const referencia = `prueba-${ahora().replace(/[:.]/g, '-')}-${n.slice(-4)}`;
    const enviadoEn = ahora();
    const r = await fetch(`${PROVEEDOR}/api/v1/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${llave()}`,
        'content-type': 'application/json',
        'idempotency-key': referencia,
      },
      body: JSON.stringify({ channel: 'SMS', to: n, message: TEXTO, reference: referencia }),
      signal: AbortSignal.timeout(15_000),
    });
    const cuerpo = await r.json().catch(() => null);
    guardar(`envio-${referencia}.json`, {
      enviadoEn,
      terminacion: n.slice(-4),
      texto: TEXTO,
      referencia,
      http: r.status,
      respuesta: cuerpo,
    });
    console.log(`…${n.slice(-4)}: ${r.status} ${JSON.stringify(cuerpo)}`);
  }
}
