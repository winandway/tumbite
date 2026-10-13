import { PAGINAS, enIdiomaDireccion, formatearDolares } from '@tumbite/compartido';
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

function lineasTexto(lineas: Linea[], idioma: Idioma): string {
  return lineas
    .map(
      (l) =>
        `${l.cantidad} × ${idioma === 'en' ? l.nombreEn || l.nombreEs : l.nombreEs} — ${formatearDolares(l.precioCentavos * l.cantidad, idioma)}`,
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
    propina: number;
    regalo: number;
    total: number;
    direccion: string;
  },
) {
  const corto = p.pedidoId.slice(0, 8).toUpperCase();
  const d = p.idioma;
  const asunto =
    d === 'en'
      ? `Your Tumbite order #${corto} is confirmed`
      : `Tu pedido #${corto} en Tumbite quedó confirmado`;
  const texto =
    d === 'en'
      ? `Hi ${p.nombre},\n\nWe got your payment and ${p.restaurante} is on it.\n\n${lineasTexto(p.lineas, d)}\n\nSubtotal: ${formatearDolares(p.subtotal, d)}\nDelivery: ${formatearDolares(p.envio, d)}\nService: ${formatearDolares(p.servicio, d)}\nTip: ${formatearDolares(p.propina, d)}${p.regalo ? `\nGift: −${formatearDolares(p.regalo, d)}` : ''}\nTotal: ${formatearDolares(p.total, d)}\n\nDelivering to: ${p.direccion}\n\nFollow it live in the app:\n\n${sitio(env)}/app/order/${p.pedidoId}`
      : `Hola, ${p.nombre}.\n\nRecibimos tu pago y ${p.restaurante} ya está con tu pedido.\n\n${lineasTexto(p.lineas, d)}\n\nComida: ${formatearDolares(p.subtotal, d)}\nEnvío: ${formatearDolares(p.envio, d)}\nServicio: ${formatearDolares(p.servicio, d)}\nPropina: ${formatearDolares(p.propina, d)}${p.regalo ? `\nRegalo: −${formatearDolares(p.regalo, d)}` : ''}\nTotal: ${formatearDolares(p.total, d)}\n\nLo llevamos a: ${p.direccion}\n\nSíguelo en vivo en la app:\n\n${sitio(env)}/app/order/${p.pedidoId}`;
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
  },
) {
  const corto = p.pedidoId.slice(0, 8).toUpperCase();
  const d = p.idioma;
  const asunto = d === 'en' ? `New paid order #${corto}` : `Pedido nuevo pagado #${corto}`;
  const texto =
    d === 'en'
      ? `${p.restaurante}: a new order just came in and it's already paid.\n\n${lineasTexto(p.lineas, d)}${p.notas ? `\n\nCustomer notes: ${p.notas}` : ''}\n\nYou'll receive ${formatearDolares(p.pagoRestaurante, d)} for this order.\n\nAccept it in your panel (the alarm rings there until someone accepts):\n\n${sitio(env)}/panel/orders`
      : `${p.restaurante}: acaba de entrar un pedido nuevo y ya está pagado.\n\n${lineasTexto(p.lineas, d)}${p.notas ? `\n\nNotas del cliente: ${p.notas}` : ''}\n\nPor este pedido recibes ${formatearDolares(p.pagoRestaurante, d)}.\n\nAcéptalo en tu panel (la alarma suena ahí hasta que alguien lo acepte):\n\n${sitio(env)}/panel/orders`;
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
  const texto = `Un restaurante nuevo pidió entrar a Tumbite y espera aprobación.\n\nRestaurante: ${p.restaurante}\nTipo: ${p.categoria || '—'}\nDirección: ${p.direccion}\nDueño: ${p.dueno} (${p.correoDueno})\n\nRevísalo y apruébalo en el panel de administración:\n\n${sitio(env)}/panel/restaurants`;
  for (const para of admins)
    await enviarCorreo(env, {
      de: 'avisos',
      para,
      asunto: `Restaurante nuevo: ${p.restaurante}`,
      texto,
      responderA: p.correoDueno,
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
      ? `Hi ${p.nombre},\n\nYou're signed up to ${que} with Tumbite in ${p.ciudad}. We'll email you first the moment we open in your area.\n\nThanks for being early.`
      : `Hola, ${p.nombre}.\n\nQuedaste anotado para ${que} con Tumbite en ${p.ciudad}. Te avisamos primero, por este correo, en cuanto abramos en tu zona.\n\nGracias por llegar temprano.`;
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
  const asunto = d === 'en' ? 'Confirm your Tumbite email' : 'Confirma tu correo de Tumbite';
  const texto =
    d === 'en'
      ? `Hi ${p.nombre},\n\nWelcome to Tumbite. Tap the link to confirm this email is yours (it expires in 2 days):\n\n${enlace}\n\nIf you didn't create an account, you can ignore this.`
      : `Hola, ${p.nombre}.\n\nBienvenido a Tumbite. Toca el enlace para confirmar que este correo es tuyo (vence en 2 días):\n\n${enlace}\n\nSi no creaste una cuenta, ignora este correo.`;
  return enviarCorreo(env, { de: 'avisos', para: p.correo, asunto, texto });
}
