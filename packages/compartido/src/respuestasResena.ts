/**
 * C-RESENAS-SUGERIDAS (29 oct 2026), como las respuestas rápidas de Uber Eats Manager: textos
 * listos según las estrellas, que el restaurante toca, edita si quiere y publica. Con el primer
 * nombre del cliente; nunca prometen dinero ni regalos (eso lo decide el restaurante).
 */
export function respuestasSugeridas(estrellas: number, cliente: string, idioma: 'es' | 'en') {
  const nombre = cliente.trim().split(/\s+/)[0] ?? '';
  const n = nombre ? (idioma === 'en' ? `, ${nombre}` : `, ${nombre}`) : '';
  if (estrellas >= 4)
    return idioma === 'en'
      ? [
          `Thank you for your order${n}! We’re glad you enjoyed it. See you soon.`,
          `Thanks for the great review${n}. Our team will love hearing this.`,
        ]
      : [
          `¡Gracias por tu pedido${n}! Nos alegra que te gustara. Te esperamos pronto.`,
          `Gracias por tu reseña${n}. A todo el equipo le va a encantar leerla.`,
        ];
  return idioma === 'en'
    ? [
        `We’re sorry your order wasn’t what you expected${n}. Thanks for telling us: we’re reviewing it with the kitchen.`,
        `Thank you for the honest feedback${n}. We want to make it right next time.`,
      ]
    : [
        `Lamentamos que tu pedido no fuera lo que esperabas${n}. Gracias por decírnoslo: ya lo estamos revisando con la cocina.`,
        `Gracias por tu opinión sincera${n}. Queremos que la próxima vez salga perfecto.`,
      ];
}
