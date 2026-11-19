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
    // Como el R2 real: con `range` entrega solo esa parte del archivo.
    async get(clave: string, op?: { range?: { offset: number; length: number } }) {
      const d = datos.get(clave);
      if (!d) return null;
      const parte = op?.range
        ? d.bytes.slice(op.range.offset, op.range.offset + op.range.length)
        : d.bytes;
      return {
        body: new Blob([parte]).stream(),
        // Como el R2 real: la foto entera de una vez (la usa el motor de verificación).
        arrayBuffer: async () => new Blob([d.bytes]).arrayBuffer(),
        httpEtag: `"${clave.length}"`,
        writeHttpMetadata(h: Headers) {
          if (d.tipo) h.set('content-type', d.tipo);
          if (d.cache) h.set('cache-control', d.cache);
        },
      };
    },
    // Como el R2 real: los datos de un archivo sin bajarlo (null si no existe).
    async head(clave: string) {
      const d = datos.get(clave);
      return d ? { key: clave, size: d.bytes.length, httpEtag: `"${clave.length}"` } : null;
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
