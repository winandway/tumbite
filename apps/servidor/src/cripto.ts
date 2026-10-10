/** Contraseñas y tokens con WebCrypto (disponible en el servidor y en las pruebas). */
const ITERACIONES = 100_000; // tope que permite el entorno del servidor para PBKDF2
const codificador = new TextEncoder();

function aBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function deBase64(texto: string): Uint8Array {
  return Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
}

async function derivar(clave: string, sal: Uint8Array, iteraciones: number): Promise<Uint8Array> {
  const llave = await crypto.subtle.importKey('raw', codificador.encode(clave), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones },
    llave,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashClave(clave: string): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivar(clave, sal, ITERACIONES);
  return `pbkdf2$${ITERACIONES}$${aBase64(sal)}$${aBase64(hash)}`;
}

export async function verificarClave(clave: string, guardado: string): Promise<boolean> {
  const [tipo, iter, sal, hash] = guardado.split('$');
  if (tipo !== 'pbkdf2' || !iter || !sal || !hash) return false;
  const calculado = await derivar(clave, deBase64(sal), Number(iter));
  const esperado = deBase64(hash);
  if (calculado.length !== esperado.length) return false;
  let diferencia = 0;
  calculado.forEach((b, i) => {
    diferencia |= b ^ (esperado.at(i) ?? 0);
  });
  return diferencia === 0;
}

export function nuevoToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return aBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function sha256(texto: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', codificador.encode(texto));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function nuevoId(): string {
  return crypto.randomUUID();
}
