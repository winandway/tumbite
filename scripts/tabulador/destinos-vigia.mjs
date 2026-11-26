/**
 * C-TABULADOR-VIGIA (25 nov 2026, Richard): el tabulador de carreras de moto taxi de El Vigía, tal
 * cual la hoja «Tabulador de Carreras Urbanas y Extra Urbanas de Moto Taxis». Precios en dólares
 * enteros (se guardan en centavos). `buscar` es lo que se le pregunta a Google Places para ubicar el
 * lugar; `tipo` decide el radio (barrio, pueblo o ciudad). Lo usan los dos guiones de esta carpeta.
 *
 * NO se cambian los precios aquí sin la hoja nueva: la prueba `tabuladorElVigia.test.ts` los fija.
 */
export const VIAS = {
  merida: 'Vía Mérida',
  zulia: 'Vía El Zulia',
  tachira: 'Vía Táchira',
  panamericana: 'Vía Panamericana',
  cortas: 'Carreras cortas',
};

/** [vía, nombre, dólares, tipo, búsqueda] */
export const DESTINOS = [
  // Vía Mérida
  ['merida', 'La Vega I', 2, 'barrio', 'La Vega, El Vigía, Mérida'],
  ['merida', 'La Vega II', 3, 'barrio', 'La Vega II, El Vigía, Mérida'],
  ['merida', 'Peaje Vía Mérida', 3, 'barrio', 'Peaje El Vigía vía Mérida, Mérida'],
  ['merida', 'Palmita', 7, 'pueblo', 'La Palmita, Mérida'],
  ['merida', 'Mesa Bolívar', 15, 'pueblo', 'Mesa Bolívar, Mérida'],
  ['merida', 'Alcabala La Victoria', 20, 'barrio', 'La Victoria, Antonio Pinto Salinas, Mérida'],
  ['merida', 'Santa Cruz', 20, 'pueblo', 'Santa Cruz de Mora, Mérida'],
  ['merida', 'Tovar', 25, 'ciudad', 'Tovar, Mérida'],
  ['merida', 'Bailadores', 40, 'pueblo', 'Bailadores, Mérida'],
  ['merida', 'El Anís', 12, 'pueblo', 'El Anís, Mérida'],
  ['merida', 'La Lagunillas', 20, 'pueblo', 'Lagunillas, Sucre, Mérida'],
  ['merida', 'Ejido', 25, 'ciudad', 'Ejido, Mérida'],
  ['merida', 'Mérida', 30, 'ciudad', 'Mérida, Mérida, Venezuela'],
  ['merida', 'Tabay', 35, 'pueblo', 'Tabay, Mérida'],
  ['merida', 'Apartadero', 60, 'pueblo', 'Apartaderos, Mérida'],
  ['merida', 'La Providencia', 15, 'pueblo', 'La Providencia, Mérida'],
  ['merida', 'Mesa de las Palmas', 25, 'pueblo', 'Mesa de Las Palmas, Mérida'],
  // Vía El Zulia
  ['zulia', 'Pedeca', 2, 'barrio', 'Pedeca, El Vigía, Mérida'],
  ['zulia', 'Caño Frío', 3, 'barrio', 'Caño Frío, El Vigía, Mérida'],
  ['zulia', 'Los Pozones', 3, 'barrio', 'Los Pozones, El Vigía, Mérida'],
  ['zulia', 'Parque Chama', 3, 'barrio', 'Parque Chama, El Vigía, Mérida'],
  ['zulia', 'Parque Chama II', 4, 'barrio', 'Parque Chama II, El Vigía, Mérida'],
  ['zulia', 'Alcabala Vera Agua', 5, 'barrio', 'Vera Agua, Mérida'],
  ['zulia', 'Cañito', 5, 'barrio', 'El Cañito, El Vigía, Mérida'],
  ['zulia', 'Caracolí', 10, 'pueblo', 'Caracolí, Alberto Adriani, Mérida'],
  ['zulia', 'KM 35', 15, 'pueblo', 'Kilómetro 35, Zulia'],
  ['zulia', 'El Ubito', 17, 'pueblo', 'El Ubito, Zulia'],
  ['zulia', 'Moralito', 15, 'pueblo', 'Moralito, Zulia'],
  ['zulia', 'Santa Bárbara', 25, 'ciudad', 'Santa Bárbara del Zulia, Zulia'],
  ['zulia', 'Encontrado', 45, 'pueblo', 'Encontrados, Catatumbo, Zulia'],
  ['zulia', 'Santa Cruz Zulia', 40, 'pueblo', 'Santa Cruz del Zulia, Zulia'],
  ['zulia', 'Casigua El Cubo', 90, 'pueblo', 'Casigua El Cubo, Zulia'],
  ['zulia', 'El Taparo', 3, 'barrio', 'El Taparo, El Vigía, Mérida'],
  ['zulia', 'El Guayabo', 60, 'pueblo', 'El Guayabo, Catatumbo, Zulia'],
  // Vía Táchira
  ['tachira', 'Puente de Onia', 2, 'barrio', 'Puente Onia, El Vigía, Mérida'],
  ['tachira', 'Carlos Andrés', 5, 'barrio', 'Carlos Andrés Pérez, El Vigía, Mérida'],
  ['tachira', 'Culebria', 10, 'pueblo', 'Culebrilla, Mérida'],
  ['tachira', 'Los Giros', 15, 'pueblo', 'Los Giros, Mérida'],
  ['tachira', 'KM 9', 3, 'barrio', 'Kilómetro 9, El Vigía, Mérida'],
  ['tachira', 'KM 12', 4, 'barrio', 'Kilómetro 12, El Vigía, Mérida'],
  ['tachira', 'KM 15', 6, 'barrio', 'Kilómetro 15, El Vigía, Mérida'],
  ['tachira', 'Peaje Zea', 10, 'barrio', 'Peaje Zea, Mérida'],
  ['tachira', 'Caño Tigre', 15, 'pueblo', 'Caño El Tigre, Zea, Mérida'],
  ['tachira', 'Zea', 20, 'pueblo', 'Zea, Mérida'],
  ['tachira', 'La Tendida', 15, 'pueblo', 'La Tendida, Táchira'],
  ['tachira', 'Coloncito', 20, 'pueblo', 'Coloncito, Táchira'],
  ['tachira', 'El Puerto', 35, 'pueblo', 'El Puerto, Táchira'],
  ['tachira', 'La Fría', 30, 'ciudad', 'La Fría, Táchira'],
  ['tachira', 'Aguas Clara', 45, 'pueblo', 'Aguas Claras, Táchira'],
  ['tachira', 'San Juan de Colón', 45, 'ciudad', 'San Juan de Colón, Táchira'],
  ['tachira', 'San Cristóbal', 70, 'ciudad', 'San Cristóbal, Táchira'],
  // Vía Panamericana
  ['panamericana', 'Redoma de la Blanca', 2, 'barrio', 'Redoma La Blanca, El Vigía, Mérida'],
  ['panamericana', 'Prado Hermoso', 3, 'barrio', 'Prado Hermoso, El Vigía, Mérida'],
  ['panamericana', 'Aroa II', 3, 'barrio', 'Aroa II, El Vigía, Mérida'],
  ['panamericana', 'Aroa I', 5, 'barrio', 'Aroa, El Vigía, Mérida'],
  ['panamericana', 'Los Naranjos', 12, 'pueblo', 'Los Naranjos, Mérida'],
  ['panamericana', '4 Esquinas', 15, 'pueblo', 'Cuatro Esquinas, Mérida'],
  ['panamericana', 'El Chivo', 25, 'pueblo', 'El Chivo, Zulia'],
  ['panamericana', 'Blanca Universidad', 3, 'barrio', 'Universidad La Blanca, El Vigía, Mérida'],
  ['panamericana', 'Los Robles', 4, 'barrio', 'Los Robles, El Vigía, Mérida'],
  ['panamericana', 'Villa los Ángeles', 5, 'barrio', 'Villa Los Ángeles, El Vigía, Mérida'],
  ['panamericana', 'Alta Vista', 3, 'barrio', 'Alta Vista, El Vigía, Mérida'],
  ['panamericana', 'Las Delicias', 3, 'barrio', 'Las Delicias, El Vigía, Mérida'],
  ['panamericana', 'Mucujepe', 5, 'pueblo', 'Mucujepe, Mérida'],
  ['panamericana', 'Guayabones', 15, 'pueblo', 'Guayabones, Mérida'],
  ['panamericana', 'Santa Elena', 20, 'pueblo', 'Santa Elena de Arenales, Mérida'],
  ['panamericana', 'Tucaní', 30, 'pueblo', 'Tucaní, Mérida'],
  ['panamericana', 'Caja Seca', 45, 'ciudad', 'Caja Seca, Zulia'],
  // Carreras cortas (dentro de El Vigía)
  ['cortas', 'Centro', 1, 'barrio', 'Plaza Bolívar, El Vigía, Mérida'],
  ['cortas', 'Av. 15', 1, 'barrio', 'Avenida 15, El Vigía, Mérida'],
  ['cortas', 'Paraíso', 1, 'barrio', 'El Paraíso, El Vigía, Mérida'],
  ['cortas', 'Campo Alegre', 2, 'barrio', 'Campo Alegre, El Vigía, Mérida'],
  ['cortas', 'La Páez', 1, 'barrio', 'Urbanización Páez, El Vigía, Mérida'],
  ['cortas', 'La Pedregosa (Redoma)', 1, 'barrio', 'Redoma La Pedregosa, El Vigía, Mérida'],
  ['cortas', 'La Pedregosa ULA', 2, 'barrio', 'ULA La Pedregosa, El Vigía, Mérida'],
  ['cortas', 'Buenos Aires (Asodega)', 1, 'barrio', 'Buenos Aires, El Vigía, Mérida'],
  ['cortas', 'Colinas de Buenos Aires', 2, 'barrio', 'Colinas de Buenos Aires, El Vigía, Mérida'],
  ['cortas', 'La Playita', 1, 'barrio', 'La Playita, El Vigía, Mérida'],
  ['cortas', '23 de Enero', 1, 'barrio', '23 de Enero, El Vigía, Mérida'],
  ['cortas', 'El Bosque', 1, 'barrio', 'El Bosque, El Vigía, Mérida'],
  ['cortas', 'Cementerio Onia', 1, 'barrio', 'Cementerio, El Vigía, Mérida'],
  ['cortas', 'Las Primicias', 1, 'barrio', 'Las Primicias, El Vigía, Mérida'],
  ['cortas', 'La Motoza', 2, 'barrio', 'La Motoza, El Vigía, Mérida'],
];

/** Centro de El Vigía (Plaza Bolívar), el mismo de la zona VE-MER-ELVIGIA. */
export const CENTRO_VIGIA = { lat: 8.6219, lng: -71.6506 };
