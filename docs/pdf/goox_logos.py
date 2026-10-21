"""Treinta logos nuevos de Goox Driver (íconos SVG propios, 64x64, sin degradados ni copias de marcas)."""


def wm(fuente, peso, color, sec, tam=30, estilo='normal', texto='Goox', esp=0):
    return (f'<span style="font-family:\'{fuente}\';font-weight:{peso};font-style:{estilo};color:{color};'
            f'font-size:{tam}pt;letter-spacing:{esp}px;line-height:1">{texto}</span>'
            f'<span style="font-family:Poppins;font-weight:600;color:{sec};font-size:8pt;letter-spacing:3px;'
            f'text-transform:uppercase;margin-top:1.2mm">driver</span>')


# (grupo, nombre, idea, fondo, ícono, marca)
LOGOS = [
    # ── La X ──
    ('x', 'Cruce de avenidas', 'Dos avenidas que se cruzan, con su línea central: cada pedido es un punto de encuentro.', '#ffffff',
     '<rect width="64" height="64" rx="16" fill="#0b1f3a"/><path d="M15 15 49 49M49 15 15 49" stroke="#fff" stroke-width="11" stroke-linecap="round"/><path d="M15 15 49 49M49 15 15 49" stroke="#0b1f3a" stroke-width="1.8" stroke-dasharray="3.5 4"/><circle cx="49" cy="15" r="5.5" fill="#b8f400"/>',
     wm('Poppins', 800, '#0b1f3a', '#6b8f00')),
    ('x', 'Equis que avanza', 'Un brazo de la X termina en flecha: siempre hacia adelante.', '#fff6f0',
     '<rect width="64" height="64" rx="18" fill="#ff5a1f"/><path d="M18 46 46 18M18 18l10 10M36 36l10 10" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M33 17h13v13" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
     wm('Space Grotesk', 700, '#2a0f05', '#ff5a1f')),
    ('x', 'Cuatro direcciones', 'Cuatro piezas que se encuentran en el centro: norte, sur, este y oeste.', '#effaf6',
     '<circle cx="32" cy="32" r="30" fill="#00a67e"/><g fill="#fff"><path d="M17 13l11 11-4 4-11-11z" transform="translate(0 0)"/><path d="M47 13 36 24l4 4 11-11z"/><path d="M17 51l11-11-4-4-11 11z"/><path d="M47 51 36 40l4-4 11 11z"/></g><circle cx="32" cy="32" r="4.5" fill="#ffd84d"/>',
     wm('Outfit', 800, '#03382a', '#00a67e')),
    ('x', 'Equis calada', 'La X nace del espacio vacío entre cuatro bloques: limpia y muy reconocible.', '#ffffff',
     '<g fill="#111"><path d="M6 10a4 4 0 0 1 4-4h14l8 8-18 18-8-8z"/><path d="M58 10a4 4 0 0 0-4-4H40l-8 8 18 18 8-8z"/><path d="M6 54a4 4 0 0 0 4 4h14l8-8-18-18-8 8z"/><path d="M58 54a4 4 0 0 1-4 4H40l-8-8 18-18 8 8z"/></g><circle cx="32" cy="32" r="4" fill="#ff2d55"/>',
     wm('Archivo Black', 400, '#111', '#ff2d55')),
    ('x', 'Cubiertos cruzados', 'Tenedor y cuchillo forman la X: la comida está en el centro.', '#fff3ee',
     '<rect width="64" height="64" rx="32" fill="#e63b2e"/><path d="M19 17l28 30" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M17 15v7l5 5M21 13v7M25 15v7l-3 3" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M46 15c-6 3-9 9-8 15l-19 18" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
     wm('Fredoka', 700, '#5a120b', '#e63b2e')),
    ('x', 'X marca el destino', 'El pin del mapa lleva una X por dentro: «aquí te lo llevamos».', '#eef3ff',
     '<path d="M32 4c-12 0-21 9-21 21 0 15 21 35 21 35s21-20 21-35C53 13 44 4 32 4z" fill="#1d4ed8"/><path d="M25 18l14 14M39 18 25 32" stroke="#fff" stroke-width="5" stroke-linecap="round"/>',
     wm('Sora', 700, '#0b1f5c', '#1d4ed8')),
    ('x', 'Encuentro', 'Dos flechas que se miran y se tocan: el repartidor y tú se encuentran.', '#fffbe6',
     '<rect width="64" height="64" rx="14" fill="#111"/><path d="M12 18l16 14-16 14" fill="none" stroke="#ffd000" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M52 18 36 32l16 14" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
     wm('Poppins', 800, '#111', '#b38f00')),
    ('x', 'Cinta entrelazada', 'Dos cintas que pasan una por encima de la otra: comida y viajes unidos.', '#f3fbe8',
     '<rect width="64" height="64" rx="16" fill="#ffffff" stroke="#e4e4e4"/><path d="M14 14 50 50" stroke="#111" stroke-width="10" stroke-linecap="round"/><path d="M50 14 14 50" stroke="#7bd11f" stroke-width="10" stroke-linecap="round"/><path d="M38.5 38.5 50 50" stroke="#111" stroke-width="10" stroke-linecap="round"/><path d="M33 31l7 7" stroke="#fff" stroke-width="3"/>',
     wm('Montserrat', 800, '#111', '#5a9e10')),
    # ── Las dos o ──
    ('o', 'Faros encendidos', 'Las dos «o» son los faros de un carro que viene hacia ti.', '#0f1115',
     '<rect width="64" height="64" rx="16" fill="#0f1115"/><circle cx="21" cy="32" r="9" fill="#ffe14d"/><circle cx="43" cy="32" r="9" fill="#ffe14d"/><path d="M30 25h4M30 39h4" stroke="#0f1115"/><path d="M8 26l5 2M8 38l5-2M56 26l-5 2M56 38l-5-2" stroke="#ffe14d" stroke-width="2.5" stroke-linecap="round"/>',
     wm('Poppins', 800, '#ffffff', '#ffe14d')),
    ('o', 'Miran hacia adelante', 'Dos ojos con la mirada a la derecha: la app siempre va un paso adelante.', '#fff4e5',
     '<rect width="64" height="64" rx="20" fill="#ff8a00"/><circle cx="22" cy="32" r="10" fill="#fff"/><circle cx="43" cy="32" r="10" fill="#fff"/><circle cx="26" cy="32" r="4.5" fill="#1a0e00"/><circle cx="47" cy="32" r="4.5" fill="#1a0e00"/>',
     wm('Baloo 2', 800, '#3a1d00', '#ff8a00')),
    ('o', 'De aquí hasta allá', 'Las dos «o» son el origen y el destino, unidos por el camino.', '#effcf4',
     '<rect width="64" height="64" rx="16" fill="#0a7b44"/><circle cx="16" cy="40" r="6" fill="none" stroke="#fff" stroke-width="3.5"/><path d="M48 14c-6 0-10 4-10 10 0 7 10 16 10 16s10-9 10-16c0-6-4-10-10-10z" fill="#fff"/><circle cx="48" cy="24" r="3.5" fill="#0a7b44"/><path d="M22 40c8 0 10-6 16-10" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="2.5 4" stroke-linecap="round"/>',
     wm('Outfit', 800, '#053a20', '#0a7b44')),
    ('o', 'Velocímetro', 'Una «o» se vuelve tablero: rapidez medida, no promesa.', '#ffffff',
     '<circle cx="32" cy="32" r="30" fill="#111"/><path d="M14 40a18 18 0 1 1 36 0" fill="none" stroke="#2a2a2a" stroke-width="6" stroke-linecap="round"/><path d="M14 40a18 18 0 0 1 30-13" fill="none" stroke="#00e0a4" stroke-width="6" stroke-linecap="round"/><path d="M32 40l12-15" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="40" r="4" fill="#fff"/>',
     wm('Space Grotesk', 700, '#111', '#00a37a')),
    ('o', 'Llanta G', 'Una rueda con un corte que dibuja la G de Goox.', '#f4f4f4',
     '<circle cx="32" cy="32" r="30" fill="#ffd400"/><path d="M47 22a18 18 0 1 0 3 14H34" fill="none" stroke="#111" stroke-width="8" stroke-linecap="round"/><circle cx="32" cy="32" r="5" fill="#111"/><path d="M32 22v4M24 34l3-2M40 34l-3-2" stroke="#111" stroke-width="2.5" stroke-linecap="round"/>',
     wm('Archivo Black', 400, '#111', '#8a7300')),
    ('o', 'Eclipse en marcha', 'Una «o» llena alcanza a la otra: movimiento sin perder la forma.', '#ffffff',
     '<rect width="64" height="64" rx="16" fill="#ff3b6b"/><circle cx="25" cy="32" r="13" fill="none" stroke="#fff" stroke-width="4"/><circle cx="39" cy="32" r="13" fill="#fff"/>',
     wm('Sora', 700, '#3a0613', '#ff3b6b')),
    ('o', 'Ya va en camino', 'Una burbuja de chat con dos puntos: «tu pedido viene en camino».', '#eef7ff',
     '<path d="M10 14h44a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H28l-10 9v-9h-8a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6z" fill="#0a84ff"/><circle cx="25" cy="30" r="5" fill="#fff"/><circle cx="39" cy="30" r="5" fill="#fff"/>',
     wm('Poppins', 800, '#06305c', '#0a84ff')),
    ('o', 'Asas de la bolsa', 'Las dos «o» son las asas de la bolsa de reparto.', '#fbf3e9',
     '<rect width="64" height="64" rx="14" fill="#1c1c1c"/><path d="M14 26h36l-3 26H17z" fill="#f2b33d"/><circle cx="25" cy="20" r="6" fill="none" stroke="#f2b33d" stroke-width="3.5"/><circle cx="39" cy="20" r="6" fill="none" stroke="#f2b33d" stroke-width="3.5"/><path d="M26 40h12" stroke="#1c1c1c" stroke-width="3" stroke-linecap="round"/>',
     wm('Montserrat', 800, '#1c1c1c', '#c48a17')),
    # ── La G ──
    ('g', 'G de carretera', 'La G dibujada como una vía, con su línea central.', '#ffffff',
     '<rect width="64" height="64" rx="16" fill="#2b2b2b"/><path d="M46 21a17 17 0 1 0 3 14H33" fill="none" stroke="#ffcc00" stroke-width="9" stroke-linecap="round"/><path d="M46 21a17 17 0 1 0 3 14H33" fill="none" stroke="#2b2b2b" stroke-width="1.6" stroke-dasharray="3 3.5"/>',
     wm('Barlow', 900, '#2b2b2b', '#b38f00', estilo='italic')),
    ('g', 'G con destino', 'El trazo de la G termina en un punto de entrega.', '#fff1ec',
     '<circle cx="32" cy="32" r="30" fill="#ff4d2e"/><path d="M45 23a15 15 0 1 0 2 12H34" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><circle cx="34" cy="35" r="5" fill="#ffd2c7"/>',
     wm('Outfit', 800, '#3a0d05', '#ff4d2e')),
    ('g', 'G geométrica', 'Tres piezas de círculo y un cuadrado: una G moderna, de taller de diseño.', '#ffffff',
     '<rect width="64" height="64" rx="12" fill="#f2f2ee"/><path d="M32 8a24 24 0 0 0 0 48V32z" fill="#111"/><path d="M32 8a24 24 0 0 1 24 24H32z" fill="#ff6b00"/><rect x="32" y="32" width="24" height="12" fill="#111"/><rect x="44" y="44" width="12" height="12" fill="#00b386"/>',
     wm('Archivo Black', 400, '#111', '#ff6b00')),
    ('g', 'G y X juntas', 'La G abraza a la X: las dos letras que hacen la marca.', '#eefbf6',
     '<rect width="64" height="64" rx="18" fill="#0f766e"/><path d="M47 20a18 18 0 1 0 3 16" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M33 27l12 12M45 27 33 39" stroke="#a7f3d0" stroke-width="5" stroke-linecap="round"/>',
     wm('Sora', 700, '#06332f', '#0f766e')),
    ('g', 'G de esquinas', 'Una G cuadrada con la esquina cortada en diagonal, como una señal de tránsito.', '#fffbe6',
     '<rect width="64" height="64" rx="10" fill="#111"/><path d="M48 16H16v32h32V32H34" fill="none" stroke="#ffd60a" stroke-width="7" stroke-linejoin="round"/><path d="M40 16l8 8" stroke="#111" stroke-width="7"/>',
     wm('Bebas Neue', 400, '#111', '#b39500', tam=36, esp=2)),
    # ── La palabra ──
    ('w', 'La X es flecha', 'En la palabra, la X apunta hacia arriba y a la derecha.', '#ffffff',
     '<rect width="64" height="64" rx="16" fill="#111"/><text x="9" y="44" font-family="Poppins" font-weight="800" font-size="30" fill="#fff">G</text><path d="M34 44l16-16M34 28l6 6M44 38l6 6M41 27h9v9" fill="none" stroke="#c6f432" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>',
     '<span style="display:flex;align-items:center"><span style="font-family:Poppins;font-weight:800;font-size:30pt;color:#111;line-height:1">Goo</span><svg viewBox="0 0 30 30" width="11mm" height="11mm"><path d="M5 27 26 6M5 6l8 8M18 19l8 8M15 5h11v11" fill="none" stroke="#5a8a00" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span style="font-family:Poppins;font-weight:600;color:#5a8a00;font-size:8pt;letter-spacing:3px;margin-top:1.2mm">DRIVER</span>'),
    ('w', 'Puntos de color', 'Las dos «o» se vuelven puntos llenos: el pedido y su destino.', '#ffffff',
     '<rect width="64" height="64" rx="32" fill="#ffffff" stroke="#e3e3e3"/><circle cx="23" cy="32" r="9" fill="#ff3b30"/><circle cx="41" cy="32" r="9" fill="#111"/>',
     '<span style="display:flex;align-items:center;gap:1mm;font-family:Poppins;font-weight:800;font-size:30pt;color:#111;line-height:1">G<svg viewBox="0 0 52 26" width="18mm" height="9mm"><circle cx="12" cy="15" r="10" fill="#ff3b30"/><circle cx="38" cy="15" r="10" fill="#111"/></svg>x</span><span style="font-family:Poppins;font-weight:600;color:#ff3b30;font-size:8pt;letter-spacing:3px;margin-top:1.2mm">DRIVER</span>'),
    ('w', 'Cortada por el viento', 'Letras gruesas atravesadas por líneas de velocidad.', '#ffffff',
     '<rect width="64" height="64" rx="16" fill="#1257ff"/><text x="32" y="45" text-anchor="middle" font-family="Archivo Black" font-size="34" fill="#fff">G</text><path d="M0 30h64M0 38h64" stroke="#1257ff" stroke-width="2.5"/>',
     '<span style="position:relative;display:inline-block;font-family:\'Archivo Black\';font-size:30pt;color:#1257ff;font-style:italic;line-height:1">Goox<span style="position:absolute;left:0;right:0;top:45%;height:1.2mm;background:#fff"></span><span style="position:absolute;left:0;right:0;top:63%;height:1.2mm;background:#fff"></span></span><span style="font-family:Poppins;font-weight:600;color:#111;font-size:8pt;letter-spacing:3px;margin-top:1.2mm">DRIVER</span>'),
    ('w', 'En bloque', 'GO arriba, OX abajo: un cuadrado que se lee de un vistazo y dice «go».', '#f3f3ef',
     '<rect width="64" height="64" rx="12" fill="#111"/><text x="32" y="30" text-anchor="middle" font-family="Archivo Black" font-size="19" fill="#fff" letter-spacing="1">GO</text><text x="32" y="51" text-anchor="middle" font-family="Archivo Black" font-size="19" fill="#ff6b00" letter-spacing="1">OX</text>',
     '<span style="font-family:\'Archivo Black\';font-size:22pt;line-height:.95;color:#111">GO<br><span style="color:#ff6b00">OX</span></span><span style="font-family:Poppins;font-weight:600;color:#111;font-size:8pt;letter-spacing:3px;margin-top:1.2mm">DRIVER</span>'),
    ('w', 'Doble o en ruta', 'Las dos «o» se unen por debajo con un camino punteado.', '#ffffff',
     '<rect width="64" height="64" rx="16" fill="#e8f7ee"/><circle cx="22" cy="28" r="9" fill="none" stroke="#0a7b44" stroke-width="5"/><circle cx="42" cy="28" r="9" fill="none" stroke="#0a7b44" stroke-width="5"/><path d="M16 46h32" stroke="#0a7b44" stroke-width="3" stroke-dasharray="3 3" stroke-linecap="round"/>',
     '<span style="font-family:Outfit;font-weight:800;font-size:30pt;color:#053a20;line-height:1;border-bottom:1mm dashed #0a7b44;padding-bottom:.5mm">Goox</span><span style="font-family:Poppins;font-weight:600;color:#0a7b44;font-size:8pt;letter-spacing:3px;margin-top:1.6mm">DRIVER</span>'),
    # ── Sellos y personajes ──
    ('s', 'La bolsa simpática', 'La bolsa de reparto con ojos: el personaje de la marca.', '#fff6e8',
     '<rect width="64" height="64" rx="18" fill="#ffb020"/><path d="M15 24h34l-2 30H17z" fill="#fff"/><path d="M24 24v-4a8 8 0 0 1 16 0v4" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="26" cy="36" r="3.2" fill="#1a1a1a"/><circle cx="38" cy="36" r="3.2" fill="#1a1a1a"/><path d="M27 44q5 4 10 0" fill="none" stroke="#1a1a1a" stroke-width="2.6" stroke-linecap="round"/>',
     wm('Fredoka', 700, '#3d2300', '#e08a00')),
    ('s', 'El casco', 'El visor del casco dibuja las dos «o»: motos y repartidores.', '#eef2f7',
     '<rect width="64" height="64" rx="16" fill="#0f172a"/><path d="M12 40c0-14 9-24 21-24s19 9 19 22v6H12z" fill="#e2e8f0"/><path d="M20 34h26a4 4 0 0 1 4 4v2H20z" fill="#0f172a"/><circle cx="29" cy="37" r="2.2" fill="#38bdf8"/><circle cx="38" cy="37" r="2.2" fill="#38bdf8"/>',
     wm('Space Grotesk', 700, '#0f172a', '#0ea5e9')),
    ('s', 'Sello de calidad', 'Un sello redondo con la X en el centro, para cascos, gorras y maletas.', '#ffffff',
     '<circle cx="32" cy="32" r="30" fill="#111"/><circle cx="32" cy="32" r="24" fill="none" stroke="#c6f432" stroke-width="1.5"/><path d="M24 24l16 16M40 24 24 40" stroke="#c6f432" stroke-width="5" stroke-linecap="round"/><g fill="#fff"><circle cx="32" cy="11" r="1.6"/><circle cx="32" cy="53" r="1.6"/><circle cx="11" cy="32" r="1.6"/><circle cx="53" cy="32" r="1.6"/></g>',
     wm('Archivo Black', 400, '#111', '#5a8a00')),
    ('s', 'El mapa del tesoro', 'Un mapa doblado donde la X marca el lugar: tu puerta.', '#f8f1e4',
     '<rect width="64" height="64" rx="16" fill="#0e7490"/><path d="M10 18l14-5 16 6 14-5v33l-14 5-16-6-14 5z" fill="#fef3c7"/><path d="M24 13v33M40 19v33" stroke="#0e7490" stroke-width="1.5" opacity=".5"/><path d="M14 38c6-2 9-10 18-10" fill="none" stroke="#0e7490" stroke-width="2.4" stroke-dasharray="2.5 3"/><path d="M37 26l8 8M45 26l-8 8" stroke="#e11d48" stroke-width="3.5" stroke-linecap="round"/>',
     wm('Baloo 2', 800, '#083344', '#0e7490')),
]

GRUPOS = [
    ('x', 'Jugando con la X', 'La X es la letra más fuerte del nombre: cruce, flecha, encuentro, destino.'),
    ('o', 'Jugando con las dos «o»', 'Faros, ojos, origen y destino, ruedas. Ninguno usa el ocho acostado, que ya es de Meta.'),
    ('g', 'Jugando con la G', 'Monogramas para el ícono de la app.'),
    ('w', 'Jugando con la palabra', 'La palabra misma como logo: la X que es flecha, las «o» que son puntos.'),
    ('s', 'Sellos y personajes', 'Para gorras, cascos, maletas de reparto y redes.'),
]

FAVORITOS = ['Equis que avanza', 'De aquí hasta allá', 'El mapa del tesoro']


# ── Escudos vikingos (idea de Richard, 21 oct 2026): protección, la X al centro y el borde como rueda ──
_REMACHES12 = ''.join(
    f'<circle cx="{100 + 80 * c:.1f}" cy="{100 + 80 * s:.1f}" r="4.2" fill="#3d3d3d" stroke="#0d0d0d" stroke-width="1"/>'
    for c, s in [(0, -1), (.5, -.866), (.866, -.5), (1, 0), (.866, .5), (.5, .866), (0, 1), (-.5, .866), (-.866, .5), (-1, 0), (-.866, -.5), (-.5, -.866)])
_REMACHES8 = ''.join(
    f'<circle cx="{100 + 78.5 * c:.1f}" cy="{100 + 78.5 * s:.1f}" r="3.4" fill="#ffffff"/>'
    for c, s in [(0, -1), (.707, -.707), (1, 0), (.707, .707), (0, 1), (-.707, .707), (-1, 0), (-.707, -.707)])

ESCUDOS = [
    dict(nombre='Escudo de madera', clave='madera',
         idea='El escudo de los vikingos, tal cual: tablas de madera, la X roja con bordes blancos, el borde de hierro con remaches y el centro de metal. Habla de protección, de historia y de fuerza.',
         uso='Campañas, uniformes, la maleta de reparto, la tienda y las redes: donde hay espacio para el detalle.',
         svg=('<circle cx="100" cy="100" r="85" fill="#1c1c1c"/><circle cx="100" cy="100" r="74" fill="#7a5233"/>'
              '<g stroke="#5c3c22" stroke-width="2"><path d="M44 52H156M30 76H170M26 100H174M30 124H170M44 148H156"/></g>'
              '<g stroke="#9a6b45" stroke-width="1" opacity=".6"><path d="M60 64h30M110 88h40M40 112h25M120 136h30M70 160h20"/></g>'
              '<path d="M50 50 150 150M150 50 50 150" stroke="#f4efe6" stroke-width="30"/>'
              '<path d="M50 50 150 150M150 50 50 150" stroke="#e1261c" stroke-width="20"/>'
              '<circle cx="100" cy="100" r="27" fill="#2a2a2a"/><circle cx="100" cy="100" r="19" fill="#111"/><circle cx="94" cy="94" r="6" fill="#4a4a4a"/>'
              + _REMACHES12 +
              '<g fill="#555"><circle cx="100" cy="77" r="2.2"/><circle cx="123" cy="100" r="2.2"/><circle cx="100" cy="123" r="2.2"/><circle cx="77" cy="100" r="2.2"/></g>'),
         colores=[('#e1261c', 'Rojo escudo'), ('#f4efe6', 'Blanco hueso'), ('#7a5233', 'Madera'), ('#1c1c1c', 'Hierro')]),
    dict(nombre='Escudo moderno', clave='moderno',
         idea='El mismo escudo, limpio y plano: borde negro con ocho remaches, campo blanco y la X roja de la marca. Se reconoce igual de lejos y en tamaño pequeño.',
         uso='El ícono de la app, el logo principal, gorras, cascos, la web y todo lo que se ve pequeño.',
         svg=('<circle cx="100" cy="100" r="85" fill="#191919"/><circle cx="100" cy="100" r="72" fill="#ffffff"/>'
              '<path d="M59 59 141 141M141 59 59 141" stroke="#ff3008" stroke-width="24" stroke-linecap="round"/>'
              '<circle cx="100" cy="100" r="20" fill="#191919"/><circle cx="100" cy="100" r="8" fill="#ffffff"/>' + _REMACHES8),
         colores=[('#ff3008', 'Rojo escarlata'), ('#ffffff', 'Blanco'), ('#191919', 'Gris oscuro')]),
    dict(nombre='Escudo rueda', clave='rueda',
         idea='El borde se vuelve llanta y el centro, tuercas: es un escudo y es una rueda a la vez. La X roja hace de rayos.',
         uso='Repartidores, motos y carros: la parte de transporte de la marca.',
         svg=('<circle cx="100" cy="100" r="85" fill="#191919"/>'
              '<g stroke="#3a3a3a" stroke-width="5"><path d="M100 15v10M100 185v-10M15 100h10M185 100h-10M160 40l-7 7M40 160l7-7M160 160l-7-7M40 40l7 7"/></g>'
              '<circle cx="100" cy="100" r="66" fill="#ffffff"/><path d="M100 34V166M34 100H166" stroke="#d8d8d8" stroke-width="6"/>'
              '<path d="M60 60 140 140M140 60 60 140" stroke="#ff3008" stroke-width="18" stroke-linecap="round"/>'
              '<circle cx="100" cy="100" r="22" fill="#191919"/>'
              '<g fill="#ffffff"><circle cx="100" cy="88" r="3"/><circle cx="111.4" cy="96.3" r="3"/><circle cx="107" cy="109.7" r="3"/><circle cx="93" cy="109.7" r="3"/><circle cx="88.6" cy="96.3" r="3"/></g>'),
         colores=[('#ff3008', 'Rojo escarlata'), ('#ffffff', 'Blanco'), ('#191919', 'Gris oscuro'), ('#d8d8d8', 'Gris rayos')]),
]
