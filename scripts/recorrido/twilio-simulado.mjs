// Twilio y Checkr simulados para el recorrido: responden con un «sid»/«id» como los de verdad.
// Solo existe en esta computadora o en la revisión automática: el servidor le habla únicamente si
// TWILIO_API_URL apunta a localhost (en producción esa variable se ignora).
/* eslint-disable security/detect-non-literal-fs-filename -- TWILIO_LOG: archivo local que elige quien lo corre */
import { appendFileSync } from 'node:fs';
import { createServer } from 'node:http';
const puerto = Number(process.env.PUERTO_TWILIO ?? 12112);
let n = 0;
createServer((req, res) => {
  let cuerpo = '';
  req.on('data', (d) => (cuerpo += d));
  req.on('end', () => {
    n++;
    // Con TWILIO_LOG, anota cada mensaje (los guiones de capturas leen ahí el código por SMS).
    if (process.env.TWILIO_LOG)
      appendFileSync(process.env.TWILIO_LOG, `${decodeURIComponent(cuerpo.replace(/\+/g, ' '))}\n`);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        sid: `SIM${n}`,
        id: `sim_${n}`,
        status: 'queued',
        invitation_url: 'http://localhost/checkr/invitacion-simulada',
        cuerpo,
      }),
    );
  });
}).listen(puerto, () => console.log(`Twilio simulado en ${puerto}`));
