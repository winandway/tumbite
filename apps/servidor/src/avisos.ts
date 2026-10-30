import { correosEquipo } from './avisosEquipo';
import { PAGINAS, enIdiomaDireccion, formatearMonto, textoLinea } from '@tumbite/compartido';
import { enviarCorreo } from './correo';
import type { Env } from './env';

/**
 * Los correos que el sitio manda solo: recibo del pedido, aviso al restaurante, restaurante nuevo
 * al administrador, bienvenida a la lista de espera y confirmar el correo. Todos bilingües.
 * Nunca frenan el flujo principal: si el correo falla, queda en el canario y el pedido sigue.
 */
type Idioma = 'es' | 'en';
type Linea = {
  nombreEs: string;
  nombreEn: string;
  precioCentavos: number;
  cantidad: number;
  opciones?: { id: string; nombreEs: string; nombreEn: string; precioCentavos: number }[];
  nota?: string;
};

function sitio(env: Env): string {
  return (env.SITIO_URL ?? 'https://divoox.com').replace(/\/$/, '');
}

function lineasTexto(lineas: Linea[], idioma: Idioma, moneda: string): string {
  return lineas
    .map(
      (l) =>
        // Con sus opciones y la nota del plato (C-NOTA-PLATO), como en la pantalla.
        `${l.cantidad} × ${textoLinea(l, idioma)} — ${formatearMonto(l.precioCentavos * l.cantidad, moneda, idioma)}`,
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
  const admins = await correosEquipo(env, 'verificaciones');
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
    responderA: 'go@windoce.com',
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
    responderA: 'go@windoce.com',
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

/** Divoox Moto · M6: alguien tocó el botón de emergencia en un viaje. Va a todo el equipo. */
export async function avisoEmergenciaViaje(
  env: Env,
  p: { operacionId: string; rol: 'pasajero' | 'conductor'; nombre: string; donde: string },
) {
  const admins = await correosEquipo(env, 'sistema');
  const quien = p.rol === 'pasajero' ? 'el pasajero' : 'el conductor';
  const texto = `EMERGENCIA en un viaje: ${quien} (${p.nombre}) tocó el botón de emergencia.\n\nViaje: ${p.operacionId}\nUbicación: ${p.donde}\n\nComunícate de inmediato y revisa el viaje en el panel:\n\n${sitio(env)}/panel`;
  for (const para of admins)
    await enviarCorreo(env, {
      de: 'avisos',
      para,
      asunto: `EMERGENCIA en un viaje de Moto (${quien})`,
      texto,
    });
}

/** Días que vale el enlace de la foto de una entrega (C-CORREO-ENTREGA). */
export const DIAS_FOTO_ENTREGA = 7;

/**
 * C-CORREO-ENTREGA (como DoorDash): al entregar, correo al cliente con la foto de la entrega. La
 * foto es privada: va con un enlace propio de esa entrega, imposible de adivinar, que vence a los
 * 7 días. Si fue en mano (sin foto), el correo sale igual, sin imagen.
 */
export async function correoDeEntrega(env: Env, db: D1Database, pedidoId: string) {
  const f = await db
    .prepare(
      `SELECT c.correo, c.nombre, c.idioma, r.nombre AS restaurante, p.direccion,
        (SELECT e.clave FROM evidencias e WHERE e.pedido_id = p.id AND e.tipo = 'entrega' AND e.clave <> '') AS foto
       FROM pedidos p JOIN usuarios c ON c.id = p.cliente_id JOIN restaurantes r ON r.id = p.restaurante_id
       WHERE p.id = ? AND p.estado = 'entregado'`,
    )
    .bind(pedidoId)
    .first<{
      correo: string;
      nombre: string;
      idioma: string;
      restaurante: string;
      direccion: string;
      foto: string | null;
    }>();
  if (!f) return null;
  const d: Idioma = f.idioma === 'en' ? 'en' : 'es';
  let imagen: { url: string; alt: string } | undefined;
  if (f.foto) {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const token = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    await db
      .prepare('INSERT INTO fotos_entrega_publicas (token, pedido_id) VALUES (?, ?)')
      .bind(token, pedidoId)
      .run();
    imagen = {
      url: `${sitio(env)}/datos/entregas/foto/${token}`,
      alt: d === 'en' ? 'Photo of your delivery' : 'Foto de tu entrega',
    };
  }
  const corto = pedidoId.slice(0, 8).toUpperCase();
  const asunto =
    d === 'en' ? `Your Divoox order #${corto} was delivered` : `Tu pedido #${corto} fue entregado`;
  const nombre = f.nombre.split(' ')[0];
  const texto =
    d === 'en'
      ? `Hi ${nombre}, your order from ${f.restaurante} was delivered to ${f.direccion}.${imagen ? ' Here’s the photo your driver took:' : ''}\n\nRate your food and your driver, or let us know if something went wrong:\n\n${sitio(env)}/app/order/${pedidoId}`
      : `Hola, ${nombre}. Tu pedido de ${f.restaurante} fue entregado en ${f.direccion}.${imagen ? ' Esta es la foto que tomó tu repartidor:' : ''}\n\nCalifica la comida y a tu repartidor, o avísanos si algo salió mal:\n\n${sitio(env)}/app/order/${pedidoId}`;
  return enviarCorreo(env, {
    de: 'pedidos',
    para: f.correo,
    asunto,
    texto,
    idioma: d,
    ...(imagen ? { imagen } : {}),
  });
}
