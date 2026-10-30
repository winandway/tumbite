/** Almacén de archivos de mentira, en memoria, para las pruebas (nunca toca el R2 real). */
export function crearAlmacenPruebas() {
  const datos = new Map<string, { bytes: Uint8Array; tipo?: string; cache?: string }>();
  const bucket = {
    async put(
      clave: string,
      valor: Uint8Array | string,
      op?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
    ) {
      datos.set(clave, {
        bytes: typeof valor === 'string' ? new TextEncoder().encode(valor) : valor,
        tipo: op?.httpMetadata?.contentType,
        cache: op?.httpMetadata?.cacheControl,
      });
      return {};
    },
    async get(clave: string) {
      const d = datos.get(clave);
      if (!d) return null;
      return {
        body: new Blob([d.bytes]).stream(),
        // Como el R2 real: la foto entera de una vez (la usa el motor de verificación).
        arrayBuffer: async () => new Blob([d.bytes]).arrayBuffer(),
        httpEtag: `"${clave.length}"`,
        writeHttpMetadata(h: Headers) {
          if (d.tipo) h.set('content-type', d.tipo);
          if (d.cache) h.set('cache-control', d.cache);
        },
      };
    },
    async list(op?: { prefix?: string }) {
      const objects = [...datos.keys()]
        .filter((k) => !op?.prefix || k.startsWith(op.prefix))
        .map((key) => ({ key }));
      return { objects, truncated: false, cursor: undefined };
    },
    async delete(claves: string | string[]) {
      for (const k of Array.isArray(claves) ? claves : [claves]) datos.delete(k);
    },
  };
  return { bucket: bucket as unknown as R2Bucket, datos };
}
