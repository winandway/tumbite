/** Almacén de archivos de mentira, en memoria, para las pruebas (nunca toca el R2 real). */
export function crearAlmacenPruebas() {
  const datos = new Map<string, { bytes: Uint8Array; tipo?: string; cache?: string }>();
  const bucket = {
    async put(
      clave: string,
      valor: Uint8Array,
      op?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
    ) {
      datos.set(clave, {
        bytes: valor,
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
        httpEtag: `"${clave.length}"`,
        writeHttpMetadata(h: Headers) {
          if (d.tipo) h.set('content-type', d.tipo);
          if (d.cache) h.set('cache-control', d.cache);
        },
      };
    },
  };
  return { bucket: bucket as unknown as R2Bucket, datos };
}
