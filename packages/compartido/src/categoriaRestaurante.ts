/**
 * C-CATEGORIA-EN-INGLES (18 nov 2026, todos los países): la categoría de cocina que escribe el
 * restaurante (en español) se muestra en inglés a quien usa la app en inglés. Lista cerrada de las
 * cocinas comunes, como el filtro de cocinas de DoorDash y Uber Eats; una categoría que no está en la
 * lista se muestra tal cual. Sin IA, sin escribir nada.
 */
const EN = new Map<string, string>([
  ['mexicana', 'Mexican'],
  ['comida mexicana', 'Mexican'],
  ['hamburguesas', 'Burgers'],
  ['hamburguesa', 'Burgers'],
  ['pizza', 'Pizza'],
  ['pizzas', 'Pizza'],
  ['pizzeria', 'Pizza'],
  ['cubana', 'Cuban'],
  ['venezolana', 'Venezuelan'],
  ['colombiana', 'Colombian'],
  ['tipica colombiana', 'Colombian'],
  ['comida colombiana', 'Colombian'],
  ['peruana', 'Peruvian'],
  ['argentina', 'Argentinian'],
  ['italiana', 'Italian'],
  ['china', 'Chinese'],
  ['japonesa', 'Japanese'],
  ['sushi', 'Sushi'],
  ['tailandesa', 'Thai'],
  ['india', 'Indian'],
  ['arabe', 'Middle Eastern'],
  ['americana', 'American'],
  ['comida rapida', 'Fast food'],
  ['pollo', 'Chicken'],
  ['pollo frito', 'Fried chicken'],
  ['parrilla', 'Grill'],
  ['asados', 'Grill'],
  ['mariscos', 'Seafood'],
  ['pescados y mariscos', 'Seafood'],
  ['tacos', 'Tacos'],
  ['sandwiches', 'Sandwiches'],
  ['ensaladas', 'Salads'],
  ['saludable', 'Healthy'],
  ['vegetariana', 'Vegetarian'],
  ['vegana', 'Vegan'],
  ['postres', 'Desserts'],
  ['helados', 'Ice cream'],
  ['panaderia', 'Bakery'],
  ['cafe', 'Coffee'],
  ['cafeteria', 'Coffee'],
  ['cafe y desayunos', 'Coffee & breakfast'],
  ['desayunos', 'Breakfast'],
  ['arepas', 'Arepas'],
  ['empanadas', 'Empanadas'],
  ['bebidas', 'Drinks'],
  ['jugos', 'Juices'],
  ['supermercado', 'Grocery'],
  ['mercado', 'Grocery'],
  ['farmacia', 'Pharmacy'],
  ['licores', 'Liquor'],
  ['licoreria', 'Liquor'],
]);

const normal = (x: string) =>
  x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function categoriaRestaurante(categoria: string, idioma: string): string {
  if (idioma !== 'en' || !categoria) return categoria;
  return EN.get(normal(categoria)) ?? categoria;
}
