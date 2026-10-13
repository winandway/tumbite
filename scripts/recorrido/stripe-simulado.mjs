// Stripe simulado para el recorrido completo en el navegador. Solo existe en esta computadora o
// en la revisión automática de GitHub: el servidor le habla únicamente si STRIPE_API_URL apunta a
// localhost (en producción esa variable se ignora y se habla con Stripe de verdad).
// Responde a todo con un objeto «exitoso»: intento de pago, devolución, cuenta conectada.
import { createServer } from 'node:http';

const puerto = Number(process.env.PUERTO_STRIPE ?? 12111);
let n = 0;
createServer((req, res) => {
  let cuerpo = '';
  req.on('data', (d) => (cuerpo += d));
  req.on('end', () => {
    n++;
    const id = `sim_${n}`;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        id,
        object: 'simulado',
        client_secret: `${id}_secret_simulado`,
        url: 'http://localhost/wallet/ready',
        data: [],
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        status: 'succeeded',
      }),
    );
  });
}).listen(puerto, () => console.log(`Stripe simulado en ${puerto}`));
