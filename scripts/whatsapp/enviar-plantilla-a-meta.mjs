// C-WHATSAPP-FALTA (25 nov 2026): CREA en Meta la plantilla de utilidad «te falta» (una por idioma
// que exista en apps/servidor/src/whatsappPlantillaFalta.ts; hoy solo español). No manda ningún
// mensaje a nadie. Si la plantilla ya existe con ese nombre e idioma, no la duplica: dice su estado.
//
// Uso (desde la raíz del repositorio):
//   node scripts/whatsapp/enviar-plantilla-a-meta.mjs           → muestra lo que mandaría, sin llamar a Meta
//   node scripts/whatsapp/enviar-plantilla-a-meta.mjs --enviar  → la crea en Meta
//
// Después: Meta la revisa (de minutos a 24 horas). El aviso de Meta (webhook, campo
// message_template_status_update) guarda solo su estado en el sitio; también se puede mirar con
// consultar-plantilla-en-meta.mjs y marcar a mano en el panel (Recordatorios de registro → WhatsApp).
import {
  PLANTILLAS_FALTA,
  creacionEnMeta,
} from '../../apps/servidor/src/whatsappPlantillaFalta.ts';
import { credenciales, errorEnPalabras, meta } from './meta-comun.mjs';

const enviar = process.argv.includes('--enviar');
const defs = Object.values(PLANTILLAS_FALTA).filter(Boolean);

if (!enviar) {
  for (const def of defs) {
    console.log(`Plantilla «${def.nombre}» (${def.idioma}, ${def.categoria}):`);
    console.log(JSON.stringify(creacionEnMeta(def), null, 2));
  }
  console.log('\nNo se llamó a Meta. Para crearla de verdad, agrega --enviar.');
  process.exit(0);
}

const { token, waba } = credenciales();
let fallas = 0;
for (const def of defs) {
  const ya = await meta(
    `${waba}/message_templates?name=${encodeURIComponent(def.nombre)}&fields=name,language,status,category`,
    { token },
  );
  const existente = ya.ok ? (ya.datos?.data ?? []).find((t) => t.language === def.idioma) : null;
  if (existente) {
    console.log(
      `«${def.nombre}» (${def.idioma}) ya existe: estado ${existente.status}, categoría ${existente.category}. No se duplica.`,
    );
    continue;
  }
  const r = await meta(`${waba}/message_templates`, {
    token,
    metodo: 'POST',
    cuerpo: creacionEnMeta(def),
  });
  if (!r.ok) {
    fallas++;
    console.error(`No se pudo crear «${def.nombre}» (${def.idioma}).\n${errorEnPalabras(r)}`);
    continue;
  }
  console.log(
    `Creada «${def.nombre}» (${def.idioma}): id ${r.datos?.id}, estado ${r.datos?.status}, categoría ${r.datos?.category}.`,
  );
  if (r.datos?.category && r.datos.category !== def.categoria)
    console.log(
      `Ojo: Meta la clasificó como ${r.datos.category}. El servidor NO la usa si no es ${def.categoria}.`,
    );
}
process.exit(fallas ? 1 : 0);
