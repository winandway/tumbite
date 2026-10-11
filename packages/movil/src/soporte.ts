import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import type { Api } from '@tumbite/compartido';

/** El WhatsApp de soporte lo da el servidor (variable del sitio). Sin número, el botón no sale. */
export function useSoporte(api: Api) {
  const [whatsapp, setWhatsapp] = useState('');
  useEffect(() => {
    api
      .pedir<{ whatsapp: string }>('GET', '/datos/publico')
      .then((r) => setWhatsapp(r.whatsapp))
      .catch(() => setWhatsapp(''));
  }, [api]);
  return {
    whatsapp,
    abrirWhatsapp: (texto = '') =>
      Linking.openURL(
        `https://wa.me/${whatsapp}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`,
      ),
  };
}
