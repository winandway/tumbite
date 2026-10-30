import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { verificar, type Entrada, type Resultado } from './verificar';

/**
 * La puerta del motor: el servidor de Divoox le manda las fotos firmadas con una clave compartida
 * (VERIFICADOR_CLAVE) y la hora, y el motor responde la decisión. Sin firma válida o con más de cinco
 * minutos, no se mira nada. GET /salud dice si está vivo (para el canario).
 */
const MAX_CUERPO = 25 * 1024 * 1024;
const VENTANA_MS = 5 * 60 * 1000;

export function firmar(clave: string, hora: string, cuerpo: string): string {
  return createHmac('sha256', clave).update(`${hora}.${cuerpo}`).digest('hex');
}

export function firmaValida(
  clave: string,
  hora: string | undefined,
  firma: string | undefined,
  cuerpo: string,
  ahora = Date.now(),
): boolean {
  if (!clave || !hora || !firma || !/^\d+$/.test(hora)) return false;
  if (Math.abs(ahora - Number(hora)) > VENTANA_MS) return false;
  const esperada = Buffer.from(firmar(clave, hora, cuerpo), 'hex');
  const dada = Buffer.from(firma, 'hex');
  return dada.length === esperada.length && timingSafeEqual(dada, esperada);
}

type CuerpoVerificar = {
  docTipo: Entrada['docTipo'];
  frente: string;
  reverso?: string;
  selfie: string;
  giros?: [string, string];
  edadMinima?: number;
  malaConducta?: { id: string; huella: number[] }[];
};

const foto = (b64: string) => Buffer.from(b64, 'base64');

export function aEntrada(c: CuerpoVerificar): Entrada | null {
  if (!['licencia', 'pasaporte', 'identificacion'].includes(c.docTipo)) return null;
  if (typeof c.frente !== 'string' || typeof c.selfie !== 'string') return null;
  return {
    docTipo: c.docTipo,
    frente: foto(c.frente),
    reverso: typeof c.reverso === 'string' ? foto(c.reverso) : undefined,
    selfie: foto(c.selfie),
    giros:
      Array.isArray(c.giros) && c.giros.length === 2
        ? [foto(String(c.giros[0])), foto(String(c.giros[1]))]
        : undefined,
    edadMinima: typeof c.edadMinima === 'number' ? c.edadMinima : undefined,
    malaConducta: Array.isArray(c.malaConducta) ? c.malaConducta : [],
  };
}

function leerCuerpo(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolver) => {
    let total = 0;
    const partes: Buffer[] = [];
    req.on('data', (p: Buffer) => {
      total += p.length;
      if (total > MAX_CUERPO) {
        resolver(null);
        req.destroy();
      } else partes.push(p);
    });
    req.on('end', () => resolver(Buffer.concat(partes).toString('utf8')));
    req.on('error', () => resolver(null));
  });
}

export function crearServidor(
  clave: string,
  motor: (e: Entrada) => Promise<Resultado> = verificar,
): Server {
  return createServer(async (req, res) => {
    const responder = (estado: number, json: unknown) => {
      res.writeHead(estado, { 'content-type': 'application/json' });
      res.end(JSON.stringify(json));
    };
    if (req.method === 'GET' && req.url === '/salud') return responder(200, { ok: true });
    if (req.method !== 'POST' || req.url !== '/verificar') return responder(404, { error: 'no' });
    const cuerpo = await leerCuerpo(req);
    if (cuerpo == null) return responder(413, { error: 'muy_grande' });
    const hora = req.headers['x-hora'];
    const firma = req.headers['x-firma'];
    if (
      !firmaValida(
        clave,
        typeof hora === 'string' ? hora : undefined,
        typeof firma === 'string' ? firma : undefined,
        cuerpo,
      )
    )
      return responder(401, { error: 'firma' });
    let entrada: Entrada | null;
    try {
      entrada = aEntrada(JSON.parse(cuerpo) as CuerpoVerificar);
    } catch {
      entrada = null;
    }
    if (!entrada) return responder(400, { error: 'datos' });
    try {
      return responder(200, await motor(entrada));
    } catch (e) {
      console.error('verificador: fallo al verificar', e);
      return responder(500, { error: 'motor' });
    }
  });
}

// Arranque como servicio (en el contenedor): node src/servidor.ts
if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  const clave = process.env.VERIFICADOR_CLAVE ?? '';
  if (clave.length < 32) {
    console.error('verificador: falta VERIFICADOR_CLAVE (32 caracteres o más)');
    process.exit(1);
  }
  const puerto = Number(process.env.PORT ?? 8080);
  crearServidor(clave).listen(puerto, () => console.warn(`verificador escuchando en ${puerto}`));
}
