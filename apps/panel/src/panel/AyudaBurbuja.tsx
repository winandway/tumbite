import { useState } from 'react';
import { type Idioma, enIdioma, formatearDolares } from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { pedir } from './api';
import { ReportarPanel } from './ReportarPanel';

type Billetera = { saldo: number; cuentaConectada: boolean; pagosActivos: boolean };
type Respuesta = { texto: string; enlace?: [string, string] };

const T = {
  es: {
    abrir: 'Ayuda',
    cerrar: 'Cerrar la ayuda',
    titulo: '¿En qué te ayudamos?',
    buscar: 'Escribe tu pregunta',
    persona: 'Hablar con una persona',
    otra: 'Otra pregunta',
    cargando: 'Revisando tu cuenta…',
    sinCoincidencia:
      'No tengo esa respuesta a mano. Toca «Hablar con una persona» y te responde alguien del equipo.',
  },
  en: {
    abrir: 'Help',
    cerrar: 'Close help',
    titulo: 'How can we help?',
    buscar: 'Type your question',
    persona: 'Talk to a person',
    otra: 'Another question',
    cargando: 'Checking your account…',
    sinCoincidencia:
      'I don’t have that answer handy. Tap “Talk to a person” and someone from our team will reply.',
  },
};

type Pregunta = {
  id: string;
  pregunta: Record<Idioma, string>;
  claves: string[];
  /** Respuesta fija o calculada con los datos reales del restaurante. */
  responder: (idioma: Idioma) => Promise<Respuesta> | Respuesta;
};

const PREGUNTAS: Pregunta[] = [
  {
    id: 'cobro',
    pregunta: { es: '¿Cuándo y cómo cobro?', en: 'When and how do I get paid?' },
    claves: ['cobr', 'pag', 'banco', 'dinero', 'retir', 'paid', 'money', 'bank', 'payout'],
    responder: async (idioma) => {
      const b = await pedir<Billetera>('GET', '/datos/billetera');
      const saldo = formatearDolares(b.saldo, idioma);
      if (!b.cuentaConectada || !b.pagosActivos)
        return {
          texto:
            idioma === 'en'
              ? `You can’t get paid yet: your bank account isn’t connected. Your balance (${saldo}) is safe and waiting. Connect your bank in Earnings; you enter your details on Stripe, never with us.`
              : `Todavía no puedes cobrar: te falta conectar tu cuenta bancaria. Tu saldo (${saldo}) está guardado esperándote. Conecta tu banco en Beneficios; los datos los escribes en Stripe, nunca con nosotros.`,
          enlace: ['/panel/earnings', idioma === 'en' ? 'Go to Earnings →' : 'Ir a Beneficios →'],
        };
      return {
        texto:
          idioma === 'en'
            ? `Your bank is connected. Each sale (minus your commission) is credited when the order is delivered. Your balance today is ${saldo}, and you can withdraw it any time from Earnings. Stripe sends it to your bank.`
            : `Tu banco ya está conectado. Cada venta (menos tu comisión) se acredita cuando el pedido se entrega. Hoy tienes ${saldo} y lo puedes retirar cuando quieras desde Beneficios. Stripe lo manda a tu banco.`,
        enlace: ['/panel/earnings', idioma === 'en' ? 'Go to Earnings →' : 'Ir a Beneficios →'],
      };
    },
  },
  {
    id: 'quien',
    pregunta: { es: '¿Quién me paga?', en: 'Who pays me?' },
    claves: ['quien', 'quién', 'stripe', 'who'],
    responder: (idioma) => ({
      texto:
        idioma === 'en'
          ? 'Tumbite pays you through Stripe Connect, the same payment company used by Amazon and Shopify. Stripe verifies your identity and issues your tax forms.'
          : 'Te paga Tumbite a través de Stripe Connect, la misma empresa de pagos que usan Amazon y Shopify. Stripe verifica tu identidad y te emite los formularios de impuestos.',
    }),
  },
  {
    id: 'comision',
    pregunta: { es: '¿Cuánto me cobran?', en: 'How much do you charge?' },
    claves: ['comision', 'comisión', 'cobran', 'plan', 'commission', 'charge', 'fee'],
    responder: (idioma) => ({
      texto:
        idioma === 'en'
          ? 'Only a commission per order, depending on your plan: Starter 7.5%, Growth 12.5%, or Elite 15%. No long-term contracts. Each order shows exactly what the customer paid and what you receive.'
          : 'Solo una comisión por pedido según tu plan: Inicial 7,5 %, Crece 12,5 % o Élite 15 %. Sin contratos de permanencia. Cada pedido muestra exacto lo que pagó el cliente y lo que recibes.',
    }),
  },
  {
    id: 'aceptar',
    pregunta: { es: '¿Cómo acepto un pedido?', en: 'How do I accept an order?' },
    claves: ['acept', 'pedido', 'alarma', 'accept', 'order', 'alarm'],
    responder: (idioma) => ({
      texto:
        idioma === 'en'
          ? 'In Orders, each new order rings until someone accepts it. Tap «Accept» with the minutes it will take, then «Ready!» when it’s done. Turn on the alarm sound once per device.'
          : 'En Pedidos, cada pedido nuevo suena hasta que alguien lo acepta. Toca «Aceptar» con los minutos que vas a tardar y después «¡Listo!» cuando esté hecho. Activa el sonido de alarma una vez en cada equipo.',
      enlace: ['/panel/orders', idioma === 'en' ? 'Go to Orders →' : 'Ir a Pedidos →'],
    }),
  },
  {
    id: 'menu',
    pregunta: {
      es: '¿Cómo cambio mi menú o un precio?',
      en: 'How do I change my menu or a price?',
    },
    claves: ['menu', 'menú', 'precio', 'plato', 'foto', 'price', 'dish', 'photo'],
    responder: (idioma) => ({
      texto:
        idioma === 'en'
          ? 'In Menu you can add dishes, change prices and photos, and mark a dish as sold out with one tap. Changes show up in the app right away.'
          : 'En Menú agregas platos, cambias precios y fotos, y marcas un plato como agotado con un toque. Los cambios salen en la app al instante.',
      enlace: ['/panel/menu', idioma === 'en' ? 'Go to Menu →' : 'Ir al Menú →'],
    }),
  },
  {
    id: 'pausar',
    pregunta: {
      es: '¿Cómo cierro o pauso el restaurante?',
      en: 'How do I close or pause my restaurant?',
    },
    claves: ['cerrar', 'pausa', 'abrir', 'horario', 'close', 'pause', 'open'],
    responder: (idioma) => ({
      texto:
        idioma === 'en'
          ? 'In My restaurant, switch «Open» on or off. While it’s off, customers see you as closed and no orders come in.'
          : 'En Mi restaurante, prende o apaga «Abierto». Mientras está apagado, los clientes te ven cerrado y no entran pedidos.',
      enlace: [
        '/panel/restaurant',
        idioma === 'en' ? 'Go to My restaurant →' : 'Ir a Mi restaurante →',
      ],
    }),
  },
];

/**
 * Burbuja de ayuda del panel del restaurante: respuestas al instante (algunas con sus datos
 * reales, como por qué todavía no puede cobrar) y «hablar con una persona» abre un ticket.
 * Sin IA por ahora (espera el tope de gasto); el lugar ya está listo para ella.
 */
export function AyudaBurbuja({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [abierta, setAbierta] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [respuesta, setRespuesta] = useState<{ pregunta: string; r: Respuesta } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [persona, setPersona] = useState(false);

  async function contestar(p: Pregunta) {
    setCargando(true);
    setPersona(false);
    try {
      setRespuesta({ pregunta: enIdioma(p.pregunta, idioma), r: await p.responder(idioma) });
    } catch {
      setRespuesta({ pregunta: enIdioma(p.pregunta, idioma), r: { texto: t.sinCoincidencia } });
    } finally {
      setCargando(false);
    }
  }
  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const q = busqueda.toLowerCase();
    const p = PREGUNTAS.find((x) => x.claves.some((k) => q.includes(k)));
    if (p) void contestar(p);
    else setRespuesta({ pregunta: busqueda, r: { texto: t.sinCoincidencia } });
    // Cada pregunta empieza limpia: si no, la siguiente se mezclaba con la anterior.
    setBusqueda('');
  }

  return (
    <div className="burbuja">
      {abierta && (
        <div className="burbuja-panel" role="dialog" aria-label={t.titulo}>
          <div className="burbuja-cabeza">
            <strong>{t.titulo}</strong>
            <button type="button" onClick={() => setAbierta(false)} aria-label={t.cerrar}>
              ×
            </button>
          </div>
          <div className="burbuja-cuerpo">
            {respuesta ? (
              <div className="burbuja-respuesta" role="status">
                <p className="burbuja-pregunta">{respuesta.pregunta}</p>
                <p>{respuesta.r.texto}</p>
                {respuesta.r.enlace && (
                  <Enlace a={respuesta.r.enlace[0]}>{respuesta.r.enlace[1]}</Enlace>
                )}
                <button type="button" className="enlace" onClick={() => setRespuesta(null)}>
                  {t.otra}
                </button>
              </div>
            ) : cargando ? (
              <p role="status">{t.cargando}</p>
            ) : (
              <ul className="burbuja-preguntas">
                {PREGUNTAS.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => void contestar(p)}>
                      {enIdioma(p.pregunta, idioma)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {/* El buscador es una consulta, no un formulario: no hace falta guardar lo escrito. */}
            <div className="burbuja-buscar" role="search">
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') buscar(e);
                }}
                placeholder={t.buscar}
                aria-label={t.buscar}
              />
            </div>
            {persona ? (
              <ReportarPanel idioma={idioma} alCerrar={() => setPersona(false)} />
            ) : (
              <button
                type="button"
                className="boton secundario ancho"
                onClick={() => setPersona(true)}
              >
                {t.persona}
              </button>
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        className="burbuja-boton"
        onClick={() => setAbierta((x) => !x)}
        aria-expanded={abierta}
      >
        {t.abrir}
      </button>
    </div>
  );
}
