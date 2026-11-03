# Ficha · Fotos de platos y restaurantes livianas (NXT-7, 3 nov 2026)

Candado: C-FOTOS-LIVIANAS. Todos los países.

## Referencias y evidencia

- [REA] Se grabó como visitante la red de la portada pública de Uber Eats (Miami) y de DoorDash (restaurantes de Miami) y se analizó con REA (`inspect_web_network_capture`). Paquete fuera del repositorio (lleva fichas del anti-robots de terceros, que el escáner de secretos marca): `~/Divoox-privado/estudios/rea-2026-11-03-fotos-livianas/evidencia-rea-2026-11-03-fotos-livianas.json`, sha256 `6116f229e35ac4e4fb7ba102299e4afe210eecdb0a7b933201eafa0c145d58aa`; evidencias REA `ev_d8697070…` (DoorDash) y `ev_42351256…` (Uber Eats). Resultado: Uber Eats respondió con el desafío anti-robots de Cloudflare («Just a moment…», imágenes solo de challenges.cloudflare.com) y DoorDash entregó 8 peticiones sin imágenes de platos. **No se saltó ningún anti-robots** (límite legal del proyecto): cómo sirven sus fotos por dentro queda [NV].
- [DOC] Ayuda de DoorDash para comercios («Menu Photo Terms» y «Common Photo Issues»): las fotos del menú tienen que medir al menos 1400 × 800, apaisadas, y agrandar una foto chica la deja borrosa. Por eso nuestra completa mide 1400 de lado y nunca se agranda.
- [DOC] Uber Eats para comercios (página de fotos del menú): consejos de luz y encuadre; no publica medidas oficiales. Las cifras de terceros no coinciden entre sí: no se usan.
- [INF] Las apps grandes piden a su servidor de imágenes una foto del ancho que necesita cada pantalla (lista, tarjeta, ficha). Nosotros lo hacemos sin servicios de pago: tres archivos WebP hechos en el teléfono o en el navegador.

## Diagrama

```
elegir foto (galería en JPEG «compatible» / archivo en el navegador)
  └─ convertir aquí: completa 1400 · tarjeta 640 · miniatura 200 (WebP, sin agrandar)
       ├─ POST /datos/mi-restaurante/fotos                 → /media/fotos/<r>/<id>.webp
       ├─ POST …/fotos?de=<id>&tam=tarjeta   (≤ 640 px, ≤ 200 KB) → <id>-m.webp
       └─ POST …/fotos?de=<id>&tam=miniatura (≤ 200 px, ≤ 40 KB)  → <id>-s.webp
pantalla → urlFoto(ruta, 'miniatura' | 'tarjeta' | 'completa') → si el tamaño no existe, /media entrega la completa
```

## Comparación con Divoox

- Antes: el panel reducía a 1200 px WebP y la app del restaurante subía el JPEG de la galería (calidad 0,6); todas las pantallas bajaban la misma foto grande.
- Ahora: tres tamaños; listas y carrito piden la miniatura, las tarjetas la mediana, la ficha la grande. Las fotos viejas siguen funcionando (respaldo a la completa con caché corta).
- No se tocan las fotos de evidencia (entregas, quejas, chat) ni los documentos.

## Pruebas de aceptación

`apps/servidor/src/rutas/fotos.test.ts` (bloque NXT-7: tamaños guardados y servidos, peso y medidas en 422, foto vieja con respaldo, otro restaurante 404), `packages/compartido/src/fotosLivianas.test.ts`, `apps/panel/src/panel/SubirFoto.test.tsx` (tres tamaños desde el navegador) y `apps/servidor/src/fotosLivianasApps.test.ts` (la pieza de las apps y qué tamaño pide cada pantalla).
