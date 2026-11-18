import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { enIdioma } from '@tumbite/compartido';
import { Deslizador } from '@tumbite/movil';

/**
 * C-DESLIZAR-ENTREGA (15 nov 2026, primera prueba real de Richard en Novi): el cierre de la
 * entrega es un deslizador, como «Swipe to complete delivery» de Uber Driver y el cierre de
 * DoorDash Dasher después de la foto. Un deslizamiento a propósito evita cerrar sin querer con un
 * toque en el bolsillo. Se habilita con la foto de la puerta ya tomada; el servidor confirma además
 * que el GPS esté en la dirección. Con lector de pantalla basta con activarlo (doble toque).
 *
 * Desde C-SERVICIOS-CONECTADOS (16 nov 2026, DRIVER.md §3) usa la pieza común `Deslizador` de las
 * acciones del trabajo: 60 de alto, rojo de la marca, pulgar blanco con la flecha, umbral del 85 %.
 */
const T = {
  es: {
    deslizar: 'Desliza para completar',
    primeroFoto: 'Primero toma la foto',
    completando: 'Completando…',
    confirmar: { pregunta: '¿Completar la entrega?', si: 'Completar', no: 'Cancelar' },
  },
  en: {
    deslizar: 'Slide to complete delivery',
    primeroFoto: 'Take the photo first',
    completando: 'Completing…',
    confirmar: { pregunta: 'Complete the delivery?', si: 'Complete', no: 'Cancel' },
  },
};

export function DeslizarParaCompletar({
  idioma,
  listo,
  ocupado = false,
  alCompletar,
  testID = 'deslizar-completar',
}: {
  idioma: 'es' | 'en';
  /** La foto ya está tomada (y el pedido sigue en la puerta). */
  listo: boolean;
  /** Mientras sube la foto o se cierra el pedido. */
  ocupado?: boolean;
  alCompletar: () => Promise<unknown>;
  testID?: string;
}) {
  const t = enIdioma(T, idioma);
  const [cerrando, setCerrando] = useState(false);
  const vivo = useRef(true);
  useEffect(
    () => () => {
      vivo.current = false;
    },
    [],
  );

  async function completar() {
    setCerrando(true);
    try {
      await alCompletar();
    } finally {
      if (vivo.current) setCerrando(false);
    }
  }

  return (
    <View style={{ marginTop: 8 }}>
      <Deslizador
        variante="accion"
        testID={testID}
        texto={cerrando ? t.completando : listo ? t.deslizar : t.primeroFoto}
        accionLector={t.deslizar}
        habilitado={listo}
        ocupado={ocupado || cerrando}
        // Revisor (18 nov 2026): con lector de pantalla, cerrar (y cobrar) pregunta antes.
        confirmar={t.confirmar}
        alConfirmar={completar}
      />
    </View>
  );
}
