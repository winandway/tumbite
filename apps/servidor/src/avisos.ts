import { PAGINAS, enIdiomaDireccion, formatearMonto } from '@tumbite/compartido';
import { enviarCorreo } from './correo';
import type { Env } from './env';

/**
 * Los correos que el sitio manda solo: recibo del pedido, aviso al restaurante, restaurante nuevo
 * al administrador, bienvenida a la lista de espera y confirmar el correo. Todos bilingües.
 * Nunca frenan el flujo principal: si el correo falla, queda en el canario y el pedido sigue.
 */
type Idioma = 'es' | 'en';
type Linea = { nombreEs: string; nombreEn: string; precioCentavos: number; cantidad: number };

function sitio(env: Env): string {
  return (env.SITIO_URL ?? 'https://tumbite.com').replace(/\/$/, '');
}

function lineasTexto(lineas: Linea[], idioma: Idioma, moneda: string): string {
  return lineas
    .map(
      (l) =>
        `${l.cantidad} × ${idioma === 'en' ? l.nombreEn || l.nombreEs : l.nombreEs} — ${formatearMonto(l.precioCentavos * l.cantidad, moneda, idioma)}`,
    )
    .join('\n');
}

export async function reciboDePedido(
  env: Env,
  p: {
    correo: string;
    nombre: string;
    idioma: Idioma;
    pedidoId: string;
    restaurante: string;
    lineas: Linea[];
    subtotal: number;
    envio: number;
    servicio: number;
    /** Impuesto de ventas recaudado (0 = no se muestra). */
    impuesto?: number;
    propina: number;
    regalo: number;
    total: number;
    direccion: string;
    /** C-MONEDA-RECORRIDO: la moneda del pedido (sin ella, dólares como siempre). */
    moneda?: string;
  },
) {
  const corto = p.pedidoId.slice(0, 8).toUpperCase();
  const d = p.idioma;
  const m = p.moneda ?? 'USD';
  const fm = (x: number) => formatearMonto(x, m, d);
  const asunto =
    d === 'en'
      ? `Your Divoox order #${corto} is confirmed`
      : `Tu pedido #${corto} en Divoox quedó confirmado`;
  const texto =
    d === 'en'
      ? `Hi ${p.nombre},\n\nWe got your payment and ${p.restaurante} is on it.\n\n${lineasTexto(p.lineas, d, m)}\n\nSubtotal: ${fm(p.subtotal)}\nDelivery: ${fm(p.envio)}\nService: ${fm(p.servicio)}${p.impuesto ? `\nTax: ${fm(p.impuesto)}` : ''}\nTip: ${fm(p.propina)}${p.regalo ? `\nGift: −${fm(p.regalo)}` : ''}\nTotal: ${fm(p.total)}\n\nDelivering to: ${p.direccion}\n\nFollow it live in the app:\n\n${sitio(env)}/app/order/${p.pedidoId}`
      : `Hola, ${p.nombre}.\n\nRecibimos tu pago y ${p.restaurante} ya está con tu pedido.\n\n${lineasTexto(p.lineas, d, m)}\n\nComida: ${fm(p.subtotal)}\nEnvío: ${fm(p.envio)}\nServicio: ${fm(p.servicio)}${p.impuesto ? `\nImpuesto: ${fm(p.impuesto)}` : ''}\nPropina: ${fm(p.propina)}${p.regalo ? `\nRegalo: −${fm(p.regalo)}` : ''}\nTotal: ${fm(p.total)}\n\nLo llevamos a: ${p.direccion}\n\nSíguelo en vivo en la app:\n\n${sitio(env)}/app/order/${p.pedidoId}`;
  return enviarCorreo(env, { de: 'pedidos', para: p.correo, asunto, texto });
}

export async function avisoPedidoAlRestaurante(
  env: Env,
  p: {
    correo: string;
    idioma: Idioma;
    pedidoId: string;
    restaurante: string;
    lineas: Linea[];
    pagoRestaurante: number;
    notas: string;
    /** C-MONEDA-RECORRIDO: la moneda del pedido (sin ella, dólares como siempre). */
    moneda?: string;
  },
) {
  const corto = p.pedidoId.slice(0, 8).toUpperCase();
  const d = p.idioma;
  const m = p.moneda ?? 'USD';
  const fm = (x: number) => formatearMonto(x, m, d);
  const asunto = d === 'en' ? `New paid order #${corto}` : `Pedido nuevo pagado #${corto}`;
  const texto =
    d === 'en'
      ? `${p.restaurante}: a new order just came in and it's already paid.\n\n${lineasTexto(p.lineas, d, m)}${p.notas ? `\n\nCustomer notes: ${p.notas}` : ''}\n\nYou'll receive ${fm(p.pagoRestaurante)} for this order.\n\nAccept it in your panel (the alarm rings there until someone accepts):\n\n${sitio(env)}/panel/orders`
      : `${p.restaurante}: acaba de entrar un pedido nuevo y ya está pagado.\n\n${lineasTexto(p.lineas, d, m)}${p.notas ? `\n\nNotas del cliente: ${p.notas}` : ''}\n\nPor este pedido recibes ${fm(p.pagoRestaurante)}.\n\nAcéptalo en tu panel (la alarma suena ahí hasta que alguien lo acepte):\n\n${sitio(env)}/panel/orders`;
  return enviarCorreo(env, { de: 'pedidos', para: p.correo, asunto, texto });
}

export async function avisoRestauranteNuevoAlAdmin(
  env: Env,
  p: {
    restaurante: string;
    dueno: string;
    correoDueno: string;
    direccion: string;
    categoria: string;
  },
) {
  const admins = (env.ADMIN_CORREOS ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const texto = `Un restaurante nuevo pidió entrar a Divoox y espera aprobación.\n\nRestaurante: ${p.restaurante}\nTipo: ${p.categoria || '—'}\nDirección: ${p.direccion}\nDueño: ${p.dueno} (${p.correoDueno})\n\nRevísalo y apruébalo en el panel de administración:\n\n${sitio(env)}/panel/restaurants`;
  for (const para of admins)
    await enviarCorreo(env, {
      de: 'avisos',
      para,
      asunto: `Restaurante nuevo: ${p.restaurante}`,
      texto,
      responderA: p.correoDueno,
    });
}

/** Al dueño, cuando el equipo aprueba, pausa o rechaza su restaurante (F14). */
export async function correoEstadoRestaurante(
  env: Env,
  p: {
    correo: string;
    nombre: string;
    idioma: Idioma;
    restaurante: string;
    estado: 'aprobado' | 'pausado' | 'rechazado' | 'pendiente';
    motivo?: string;
  },
) {
  const en = p.idioma === 'en';
  const motivo = p.motivo?.trim();
  const porque = motivo ? (en ? `\n\nReason: ${motivo}` : `\n\nMotivo: ${motivo}`) : '';
  const panel = `${sitio(env)}/panel`;
  const textos = {
    aprobado: en
      ? [
          `${p.restaurante} is approved on Divoox`,
          `Hi ${p.nombre},\n\n${p.restaurante} is approved. Open your panel, finish the activation list and tap “Open” to start taking orders:\n\n${panel}`,
        ]
      : [
          `${p.restaurante} quedó aprobado en Divoox`,
          `Hola, ${p.nombre}.\n\n${p.restaurante} quedó aprobado. Entra a tu panel, completa la lista de activación y toca «Abrir» para empezar a recibir pedidos:\n\n${panel}`,
        ],
    pausado: en
      ? [
          `${p.restaurante} was paused on Divoox`,
          `Hi ${p.nombre},\n\n${p.restaurante} was paused by our team and isn't taking orders for now.${porque}\n\nReply to this email if you have questions.`,
        ]
      : [
          `${p.restaurante} quedó en pausa en Divoox`,
          `Hola, ${p.nombre}.\n\nNuestro equipo puso ${p.restaurante} en pausa y por ahora no recibe pedidos.${porque}\n\nResponde este correo si tienes dudas.`,
        ],
    rechazado: en
      ? [
          `About ${p.restaurante} on Divoox`,
          `Hi ${p.nombre},\n\nWe couldn't approve ${p.restaurante} for now.${porque}\n\nReply to this email if you'd like to review it with us.`,
        ]
      : [
          `Sobre ${p.restaurante} en Divoox`,
          `Hola, ${p.nombre}.\n\nPor ahora no pudimos aprobar ${p.restaurante}.${porque}\n\nResponde este correo si quieres revisarlo con nosotros.`,
        ],
    pendiente: en
      ? [
          `${p.restaurante} is under review again`,
          `Hi ${p.nombre},\n\n${p.restaurante} went back to review.${porque}`,
        ]
      : [
          `${p.restaurante} vuelve a revisión`,
          `Hola, ${p.nombre}.\n\n${p.restaurante} volvió a revisión.${porque}`,
        ],
  }[p.estado];
  return enviarCorreo(env, {
    de: 'avisos',
    para: p.correo,
    asunto: textos[0]!,
    texto: textos[1]!,
    responderA: 'support@tumbite.com',
  });
}

export async function bienvenidaListaEspera(
  env: Env,
  p: {
    correo: string;
    nombre: string;
    idioma: Idioma;
    tipo: 'comensal' | 'restaurante' | 'repartidor';
    ciudad: string;
  },
) {
  const d = p.idioma;
  const que =
    d === 'en'
      ? {
          comensal: 'order food',
          restaurante: 'bring your restaurant on board',
          repartidor: 'start delivering',
        }[p.tipo]
      : {
          comensal: 'pedir comida',
          restaurante: 'traer tu restaurante',
          repartidor: 'empezar a repartir',
        }[p.tipo];
  const asunto =
    d === 'en' ? `You're on the list, ${p.nombre}` : `Ya estás en la lista, ${p.nombre}`;
  const texto =
    d === 'en'
      ? `Hi ${p.nombre},\n\nYou're signed up to ${que} with Divoox in ${p.ciudad}. We'll email you first the moment we open in your area.\n\nThanks for being early.`
      : `Hola, ${p.nombre}.\n\nQuedaste anotado para ${que} con Divoox en ${p.ciudad}. Te avisamos primero, por este correo, en cuanto abramos en tu zona.\n\nGracias por llegar temprano.`;
  return enviarCorreo(env, {
    de: 'hola',
    para: p.correo,
    asunto,
    texto,
    responderA: 'support@tumbite.com',
  });
}

export async function correoDeConfirmacion(
  env: Env,
  p: { correo: string; nombre: string; idioma: Idioma; token: string },
) {
  const d = p.idioma;
  const enlace = `${sitio(env)}${enIdiomaDireccion(PAGINAS.confirmEmail, d)}?token=${p.token}`;
  const asunto = d === 'en' ? 'Confirm your Divoox email' : 'Confirma tu correo de Divoox';
  const texto =
    d === 'en'
      ? `Hi ${p.nombre},\n\nWelcome to Divoox. Tap the link to confirm this email is yours (it expires in 2 days):\n\n${enlace}\n\nIf you didn't create an account, you can ignore this.`
      : `Hola, ${p.nombre}.\n\nBienvenido a Divoox. Toca el enlace para confirmar que este correo es tuyo (vence en 2 días):\n\n${enlace}\n\nSi no creaste una cuenta, ignora este correo.`;
  return enviarCorreo(env, { de: 'avisos', para: p.correo, asunto, texto });
}
