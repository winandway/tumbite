#!/usr/bin/env node
// Opciones de color del mapa de Google de Divoox (14 nov 2026, pedido de Richard: «más remarcado,
// que se vea en el celular de día y de noche») — todos los países. Dibuja el MISMO lugar (Novi) con
// cada paleta, sobre el mapa de Google real, y guarda las capturas para elegir. La llave del
// navegador solo sirve en los dominios de Divoox: la página se sirve dentro del sitio de pruebas
// (interceptada, no se publica nada). Cada mapa dibujado gasta una carga de la cuota diaria.
// Uso: node scripts/marca/opciones-mapa.mjs
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';

const LLAVE = readFileSync(`${homedir()}/.config/tumbite/google-maps-web-key`, 'utf8').trim();
const CARPETA = 'docs/capturas/mapa-google/opciones';
mkdirSync(CARPETA, { recursive: true });

/** Un estilo completo a partir de una paleta: mismas reglas para todas, solo cambian los colores. */
export const estiloDe = (p) => [
  { elementType: 'geometry', stylers: [{ color: p.tierra }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: p.texto }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: p.bordeTexto }, { weight: 3 }] },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: p.bordeCalle }],
  },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: p.textoFuerte }],
  },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ visibility: 'on' }, { color: p.parque }],
  },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: p.calle }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: p.bordeCalle }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: p.texto }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: p.avenida }] },
  {
    featureType: 'road.arterial',
    elementType: 'geometry.stroke',
    stylers: [{ color: p.bordeAvenida }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'labels.text.fill',
    stylers: [{ color: p.textoFuerte }],
  },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: p.autopista }] },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: p.bordeAutopista }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: p.textoFuerte }],
  },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: p.agua }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: p.textoAgua }] },
];

export const OPCIONES = {
  '1-dia-marcado': {
    nombre: 'Opción 1 · Día marcado',
    tierra: '#DCE0E5',
    calle: '#FFFFFF',
    bordeCalle: '#7E8896',
    avenida: '#FFFFFF',
    bordeAvenida: '#4D5562',
    autopista: '#F6C76B',
    bordeAutopista: '#5F6875',
    agua: '#86C2E8',
    parque: '#B4DFAE',
    texto: '#3A3F47',
    textoFuerte: '#101010',
    bordeTexto: '#FFFFFF',
    textoAgua: '#1F5E86',
  },
  '2-noche-divoox': {
    nombre: 'Noche · oscuro con azul',
    tierra: '#1C1F24',
    calle: '#4A515C',
    bordeCalle: '#15171B',
    avenida: '#737C8A',
    bordeAvenida: '#15171B',
    autopista: '#5FB4E5',
    bordeAutopista: '#15171B',
    agua: '#0E3F5C',
    parque: '#1F4030',
    texto: '#C4C9D1',
    textoFuerte: '#FFFFFF',
    bordeTexto: '#101010',
    textoAgua: '#7FC4EA',
  },
  '3-azul-logistica': {
    nombre: 'Día · azul Divoox',
    tierra: '#CBDDE8',
    calle: '#FFFFFF',
    bordeCalle: '#5E8CA6',
    avenida: '#FFFFFF',
    bordeAvenida: '#1F4D69',
    autopista: '#1F4D69',
    bordeAutopista: '#1F4D69',
    agua: '#4FB3D9',
    parque: '#A9DCC0',
    texto: '#1F4D69',
    textoFuerte: '#0C2A3B',
    bordeTexto: '#FFFFFF',
    textoAgua: '#0C4A66',
  },
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const actual = JSON.parse(
    readFileSync('identidad-divoox/mapa-google-estilo-divoox.json', 'utf8'),
  );
  const estilos = new Map([['0-actual', { nombre: 'Como está hoy', estilo: actual }]]);
  for (const [k, p] of Object.entries(OPCIONES)) {
    estilos.set(k, { nombre: p.nombre, estilo: estiloDe(p) });
    writeFileSync(
      `identidad-divoox/opciones-mapa/${k}.json`,
      JSON.stringify(estiloDe(p), null, 2) + '\n',
    );
  }
  const html = ({ nombre, estilo }, zoom) => `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;font-family:Poppins,Arial,sans-serif}#t{font:700 20px Arial;padding:12px 16px;background:#101010;color:#fff}#m{width:390px;height:640px}</style>
<div id="t">${nombre}</div><div id="m"></div>
<script>
function ini(){
  const m=new google.maps.Map(document.getElementById('m'),{center:{lat:42.5195,lng:-83.4690},zoom:${zoom},disableDefaultUI:true,styles:${JSON.stringify(estilo)}});
  const punto=(p,color,r)=>new google.maps.Marker({map:m,position:p,icon:{path:google.maps.SymbolPath.CIRCLE,scale:r,fillColor:color,fillOpacity:1,strokeColor:'#fff',strokeWeight:3}});
  punto({lat:42.5222,lng:-83.4712},'#101010',9);punto({lat:42.5172,lng:-83.4676},'#F20D20',8);punto({lat:42.5198,lng:-83.4712},'#F20D20',12);
  google.maps.event.addListenerOnce(m,'tilesloaded',()=>setTimeout(()=>document.body.dataset.listo='1',1500));
}
</script><script src="https://maps.googleapis.com/maps/api/js?key=${LLAVE}&callback=ini&language=es" async></script>`;
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 390, height: 688 }, deviceScaleFactor: 2 });
  for (const [clave, uno] of estilos)
    for (const [vista, zoom] of [
      ['calles', 16],
      ['ciudad', 12],
    ]) {
      const pag = await ctx.newPage();
      await pag.route('**/__opciones-mapa', (r) =>
        r.fulfill({ contentType: 'text/html', body: html(uno, zoom) }),
      );
      await pag.goto('https://staging.tumbite.com/__opciones-mapa');
      await pag.waitForSelector('body[data-listo]', { timeout: 30000 });
      await pag.screenshot({ path: `${CARPETA}/${clave}-${vista}.png` });
      console.log(`captura ${clave}-${vista}`);
      await pag.close();
    }
  await nav.close();
}
