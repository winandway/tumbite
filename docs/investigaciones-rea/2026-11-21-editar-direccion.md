# Ficha: «Editar» una dirección guardada (nombre, datos y fotos de la entrada)

Fecha: 21 nov 2026 · Puesto: desarrollador · Todos los países · Candado: C-EDITAR-ES-EDITAR

Etiquetas: [DOC] documentación pública leída hoy · [OBS] observado hoy en nuestro código · [INF] inferencia nuestra · [NV] no verificado.
REA con hash: no se usó. Las apps de los grandes no se descompilan y sus webs públicas no muestran la pantalla de editar una dirección con sesión; el fallo de Divoox tenía causa clara en el código (prueba directa, que es mejor evidencia según la metodología).

## 1. El fallo

- Richard abrió los tres puntos de una dirección guardada esperando «Editar» para ponerle un nombre propio y terminó en «Ayuda a tu repartidor a encontrarte» (fotos de la puerta).
- Causa [OBS]: `apps/cliente/src/inicio/ElegirDireccion.tsx` no tenía «Editar». El menú era «Ajustar el punto en el mapa», «Fotos de la puerta» y «Borrar», y al confirmar el punto de una dirección YA guardada `alConfirmar` saltaba sola a la hoja de las fotos.
- Fallo de paso [OBS]: «Ajustar el punto» guardaba con `POST /datos/mis-direcciones`, que busca por el texto de la dirección. Si al mover el pin cambiaba el texto, se creaba una dirección NUEVA en vez de corregir la vieja (duplicado). La ruta correcta ya existía: `PUT /datos/mis-direcciones/:id`.

## 2. Cómo lo resuelven los grandes

- DoorDash [DOC, ayuda oficial «How do I change my delivery address?»]: para cambiar una dirección o sus instrucciones hay que borrarla y agregarla otra vez; al agregarla se escribe el apartamento o la suite y las instrucciones de entrega. No documenta cambiar el nombre en el sitio.
- Uber [DOC, blog oficial de Uber «ubicaciones guardadas» y «agrega tus favoritos»]: lugares guardados con Casa y Trabajo fijos y otros lugares propios, cada uno con su nombre.
- Uber Eats [DOC, ficha previa 2026-11-15-foto-de-la-puerta]: la foto del lugar se pide al registrar la dirección, como un extra opcional.
- Rappi [NV]: su ayuda pública no documenta la edición de direcciones guardadas.
- Patrón común [INF]: la dirección guardada lleva tipo con ícono (Casa, Trabajo, otro), nombre, apartamento, instrucciones y el punto en el mapa, en una sola pantalla de detalle. Las fotos, donde existen, son opcionales y van aparte del nombre.

## 3. Decisión (una sola)

1. En los tres puntos de cada dirección guardada, «Editar» es la primera opción. Abre la hoja nueva de la dirección, dentro de la misma ventana (C-NUNCA-EN-BLANCO).
2. La hoja tiene cabecera roja de la marca con un pin de mapa animado a un lado, y tres pasos numerados: (1) «¿Dónde te entregamos?» con Casa, Trabajo y los demás lugares, cada uno con su ícono, y ahí mismo el nombre propio (hasta 30 letras); (2) datos de la dirección: el punto en el mapa con «Ajustar el punto en el mapa», apartamento o piso y punto de referencia; (3) opcional, abajo: fotos de la entrada (Casa o Edificio, «Tomar foto» y «Subir desde archivos») y el mensaje para quien llega (indicaciones).
3. Mejoramos a DoorDash: se edita en el sitio, sin borrar y volver a crear.
4. «Fotos de la entrada» sigue siendo su propia opción del menú: abre la misma hoja directamente en las fotos. Nunca quedan escondidas detrás de «Editar».
5. Ajustar el punto de una dirección guardada guarda con `PUT` por id y vuelve a la lista (o a la hoja si vino de ahí). Nunca termina en las fotos. Una dirección NUEVA sin fotos abre la hoja una vez, con «Ahora no».
6. El título de las fotos deja de decir solo «repartidor»: «Que te encuentren a la primera», para quien llega a entregarte o a buscarte.
7. Lo escrito no se pierde: borrador por cuenta y por dirección, que se borra solo cuando el servidor confirma.

## 4. Pruebas de aceptación

- `apps/cliente/src/inicio/editarDireccion.test.ts`: orden del menú, nombres de las opciones, cuerpo del PUT que conserva lo no editado, nombre máximo de 30, ajustar una guardada nunca termina en fotos, la pantalla usa borrador y PUT.
- Captura en pantalla del menú, la cabecera, los datos y las fotos, en español y en inglés (`docs/capturas/editar-direccion/`).

## Fuentes

- DoorDash, ayuda: https://help.doordash.com/en-us/consumers/article/how-do-i-change-my-delivery-address
- Uber, blog: https://www.uber.com/mx/es/blog/ubicaciones-guardadas
- Uber, blog: https://www.uber.com/es-CO/blog/agrega-tus-favoritos
