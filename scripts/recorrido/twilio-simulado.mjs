// Twilio simulado para el recorrido: responde a mensajes y llamadas con un «sid» como Twilio.
// Solo existe en esta computadora o en la revisión automática: el servidor le habla únicamente si
// TWILIO_API_URL apunta a localhost (en producción esa variable se ignora).
import { createServer } from 'node:http';
const puerto = Number(process.env.PUERTO_TWILIO ?? 12112);
let n = 0;
createServer((req, res) => {
  let cuerpo = '';
  req.on('data', (d) => (cuerpo += d));
  req.on('end', () => {
    n++;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ sid: `SIM${n}`, status: 'queued', cuerpo }));
  });
}).listen(puerto, () => console.log(`Twilio simulado en ${puerto}`));
