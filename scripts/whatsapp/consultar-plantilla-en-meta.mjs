// C-WHATSAPP-FALTA (25 nov 2026): CONSULTA en Meta el estado de la plantilla «te falta» (aprobada,
// pendiente, rechazada y por qué, y su categoría). Solo lee: no crea nada, no manda nada y no escribe
// en ninguna base.
//
// Uso (desde la raíz del repositorio):
//   node scripts/whatsapp/consultar-plantilla-en-meta.mjs
//
// El servidor solo manda la plantilla cuando su estado guardado es APPROVED y su categoría UTILITY.
// Ese estado llega solo con el aviso de Meta (webhook); si no llegó, se marca a mano en el panel
// (Recordatorios de registro → WhatsApp «te falta»), y queda en la auditoría.
import { PLANTILLAS_FALTA } from '../../apps/servidor/src/whatsappPlantillaFalta.ts';
import { credenciales, errorEnPalabras, meta } from './meta-comun.mjs';

const { token, waba } = credenciales();
let fallas = 0;
for (const def of Object.values(PLANTILLAS_FALTA).filter(Boolean)) {
  const r = await meta(
    `${waba}/message_templates?name=${encodeURIComponent(def.nombre)}&fields=name,language,status,category,rejected_reason,quality_score`,
    { token },
  );
  if (!r.ok) {
    fallas++;
    console.error(`No se pudo consultar «${def.nombre}».\n${errorEnPalabras(r)}`);
    continue;
  }
  const t = (r.datos?.data ?? []).find((x) => x.language === def.idioma);
  if (!t) {
    console.log(`«${def.nombre}» (${def.idioma}): todavía no existe en Meta.`);
    continue;
  }
  const usable = t.status === 'APPROVED' && t.category === def.categoria;
  console.log(
    `«${def.nombre}» (${def.idioma}): estado ${t.status}, categoría ${t.category}` +
      (t.rejected_reason && t.rejected_reason !== 'NONE' ? `, motivo ${t.rejected_reason}` : '') +
      (t.quality_score?.score ? `, calidad ${t.quality_score.score}` : '') +
      (usable ? '. Lista para usar.' : '. Todavía NO se usa.'),
  );
}
process.exit(fallas ? 1 : 0);
