import { Pressable, Switch, Text, View } from 'react-native';
import {
  type GrupoForm,
  type Idioma,
  enIdioma,
  leerFormularioGrupos,
  montoATexto,
} from '@tumbite/compartido';
import { C, Campo } from '@tumbite/movil';
import { Pildora, Tarjeta } from './piezas/ui';

/**
 * C-APP-OPCIONES (30 oct 2026): tamaños, extras y grupos anidados de un plato desde el celular, como
 * Uber Eats Manager. El formulario vive en el borrador del plato (texto JSON) y se guarda con él.
 */
const T = {
  es: {
    titulo: 'Opciones del plato (tamaño, extras, sin…)',
    grupo: 'Grupo',
    nombreGrupo: 'Nombre del grupo',
    nombreGrupoEn: 'Nombre del grupo (inglés)',
    minimo: 'Mínimo',
    maximo: 'Máximo',
    opcion: 'Opción',
    opcionEn: 'Opción (inglés)',
    precio: 'Precio extra',
    disponible: 'Disponible',
    abre: 'Al elegirla, pide también:',
    nada: 'Nada más',
    nuevaOpcion: '+ Opción',
    nuevoGrupo: '+ Grupo de opciones',
    quitar: 'Quitar',
  },
  en: {
    titulo: 'Item options (size, extras, no…)',
    grupo: 'Group',
    nombreGrupo: 'Group name',
    nombreGrupoEn: 'Group name (English)',
    minimo: 'Minimum',
    maximo: 'Maximum',
    opcion: 'Option',
    opcionEn: 'Option (English)',
    precio: 'Extra price',
    disponible: 'Available',
    abre: 'When chosen, also ask for:',
    nada: 'Nothing else',
    nuevaOpcion: '+ Option',
    nuevoGrupo: '+ Option group',
    quitar: 'Remove',
  },
};

export function EditorOpciones({
  valor,
  cambiar,
  moneda,
  idioma,
}: {
  valor: string;
  cambiar: (texto: string) => void;
  moneda: string;
  idioma: Idioma;
}) {
  const t = enIdioma(T, idioma);
  const grupos = leerFormularioGrupos(valor);
  const poner = (gs: GrupoForm[]) => cambiar(JSON.stringify(gs));
  const enGrupo = (gi: number, cambio: Partial<GrupoForm>) =>
    poner(grupos.map((g, j) => (j === gi ? { ...g, ...cambio } : g)));
  const enOpcion = (gi: number, oi: number, cambio: Partial<GrupoForm['opciones'][number]>) =>
    poner(
      grupos.map((g, j) =>
        j === gi
          ? { ...g, opciones: g.opciones.map((o, k) => (k === oi ? { ...o, ...cambio } : o)) }
          : g,
      ),
    );
  return (
    <View testID="editor-opciones" style={{ marginBottom: 10 }}>
      <Text style={{ fontWeight: '800', color: C.secundario, marginBottom: 6 }}>{t.titulo}</Text>
      {grupos.map((g, gi) => (
        <Tarjeta key={gi}>
          <Campo
            etiqueta={`${t.nombreGrupo} ${gi + 1}`}
            value={g.nombreEs}
            onChangeText={(x) => enGrupo(gi, { nombreEs: x })}
            maxLength={40}
          />
          <Campo
            etiqueta={`${t.nombreGrupoEn} ${gi + 1}`}
            value={g.nombreEn}
            onChangeText={(x) => enGrupo(gi, { nombreEn: x })}
            maxLength={40}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Campo
                etiqueta={`${t.minimo} ${gi + 1}`}
                value={g.minimo}
                onChangeText={(x) => enGrupo(gi, { minimo: x.replace(/\D/g, '') })}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Campo
                etiqueta={`${t.maximo} ${gi + 1}`}
                value={g.maximo}
                onChangeText={(x) => enGrupo(gi, { maximo: x.replace(/\D/g, '') })}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
          </View>
          {g.opciones.map((o, oi) => (
            <View
              key={oi}
              style={{ borderTopWidth: 1, borderTopColor: '#ECECEC', paddingTop: 8, marginTop: 4 }}
            >
              <Campo
                etiqueta={`${t.opcion} ${gi + 1}.${oi + 1}`}
                value={o.nombreEs}
                onChangeText={(x) => enOpcion(gi, oi, { nombreEs: x })}
                maxLength={60}
              />
              <Campo
                etiqueta={`${t.opcionEn} ${gi + 1}.${oi + 1}`}
                value={o.nombreEn}
                onChangeText={(x) => enOpcion(gi, oi, { nombreEn: x })}
                maxLength={60}
              />
              <Campo
                etiqueta={`${t.precio} ${gi + 1}.${oi + 1}`}
                value={o.precio}
                onChangeText={(x) => enOpcion(gi, oi, { precio: x })}
                placeholder={montoATexto(0, moneda)}
                keyboardType="decimal-pad"
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ flex: 1 }}>{t.disponible}</Text>
                <Switch
                  value={o.disponible}
                  onValueChange={(x) => enOpcion(gi, oi, { disponible: x })}
                  accessibilityLabel={`${t.disponible} ${gi + 1}.${oi + 1}`}
                  trackColor={{ true: C.exito, false: '#D6D6D6' }}
                />
              </View>
              {grupos.length > 1 ? (
                <View style={{ marginTop: 6 }}>
                  <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{t.abre}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    <Pildora
                      texto={t.nada}
                      activa={!o.abreGrupo}
                      alTocar={() => enOpcion(gi, oi, { abreGrupo: '' })}
                    />
                    {grupos.map((y, j) =>
                      j === gi || !y.nombreEs.trim() ? null : (
                        <Pildora
                          key={j}
                          texto={y.nombreEs}
                          activa={o.abreGrupo === String(j)}
                          alTocar={() => enOpcion(gi, oi, { abreGrupo: String(j) })}
                        />
                      ),
                    )}
                  </View>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => enGrupo(gi, { opciones: g.opciones.filter((_, k) => k !== oi) })}
                style={{ paddingVertical: 6 }}
              >
                <Text style={{ color: '#5E5E5E', fontWeight: '700' }}>{t.quitar}</Text>
              </Pressable>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t.nuevaOpcion} · ${t.grupo} ${gi + 1}`}
              onPress={() =>
                enGrupo(gi, {
                  opciones: [
                    ...g.opciones,
                    { nombreEs: '', nombreEn: '', precio: '', disponible: true, abreGrupo: '' },
                  ],
                })
              }
            >
              <Text style={{ color: C.primario, fontWeight: '800' }}>{t.nuevaOpcion}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t.quitar} · ${t.grupo} ${gi + 1}`}
              onPress={() => poner(grupos.filter((_, j) => j !== gi))}
            >
              <Text style={{ color: '#5E5E5E', fontWeight: '700' }}>{t.quitar}</Text>
            </Pressable>
          </View>
        </Tarjeta>
      ))}
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          poner([
            ...grupos,
            {
              nombreEs: '',
              nombreEn: '',
              minimo: '0',
              maximo: '1',
              opciones: [
                { nombreEs: '', nombreEn: '', precio: '', disponible: true, abreGrupo: '' },
              ],
            },
          ])
        }
        style={{ paddingVertical: 8 }}
      >
        <Text style={{ color: C.primario, fontWeight: '800' }}>{t.nuevoGrupo}</Text>
      </Pressable>
    </View>
  );
}
