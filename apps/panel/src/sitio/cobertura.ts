import { type Idioma, enIdioma } from '@tumbite/compartido';

/**
 * Dónde está Divoox y a dónde va. Un solo lugar: el pie de página, las páginas por país y
 * por ciudad (SEO) y el mapa del sitio salen de aquí. «activo» se pinta en verde; lo demás, «muy pronto».
 */
export type Estado = 'activo' | 'pronto';
export type Lugar = {
  slug: string;
  nombre: Record<Idioma, string>;
  estado: Estado;
  /** Solo ciudades: país al que pertenece. */
  pais?: string;
  /**
   * Solo ciudades (C-CIUDAD-ABIERTA-SIN-PRONTO): la clave pública de su zona (el nombre sin acentos,
   * «el-vigia»). Con clave, la página dice lo que de verdad está abierto (lo da el servidor) y nunca
   * «muy pronto»; sin clave (Estados Unidos), sigue el interruptor de siempre.
   */
  clave?: string;
  /** Solo ciudades: el estado donde queda («Mérida»), para el texto y los datos estructurados. */
  estadoRegion?: string;
  /**
   * Solo ciudades con clave: unas líneas propias sobre la ciudad (de qué vive, vías y zonas que la
   * gente reconoce), con datos geográficos públicos y verificables, sin cifras. Cada página es única.
   */
  sobre?: Record<Idioma, string>;
  /** Solo países: código de dos letras para las banderas y los formularios. */
  codigo?: string;
  /** Solo países: región para agruparlos en el pie de página. */
  region?: Region;
  /** Solo países: las ciudades a las que llegaríamos primero (texto propio de cada página). */
  primerasCiudades?: string[];
  idioma?: Record<Idioma, string>;
  moneda?: Record<Idioma, string>;
};

export type Region =
  'norteamerica' | 'caribe' | 'centroamerica' | 'sudamerica' | 'europa' | 'africa';
export const REGIONES: { id: Region; nombre: Record<Idioma, string> }[] = [
  { id: 'norteamerica', nombre: { es: 'Norteamérica', en: 'North America' } },
  { id: 'caribe', nombre: { es: 'Caribe', en: 'Caribbean' } },
  { id: 'centroamerica', nombre: { es: 'Centroamérica', en: 'Central America' } },
  { id: 'sudamerica', nombre: { es: 'Sudamérica', en: 'South America' } },
  { id: 'europa', nombre: { es: 'Europa', en: 'Europe' } },
  { id: 'africa', nombre: { es: 'África', en: 'Africa' } },
];

export const PAISES: Lugar[] = [
  {
    slug: 'united-states',
    nombre: { es: 'Estados Unidos', en: 'United States' },
    estado: 'activo',
    codigo: 'US',
    region: 'norteamerica',
    primerasCiudades: ['Miami', 'Orlando', 'Tampa'],
    idioma: { es: 'inglés y español', en: 'English and Spanish' },
    moneda: { es: 'dólar', en: 'US dollar' },
  },
  {
    slug: 'mexico',
    nombre: { es: 'México', en: 'Mexico' },
    estado: 'pronto',
    codigo: 'MX',
    region: 'norteamerica',
    primerasCiudades: ['Ciudad de México', 'Guadalajara', 'Monterrey'],
    idioma: { es: 'español', en: 'Spanish' },
    moneda: { es: 'peso mexicano', en: 'Mexican peso' },
  },
  {
    slug: 'puerto-rico',
    nombre: { es: 'Puerto Rico', en: 'Puerto Rico' },
    estado: 'pronto',
    codigo: 'PR',
    region: 'caribe',
    primerasCiudades: ['San Juan', 'Bayamón', 'Ponce'],
    idioma: { es: 'español e inglés', en: 'Spanish and English' },
    moneda: { es: 'dólar', en: 'US dollar' },
  },
  {
    slug: 'dominican-republic',
    nombre: { es: 'República Dominicana', en: 'Dominican Republic' },
    estado: 'pronto',
    codigo: 'DO',
    region: 'caribe',
    primerasCiudades: ['Santo Domingo', 'Santiago de los Caballeros', 'Punta Cana'],
    idioma: { es: 'español', en: 'Spanish' },
    moneda: { es: 'peso dominicano', en: 'Dominican peso' },
  },
  {
    slug: 'cuba',
    nombre: { es: 'Cuba', en: 'Cuba' },
    estado: 'pronto',
    codigo: 'CU',
    region: 'caribe',
    primerasCiudades: ['La Habana', 'Santiago de Cuba', 'Camagüey'],
    idioma: { es: 'español', en: 'Spanish' },
    moneda: { es: 'peso cubano', en: 'Cuban peso' },
  },
  {
    slug: 'guatemala',
    nombre: { es: 'Guatemala', en: 'Guatemala' },
    estado: 'pronto',
    codigo: 'GT',
    region: 'centroamerica',
    primerasCiudades: ['Ciudad de Guatemala', 'Quetzaltenango', 'Antigua Guatemala'],
    idioma: { es: 'español', en: 'Spanish' },
    moneda: { es: 'quetzal', en: 'quetzal' },
  },
  {
    slug: 'el-salvador',
    nombre: { es: 'El Salvador', en: 'El Salvador' },
    estado: 'pronto',
    codigo: 'SV',
    region: 'centroamerica',
    primerasCiudades: ['San Salvador', 'Santa Ana', 'San Miguel'],
    idioma: { es: 'español', en: 'Spanish' },
    moneda: { es: 'dólar', en: 'US dollar' },
  },
  {
    slug: 'honduras',
    nombre: { es: 'Honduras', en: 'Honduras' },
    estado: 'pronto',
    codigo: 'HN',
    region: 'centroamerica',
    primerasCiudades: ['Tegucigalpa', 'San Pedro Sula', 'La Ceiba'],
    idioma: { es: 'español', en: 'Spanish' },
    moneda: { es: 'lempira', en: 'lempira' },
  },
  {
    slug: 'nicaragua',
    nombre: { es: 'Nicaragua', en: 'Nicaragua' },
    estado: 'pronto',
    codigo: 'NI',
    region: 'centroamerica',
    primerasCiudades: ['Managua', 'León', 'Granada'],
    idioma: { es: 'español', en: 'Spanish' },
    moneda: { es: 'córdoba', en: 'córdoba' },
  },
  {
    slug: 'costa-rica',
    nombre: { es: 'Costa Rica', en: 'Costa Rica' },
    estado: 'pronto',
    codigo: 'CR',
    region: 'centroamerica',
    primerasCiudades: ['San José', 'Alajuela', 'Heredia'],
    idioma: { es: 'español', en: 'Spanish' },
    moneda: { es: 'colón', en: 'colón' },
  },
  {
    slug: 'panama',
    nombre: { es: 'Panamá', en: 'Panama' },
    estado: 'pronto',
    codigo: 'PA',
    region: 'centroamerica',
    primerasCiudades: ['Ciudad de Panamá', 'Colón', 'David'],
    idioma: { es: 'español', en: 'Spanish' },
    moneda: { es: 'balboa y dólar', en: 'balboa and US dollar' },
  },
  {
    slug: 'colombia',
    nombre: { es: 'Colombia', en: 'Colombia' },
    estado: 'pronto',
    codigo: 'CO',
    region: 'sudamerica',
    primerasCiudades: ['Bogotá', 'Medellín', 'Cali'],
    idioma: { es: 'español', en: 'Spanish' },
    moneda: { es: 'peso colombiano', en: 'Colombian peso' },
  },
  {
    // C-PAIS-ABIERTO-SIN-PRONTO: «pronto» es solo lo de partida; si tiene un servicio abierto, la web
    // lo muestra abierto con lo que diga el servidor (paisesAbiertos.ts). No se abre aquí a mano.
    slug: 'venezuela',
    nombre: { es: 'Venezuela', en: 'Venezuela' },
    estado: 'pronto',
    codigo: 'VE',
    region: 'sudamerica',
    primerasCiudades: ['Caracas', 'Maracaibo', 'Valencia'],
    idioma: { es: 'español', en: 'Spanish' },
    // Los viajes se cobran en dólares (perfil de Venezuela, monedaViajes USD); también se usa el bolívar.
    moneda: { es: 'dólar y bolívar', en: 'US dollar and bolívar' },
  },
  {
    slug: 'ecuador',
    nombre: { es: 'Ecuador', en: 'Ecuador' },
    estado: 'pronto',
    codigo: 'EC',
    region: 'sudamerica',
    primerasCiudades: ['Quito', 'Guayaquil', 'Cuenca'],
    idioma: { es: 'español', en: 'Spanish' },
    moneda: { es: 'dólar', en: 'US dollar' },
  },
  {
    slug: 'peru',
    nombre: { es: 'Perú', en: 'Peru' },
    estado: 'pronto',
    codigo: 'PE',
    region: 'sudamerica',
    primerasCiudades: ['Lima', 'Arequipa', 'Trujillo'],
    idioma: { es: 'español', en: 'Spanish' },
    moneda: { es: 'sol', en: 'sol' },
  },
  {
    slug: 'bolivia',
    nombre: { es: 'Bolivia', en: 'Bolivia' },
    estado: 'pronto',
    codigo: 'BO',
    region: 'sudamerica',
    primerasCiudades: ['La Paz', 'Santa Cruz de la Sierra', 'Cochabamba'],
    idioma: { es: 'español', en: 'Spanish' },
    moneda: { es: 'boliviano', en: 'boliviano' },
  },
  {
    slug: 'chile',
    nombre: { es: 'Chile', en: 'Chile' },
    estado: 'pronto',
    codigo: 'CL',
    region: 'sudamerica',
    primerasCiudades: ['Santiago', 'Valparaíso', 'Concepción'],
    idioma: { es: 'español', en: 'Spanish' },
    moneda: { es: 'peso chileno', en: 'Chilean peso' },
  },
  {
    slug: 'argentina',
    nombre: { es: 'Argentina', en: 'Argentina' },
    estado: 'pronto',
    codigo: 'AR',
    region: 'sudamerica',
    primerasCiudades: ['Buenos Aires', 'Córdoba', 'Rosario'],
    idioma: { es: 'español', en: 'Spanish' },
    moneda: { es: 'peso argentino', en: 'Argentine peso' },
  },
  {
    slug: 'uruguay',
    nombre: { es: 'Uruguay', en: 'Uruguay' },
    estado: 'pronto',
    codigo: 'UY',
    region: 'sudamerica',
    primerasCiudades: ['Montevideo', 'Punta del Este', 'Salto'],
    idioma: { es: 'español', en: 'Spanish' },
    moneda: { es: 'peso uruguayo', en: 'Uruguayan peso' },
  },
  {
    slug: 'paraguay',
    nombre: { es: 'Paraguay', en: 'Paraguay' },
    estado: 'pronto',
    codigo: 'PY',
    region: 'sudamerica',
    primerasCiudades: ['Asunción', 'Ciudad del Este', 'Encarnación'],
    idioma: { es: 'español y guaraní', en: 'Spanish and Guaraní' },
    moneda: { es: 'guaraní', en: 'guaraní' },
  },
  {
    slug: 'brazil',
    nombre: { es: 'Brasil', en: 'Brazil' },
    estado: 'pronto',
    codigo: 'BR',
    region: 'sudamerica',
    primerasCiudades: ['São Paulo', 'Río de Janeiro', 'Brasilia'],
    idioma: { es: 'portugués', en: 'Portuguese' },
    moneda: { es: 'real', en: 'Brazilian real' },
  },
  {
    slug: 'guyana',
    nombre: { es: 'Guyana', en: 'Guyana' },
    estado: 'pronto',
    codigo: 'GY',
    region: 'sudamerica',
    primerasCiudades: ['Georgetown', 'Linden', 'New Amsterdam'],
    idioma: { es: 'inglés', en: 'English' },
    moneda: { es: 'dólar guyanés', en: 'Guyanese dollar' },
  },
  {
    slug: 'suriname',
    nombre: { es: 'Surinam', en: 'Suriname' },
    estado: 'pronto',
    codigo: 'SR',
    region: 'sudamerica',
    primerasCiudades: ['Paramaribo', 'Lelydorp', 'Nieuw Nickerie'],
    idioma: { es: 'neerlandés', en: 'Dutch' },
    moneda: { es: 'dólar surinamés', en: 'Surinamese dollar' },
  },
  {
    slug: 'spain',
    nombre: { es: 'España', en: 'Spain' },
    estado: 'pronto',
    codigo: 'ES',
    region: 'europa',
    primerasCiudades: ['Madrid', 'Barcelona', 'Valencia'],
    idioma: { es: 'español', en: 'Spanish' },
    moneda: { es: 'euro', en: 'euro' },
  },
  {
    slug: 'portugal',
    nombre: { es: 'Portugal', en: 'Portugal' },
    estado: 'pronto',
    codigo: 'PT',
    region: 'europa',
    primerasCiudades: ['Lisboa', 'Oporto', 'Braga'],
    idioma: { es: 'portugués', en: 'Portuguese' },
    moneda: { es: 'euro', en: 'euro' },
  },
  {
    slug: 'italy',
    nombre: { es: 'Italia', en: 'Italy' },
    estado: 'pronto',
    codigo: 'IT',
    region: 'europa',
    primerasCiudades: ['Roma', 'Milán', 'Nápoles'],
    idioma: { es: 'italiano', en: 'Italian' },
    moneda: { es: 'euro', en: 'euro' },
  },
  {
    slug: 'france',
    nombre: { es: 'Francia', en: 'France' },
    estado: 'pronto',
    codigo: 'FR',
    region: 'europa',
    primerasCiudades: ['París', 'Lyon', 'Marsella'],
    idioma: { es: 'francés', en: 'French' },
    moneda: { es: 'euro', en: 'euro' },
  },
  {
    slug: 'germany',
    nombre: { es: 'Alemania', en: 'Germany' },
    estado: 'pronto',
    codigo: 'DE',
    region: 'europa',
    primerasCiudades: ['Berlín', 'Múnich', 'Hamburgo'],
    idioma: { es: 'alemán', en: 'German' },
    moneda: { es: 'euro', en: 'euro' },
  },
  {
    slug: 'netherlands',
    nombre: { es: 'Países Bajos', en: 'Netherlands' },
    estado: 'pronto',
    codigo: 'NL',
    region: 'europa',
    primerasCiudades: ['Ámsterdam', 'Róterdam', 'La Haya'],
    idioma: { es: 'neerlandés', en: 'Dutch' },
    moneda: { es: 'euro', en: 'euro' },
  },
  {
    slug: 'united-kingdom',
    nombre: { es: 'Reino Unido', en: 'United Kingdom' },
    estado: 'pronto',
    codigo: 'GB',
    region: 'europa',
    primerasCiudades: ['Londres', 'Mánchester', 'Birmingham'],
    idioma: { es: 'inglés', en: 'English' },
    moneda: { es: 'libra esterlina', en: 'pound sterling' },
  },
  {
    slug: 'romania',
    nombre: { es: 'Rumanía', en: 'Romania' },
    estado: 'pronto',
    codigo: 'RO',
    region: 'europa',
    primerasCiudades: ['Bucarest', 'Cluj-Napoca', 'Timișoara'],
    idioma: { es: 'rumano', en: 'Romanian' },
    moneda: { es: 'leu', en: 'leu' },
  },
  {
    slug: 'equatorial-guinea',
    nombre: { es: 'Guinea Ecuatorial', en: 'Equatorial Guinea' },
    estado: 'pronto',
    codigo: 'GQ',
    region: 'africa',
    primerasCiudades: ['Malabo', 'Bata', 'Ebebiyín'],
    idioma: { es: 'español', en: 'Spanish' },
    moneda: { es: 'franco CFA', en: 'CFA franc' },
  },
];

export const CIUDADES: Lugar[] = [
  // Miami pasa a «activo» el día del lanzamiento público (hoy la portada dice «muy pronto»; decisión de Richard).
  { slug: 'miami', nombre: { es: 'Miami', en: 'Miami' }, estado: 'pronto', pais: 'united-states' },
  {
    slug: 'orlando',
    nombre: { es: 'Orlando', en: 'Orlando' },
    estado: 'pronto',
    pais: 'united-states',
  },
  { slug: 'tampa', nombre: { es: 'Tampa', en: 'Tampa' }, estado: 'pronto', pais: 'united-states' },
  { slug: 'ocala', nombre: { es: 'Ocala', en: 'Ocala' }, estado: 'pronto', pais: 'united-states' },
  // C-CIUDAD-ABIERTA-SIN-PRONTO (25 nov 2026, orden de Richard): las ciudades de Venezuela. Lo que
  // cada una tiene abierto sale del servidor por su `clave`; aquí no se abre ni se cierra nada.
  // Las que se repiten en otros países llevan el país en la dirección (Mérida, Valencia, San Cristóbal).
  ...(
    [
      [
        'el-vigia',
        'El Vigía',
        'el-vigia',
        'Mérida',
        'El Vigía es la ciudad más grande del Sur del Lago de Maracaibo, en el municipio Alberto Adriani del estado Mérida. Es cruce de caminos entre los Andes y el Zulia: por aquí pasan la Carretera Panamericana y las vías hacia Mérida, El Zulia y el Táchira, y tiene aeropuerto propio. Vive del comercio, el transporte y el campo del Sur del Lago.',
        'El Vigía is the largest city in the South of Lake Maracaibo region, in the Alberto Adriani municipality of Mérida state. It is a crossroads between the Andes and Zulia: the Pan-American Highway and the roads to Mérida, Zulia and Táchira run through it, and it has its own airport. Its economy rests on trade, transportation and the farmland around the lake.',
      ],
      [
        'tucani',
        'Tucaní',
        'tucani',
        'Mérida',
        'Tucaní es la capital del municipio Caracciolo Parra Olmedo, en el estado Mérida, sobre la Carretera Panamericana en la zona del Sur del Lago. Es un pueblo agrícola y ganadero, de paso para quien viaja entre El Vigía, Caja Seca y el oriente del Zulia.',
        'Tucaní is the seat of the Caracciolo Parra Olmedo municipality in Mérida state, on the Pan-American Highway in the South of Lake Maracaibo region. It is a farming and cattle town, a stop on the way between El Vigía, Caja Seca and eastern Zulia.',
      ],
      [
        'caracas',
        'Caracas',
        'caracas',
        'Distrito Capital',
        'Caracas es la capital de Venezuela y su ciudad más grande. Está en un valle a los pies del Ávila (Parque Nacional Waraira Repano), a pocos kilómetros del mar Caribe y del aeropuerto de Maiquetía. Es el centro del gobierno, las empresas y los servicios del país.',
        'Caracas is the capital of Venezuela and its largest city. It sits in a valley at the foot of El Ávila (Waraira Repano National Park), a short drive from the Caribbean Sea and Maiquetía airport. It is the country’s center of government, business and services.',
      ],
      [
        'maracaibo',
        'Maracaibo',
        'maracaibo',
        'Zulia',
        'Maracaibo es la capital del estado Zulia, a orillas del Lago de Maracaibo, que se cruza por el Puente General Rafael Urdaneta. Es la gran ciudad del occidente venezolano, con larga tradición petrolera y comercial, y la tierra de la gaita zuliana.',
        'Maracaibo is the capital of Zulia state, on the shore of Lake Maracaibo, crossed by the General Rafael Urdaneta Bridge. It is the main city of western Venezuela, with a long oil and trading tradition, and the home of gaita zuliana music.',
      ],
      [
        'valencia-venezuela',
        'Valencia',
        'valencia',
        'Carabobo',
        'Valencia es la capital del estado Carabobo, en el centro del país, cerca del Lago de Valencia y del puerto de Puerto Cabello. Es uno de los grandes polos industriales de Venezuela y la cruza la Autopista Regional del Centro.',
        'Valencia is the capital of Carabobo state, in central Venezuela, near Lake Valencia and the port of Puerto Cabello. It is one of the country’s main industrial hubs, and the Central Regional Highway runs through it.',
      ],
      [
        'barquisimeto',
        'Barquisimeto',
        'barquisimeto',
        'Lara',
        'Barquisimeto es la capital del estado Lara, en el centro occidente del país. La llaman la capital musical de Venezuela y cada enero recibe la procesión de la Divina Pastora. Es un centro comercial y agrícola de la región.',
        'Barquisimeto is the capital of Lara state, in central-western Venezuela. It is known as the music capital of Venezuela, and every January it hosts the Divina Pastora procession. It is a trading and farming center for the region.',
      ],
      [
        'merida-venezuela',
        'Mérida',
        'merida',
        'Mérida',
        'Mérida es la capital del estado Mérida, en plena cordillera de los Andes, entre la Sierra Nevada y la Sierra de La Culata. Es ciudad universitaria, sede de la Universidad de Los Andes, y vive mucho del turismo de montaña, con el teleférico Mukumbarí.',
        'Mérida is the capital of Mérida state, high in the Andes between the Sierra Nevada and the Sierra de La Culata. It is a college town, home to the University of the Andes, and lives largely on mountain tourism, including the Mukumbarí cable car.',
      ],
      [
        'san-cristobal-venezuela',
        'San Cristóbal',
        'san-cristobal',
        'Táchira',
        'San Cristóbal es la capital del estado Táchira, en los Andes venezolanos y cerca de la frontera con Colombia. Es una ciudad comercial y de paso entre los dos países, conocida por su feria de enero.',
        'San Cristóbal is the capital of Táchira state, in the Venezuelan Andes near the border with Colombia. It is a trading city on the route between the two countries, known for its January fair.',
      ],
      [
        'maracay',
        'Maracay',
        'maracay',
        'Aragua',
        'Maracay es la capital del estado Aragua, en el centro del país, junto al Lago de Valencia. La llaman la ciudad jardín y es la puerta del Parque Nacional Henri Pittier, que baja hasta las playas de la costa aragüeña.',
        'Maracay is the capital of Aragua state, in central Venezuela, next to Lake Valencia. It is known as the garden city and is the gateway to Henri Pittier National Park, which runs down to the beaches of the Aragua coast.',
      ],
      [
        'puerto-la-cruz',
        'Puerto La Cruz',
        'puerto-la-cruz',
        'Anzoátegui',
        'Puerto La Cruz es una ciudad costera del estado Anzoátegui, en el oriente del país, con su Paseo Colón frente al mar. Es puerto, centro turístico y la salida hacia el Parque Nacional Mochima y las islas del Caribe oriental.',
        'Puerto La Cruz is a coastal city in Anzoátegui state, in eastern Venezuela, with its Paseo Colón boardwalk on the sea. It is a port, a tourist town and the departure point for Mochima National Park and the islands of the eastern Caribbean.',
      ],
      [
        'ciudad-guayana',
        'Ciudad Guayana',
        'ciudad-guayana',
        'Bolívar',
        'Ciudad Guayana, en el estado Bolívar, une Puerto Ordaz y San Félix donde el río Caroní se junta con el Orinoco. Es el gran polo de la industria del hierro, el acero y el aluminio de Venezuela, cerca de la represa de Guri.',
        'Ciudad Guayana, in Bolívar state, joins Puerto Ordaz and San Félix where the Caroní River meets the Orinoco. It is the hub of Venezuela’s iron, steel and aluminum industry, near the Guri Dam.',
      ],
    ] as const
  ).map(([slug, nombre, clave, estadoRegion, sobreEs, sobreEn]): Lugar => ({
    slug,
    nombre: { es: nombre, en: nombre },
    estado: 'pronto',
    pais: 'venezuela',
    clave,
    estadoRegion,
    sobre: { es: sobreEs, en: sobreEn },
  })),
];

/** Tipos de comida que la gente busca (sirven de enlaces internos para el SEO). */
export const COCINAS: { slug: string; nombre: Record<Idioma, string> }[] = [
  { slug: 'pizza', nombre: { es: 'Pizza', en: 'Pizza' } },
  { slug: 'burgers', nombre: { es: 'Hamburguesas', en: 'Burgers' } },
  { slug: 'sushi', nombre: { es: 'Sushi', en: 'Sushi' } },
  { slug: 'cuban', nombre: { es: 'Comida cubana', en: 'Cuban food' } },
  { slug: 'venezuelan', nombre: { es: 'Comida venezolana', en: 'Venezuelan food' } },
  { slug: 'colombian', nombre: { es: 'Comida colombiana', en: 'Colombian food' } },
  { slug: 'mexican', nombre: { es: 'Comida mexicana', en: 'Mexican food' } },
  { slug: 'chicken', nombre: { es: 'Pollo', en: 'Chicken' } },
  { slug: 'healthy', nombre: { es: 'Saludable', en: 'Healthy' } },
  { slug: 'desserts', nombre: { es: 'Postres', en: 'Desserts' } },
  { slug: 'coffee', nombre: { es: 'Café y desayunos', en: 'Coffee and breakfast' } },
  { slug: 'seafood', nombre: { es: 'Mariscos', en: 'Seafood' } },
];

export const paisDe = (slug: string) => PAISES.find((p) => p.slug === slug) ?? null;
export const ciudadDe = (slug: string) => CIUDADES.find((c) => c.slug === slug) ?? null;
export const cocinaDe = (slug: string) => COCINAS.find((c) => c.slug === slug) ?? null;

/** Nombre en inglés de las ciudades que en español se escriben distinto (Berlín → Berlin). */
const CIUDAD_EN = new Map([
  ['Ciudad de México', 'Mexico City'],
  ['La Habana', 'Havana'],
  ['Ciudad de Guatemala', 'Guatemala City'],
  ['Antigua Guatemala', 'Antigua'],
  ['Ciudad de Panamá', 'Panama City'],
  ['Río de Janeiro', 'Rio de Janeiro'],
  ['Brasilia', 'Brasília'],
  ['Lisboa', 'Lisbon'],
  ['Oporto', 'Porto'],
  ['Roma', 'Rome'],
  ['Milán', 'Milan'],
  ['Nápoles', 'Naples'],
  ['París', 'Paris'],
  ['Marsella', 'Marseille'],
  ['Berlín', 'Berlin'],
  ['Múnich', 'Munich'],
  ['Hamburgo', 'Hamburg'],
  ['Ámsterdam', 'Amsterdam'],
  ['Róterdam', 'Rotterdam'],
  ['La Haya', 'The Hague'],
  ['Londres', 'London'],
  ['Mánchester', 'Manchester'],
  ['Bucarest', 'Bucharest'],
  ['Ebebiyín', 'Ebebiyin'],
  ['Santa Cruz de la Sierra', 'Santa Cruz'],
  ['Santiago de los Caballeros', 'Santiago'],
]);
export const ciudadEnIdioma = (ciudad: string, idioma: Idioma) =>
  idioma === 'en' ? (CIUDAD_EN.get(ciudad) ?? ciudad) : ciudad;

/** En inglés algunos países van con «the» dentro de una frase: «in the Netherlands». */
const CON_ARTICULO = new Set([
  'united-states',
  'dominican-republic',
  'netherlands',
  'united-kingdom',
]);
export const paisEnFrase = (p: Lugar, idioma: Idioma) =>
  idioma === 'en' && CON_ARTICULO.has(p.slug) ? `the ${p.nombre.en}` : enIdioma(p.nombre, idioma);
