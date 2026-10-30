import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ErrorApi, type Turno, enIdioma, useBorrador } from '@tumbite/compartido';
import { C, Campo, alSalirTelefono, almacenTelefono, e, useSesion } from '@tumbite/movil';
import { BotonGrande, Tarjeta } from './piezas/ui';

/**
 * C-APP-RESTAURANTE-PAR (30 oct 2026): horario de cada día y cierres (festivos, vacaciones) desde el
 * celular, como en DoorDash Merchant y Uber Eats Manager. Lo escrito se guarda solo (borrador).
 */
const T = {
  es: {
    titulo: 'Horario y cierres',
    dias: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    cerrado: 'Cerrado',
    abre: 'Abre',
    cierra: 'Cierra',
    turno: '+ Turno',
    quitar: 'Quitar',
    guardar: 'Guardar horario',
    guardado: 'Horario guardado.',
    cierres: 'Festivos y cierres',
    cierresAyuda: 'Ese día apareces cerrado aunque esté en tu horario.',
    fecha: 'Fecha (AAAA-MM-DD)',
    motivo: 'Motivo (solo lo ve tu equipo)',
    agregar: 'Agregar cierre',
    volver: 'Volver',
  },
  en: {
    titulo: 'Hours and closures',
    dias: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    cerrado: 'Closed',
    abre: 'Opens',
    cierra: 'Closes',
    turno: '+ Shift',
    quitar: 'Remove',
    guardar: 'Save hours',
    guardado: 'Hours saved.',
    cierres: 'Holidays and closures',
    cierresAyuda: 'That day you show as closed even if it’s within your hours.',
    fecha: 'Date (YYYY-MM-DD)',
    motivo: 'Reason (only your team sees it)',
    agregar: 'Add closure',
    volver: 'Back',
  },
};

export function Horario({ alVolver }: { alVolver: () => void }) {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(T, idioma);
  const [turnos, setTurnos] = useState<Turno[] | null>(null);
  const [cierres, setCierres] = useState<{ id: string; fecha: string; motivo: string }[]>([]);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const fallo = (x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x));
  const b = useBorrador({
    formulario: 'app-cierre',
    cuenta: usuario?.id,
    inicial: { fecha: '', motivo: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const cargar = useCallback(() => {
    api
      .pedir<{ restaurante: { horarios?: Turno[] } | null }>('GET', '/datos/mi-restaurante')
      .then((r) => setTurnos(r.restaurante?.horarios ?? []))
      .catch(fallo);
    api
      .pedir<{ cierres: { id: string; fecha: string; motivo: string }[] }>(
        'GET',
        '/datos/mi-restaurante/cierres',
      )
      .then((r) => setCierres(r.cierres))
      .catch(fallo);
  }, [api]);
  useEffect(cargar, [cargar]);
  const cambiar = (i: number, campo: 'abre' | 'cierra', valor: string) =>
    setTurnos((ts) => (ts ?? []).map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));
  return (
    <View testID="app-horario">
      <Text
        accessibilityRole="header"
        style={{ fontSize: 22, fontWeight: '900', color: C.secundario, marginBottom: 10 }}
      >
        {t.titulo}
      </Text>
      {error ? <Text style={e.error}>{error}</Text> : null}
      {aviso ? <Text style={{ color: C.exito, fontWeight: '700' }}>{aviso}</Text> : null}
      {turnos
        ? t.dias.map((nombre, dia) => {
            const delDia = turnos.map((x, i) => [x, i] as const).filter(([x]) => x.dia === dia);
            return (
              <Tarjeta key={nombre}>
                <Text style={{ fontWeight: '800', color: C.secundario }}>{nombre}</Text>
                {!delDia.length ? <Text style={{ color: '#5E5E5E' }}>{t.cerrado}</Text> : null}
                {delDia.map(([x, i]) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                    <View style={{ flex: 1 }}>
                      <Campo
                        etiqueta={`${t.abre} · ${nombre}`}
                        value={x.abre}
                        onChangeText={(v) => cambiar(i, 'abre', v)}
                        placeholder="09:00"
                        maxLength={5}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Campo
                        etiqueta={`${t.cierra} · ${nombre}`}
                        value={x.cierra}
                        onChangeText={(v) => cambiar(i, 'cierra', v)}
                        placeholder="22:00"
                        maxLength={5}
                      />
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setTurnos((ts) => (ts ?? []).filter((_, j) => j !== i))}
                      style={{ paddingVertical: 14 }}
                    >
                      <Text style={{ color: '#5E5E5E', fontWeight: '700' }}>{t.quitar}</Text>
                    </Pressable>
                  </View>
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t.turno} · ${nombre}`}
                  onPress={() =>
                    setTurnos((ts) => [...(ts ?? []), { dia, abre: '09:00', cierra: '22:00' }])
                  }
                  style={{ paddingVertical: 6 }}
                >
                  <Text style={{ color: C.primario, fontWeight: '800' }}>{t.turno}</Text>
                </Pressable>
              </Tarjeta>
            );
          })
        : null}
      <BotonGrande
        texto={t.guardar}
        alTocar={() => {
          setAviso('');
          setError('');
          void api
            .pedir('PUT', '/datos/mi-restaurante/horarios', { turnos: turnos ?? [] })
            .then(() => setAviso(t.guardado))
            .catch(fallo);
        }}
      />
      <Text style={{ fontSize: 18, fontWeight: '900', color: C.secundario, marginTop: 18 }}>
        {t.cierres}
      </Text>
      <Text style={{ color: '#5E5E5E', marginBottom: 8 }}>{t.cierresAyuda}</Text>
      {cierres.map((x) => (
        <Tarjeta key={x.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontWeight: '700' }}>
              {x.fecha}
              {x.motivo ? ` · ${x.motivo}` : ''}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t.quitar} ${x.fecha}`}
              onPress={() =>
                void api
                  .pedir('DELETE', `/datos/mi-restaurante/cierres/${x.id}`)
                  .then(cargar)
                  .catch(fallo)
              }
            >
              <Text style={{ color: '#5E5E5E', fontWeight: '700' }}>{t.quitar}</Text>
            </Pressable>
          </View>
        </Tarjeta>
      ))}
      <Campo
        etiqueta={t.fecha}
        value={b.valores.fecha}
        onChangeText={(v) => b.cambiar('fecha', v)}
        placeholder="2026-12-25"
        maxLength={10}
      />
      <Campo
        etiqueta={t.motivo}
        value={b.valores.motivo}
        onChangeText={(v) => b.cambiar('motivo', v)}
        maxLength={80}
      />
      <BotonGrande
        texto={t.agregar}
        tipo="claro"
        alTocar={() =>
          void api
            .pedir('POST', '/datos/mi-restaurante/cierres', {
              fecha: b.valores.fecha.trim(),
              motivo: b.valores.motivo,
            })
            .then(async () => {
              await b.limpiar();
              cargar();
            })
            .catch(fallo)
        }
      />
      <BotonGrande texto={t.volver} tipo="claro" alTocar={alVolver} />
    </View>
  );
}
