import type { Idioma } from '@tumbite/compartido';
import type { Guia, SeccionDocs } from './guias';

/**
 * Guías públicas de Divoox Flex (lo nuevo de la Fase 7: exportar, recargas con pago local, importar
 * desde Excel, kilómetros y tiempos de la ruta, «Navegar la ruta» y la página de rastreo) y de
 * Divoox Envíos de A a B (quien envía, quien recibe y el conductor). Capturas REALES tomadas con
 * scripts/recorrido/capturas-flex.mjs y capturas-envios.mjs (EE. UU. en Novi, Michigan; Venezuela en
 * El Vigía, Mérida), con datos neutros. Español e inglés con los mismos ids, el mismo número de
 * párrafos, capturas y pasos, en el mismo orden.
 */
import { BORRADORES_VIAJES_2 } from './borradores/viajesProgramadosYEnvios';

const c = (nombre: string, idioma: Idioma, alt: string, pie: string) => ({
  src: `/docs/recorrido-${nombre}-${idioma}.webp`,
  alt,
  pie,
});

export const GUIAS_FLEX_ENVIOS: Record<Idioma, Partial<Record<SeccionDocs['id'], Guia[]>>> = {
  es: {
    business: [
      {
        id: 'flex-export-spreadsheet',
        titulo: 'Divoox Flex: exportar tus listas a una hoja de cálculo',
        resumen:
          'Descarga tus envíos, paquetes, rutas, devoluciones, incidencias o los movimientos de tu billetera en un archivo que abre Excel o Google Sheets.',
        explicacion: [
          'Cada lista del panel tiene su botón «Exportar»: Envíos, Paquetes, Rutas, Devoluciones, Incidencias y los movimientos de la Billetera. El archivo sale en formato CSV, que abre directo en Excel, Google Sheets o Numbers.',
          'El archivo trae exactamente lo que estás viendo: si buscaste una referencia o filtraste por estado, centro, conductor o fecha, se exporta solo eso. Así sacas, por ejemplo, las entregas fallidas de la semana o las rutas de un conductor.',
          'Cada archivo trae hasta 10.000 filas. Si tu lista es más grande, el panel te avisa que descargó las primeras y te pide poner un filtro para bajar el resto. Exportar no cambia nada en tu cuenta: solo lee.',
        ],
        capturas: [
          c(
            'flex2-exportar',
            'es',
            'La lista de envíos del panel de Divoox Flex con el botón Exportar junto al buscador.',
            'El botón «Exportar» está arriba de cada lista.',
          ),
          c(
            'flex2-exportar-listo',
            'es',
            'El panel confirma la descarga con el mensaje «Listo: 10 filas en el archivo CSV».',
            'Al terminar, te dice cuántas filas trae el archivo.',
          ),
          c(
            'flex2-exportar-rutas',
            'es',
            'La lista de rutas con sus filtros por estado, centro, conductor y fecha, y el botón Exportar.',
            'Con filtros puestos, se exporta solo lo filtrado.',
          ),
        ],
        preguntas: [
          '¿Cómo exporto mis envíos a Excel?',
          '¿Puedo descargar mis rutas en una hoja de cálculo?',
          '¿Cómo exporto los movimientos de mi billetera?',
          '¿Cuántas filas trae el archivo exportado?',
        ],
        pasos: [
          'Entra a la lista que quieres descargar: Envíos, Paquetes, Rutas, Devoluciones, Incidencias o Billetera.',
          'Si quieres solo una parte, busca o pon los filtros (estado, centro, conductor o fecha).',
          'Toca «Exportar» y espera el mensaje con el número de filas.',
          'Abre el archivo descargado con Excel o Google Sheets.',
        ],
        nota: 'Para cargar envíos desde una hoja de cálculo, mira la guía «importar envíos desde Excel».',
      },
      {
        id: 'flex-wallet-local-topup',
        titulo:
          'Divoox Flex: recargar la billetera con pago móvil, transferencia, Zelle o efectivo',
        resumen:
          'En Venezuela pagas por pago móvil, transferencia, Zelle o en efectivo, declaras el pago con su referencia y la foto del comprobante, y nuestro equipo lo verifica y suma el saldo.',
        explicacion: [
          'En los países donde no se recarga con tarjeta, como Venezuela, la billetera de tu empresa tiene la pestaña «Pago local». Ahí ves «Dónde pagar»: los datos del pago móvil, la cuenta para transferencias, el correo de Zelle y dónde se paga en efectivo.',
          'Después de pagar, declaras la recarga: eliges el método, escribes el monto pagado, el número de referencia, el banco de origen (si quieres) y la fecha, y subes la foto del comprobante o la tomas con la cámara. El monto tiene que estar entre el mínimo y el máximo de tu país.',
          'La recarga queda «En revisión». Nuestro equipo compara el pago con el comprobante y la acredita una sola vez: aunque toques dos veces, no se suma doble. Si algo no cuadra, la rechaza y te dice el motivo.',
          'Cuando se acredita, el saldo aparece en «Resumen» y la recarga queda en tus movimientos. Si tenías un saldo pendiente, la recarga lo paga primero y el resto va a tu disponible.',
        ],
        capturas: [
          c(
            'flex2-recarga-local',
            'es',
            'La pestaña Pago local de la billetera con los datos de dónde pagar y el formulario para declarar un pago móvil.',
            'Dónde pagar y el formulario para declarar tu pago.',
          ),
          c(
            'flex2-recarga-local-revision',
            'es',
            'La recarga declarada aparece en la lista con el estado En revisión.',
            'Tu recarga queda en revisión.',
          ),
          c(
            'flex2-recarga-local-historial',
            'es',
            'La lista de recargas con pago local muestra la recarga de 20 dólares por pago móvil como Acreditada.',
            'Cuando el equipo la verifica, pasa a «Acreditada».',
          ),
          c(
            'flex2-recarga-local-acreditada',
            'es',
            'El resumen de la billetera con 20 dólares de saldo disponible y la recarga en los movimientos recientes.',
            'El saldo ya está en tu billetera.',
          ),
        ],
        preguntas: [
          '¿Cómo recargo con pago móvil en Divoox Flex?',
          '¿Puedo recargar la billetera con Zelle o transferencia?',
          '¿Cómo recargo en efectivo?',
          '¿Cuánto tarda en verse mi recarga?',
          '¿Por qué rechazaron mi recarga?',
        ],
        pasos: [
          'En el panel de tu empresa entra a «Billetera» y abre la pestaña «Pago local».',
          'Paga con los datos de «Dónde pagar» por pago móvil, transferencia, Zelle o en efectivo.',
          'Elige el método y escribe el monto, la referencia, el banco (opcional) y la fecha del pago.',
          'Sube la foto del comprobante o tómala con la cámara, y toca «Enviar para revisión».',
          'Cuando la recarga pase a «Acreditada», mira tu saldo en «Resumen».',
        ],
        nota: 'Las recargas con pago local se encienden país por país. Guarda el comprobante hasta que la recarga quede acreditada.',
      },
      {
        id: 'flex-import-excel',
        titulo: 'Divoox Flex: importar envíos desde Excel con la plantilla',
        resumen:
          'Descarga la plantilla, llena una fila por envío y súbela tal cual: el panel lee tu Excel, te muestra cada fila y crea los envíos válidos.',
        explicacion: [
          'En «Importar» puedes subir un archivo de Excel (.xlsx) o un CSV. El Excel se lee en tu navegador, sin subir el archivo: se toma la primera hoja y su valor guardado (las fórmulas, colores y formatos no cuentan).',
          'Toca «Descargar la plantilla de Excel» y tendrás una hoja con los títulos de las columnas: referencia, destinatario, teléfono, correo, dirección, latitud, longitud, cantidad de paquetes, descripción, instrucciones y ventana horaria. Los títulos van en inglés y también se aceptan en español. Lo obligatorio es el destinatario y la dirección.',
          'Antes de crear nada, «Previsualizar» te muestra cuántas filas hay, cuántas son válidas y el error exacto de cada fila que no sirve. Al confirmar se crean solo las válidas; las demás las corriges en tu Excel y las vuelves a subir.',
          'Cada archivo admite hasta 5.000 filas y 5 MB. Las importaciones anteriores quedan en la lista de abajo, con su estado.',
        ],
        capturas: [
          c(
            'flex2-importar',
            'es',
            'La pantalla Importar del panel con el campo para elegir el archivo y el enlace Descargar la plantilla de Excel.',
            'Aquí subes tu archivo y descargas la plantilla.',
          ),
          c(
            'flex2-importar-vista',
            'es',
            'La vista previa del archivo envios.xlsx: 3 filas, 3 válidas y la lista de envíos con su destinatario y dirección.',
            'La vista previa antes de crear los envíos.',
          ),
          c(
            'flex2-importar-listo',
            'es',
            'La importación terminada con 3 envíos creados y el historial de importaciones anteriores.',
            'Listo: los envíos ya están en tu lista.',
          ),
        ],
        preguntas: [
          '¿Cómo importo envíos desde Excel?',
          '¿Dónde descargo la plantilla de Excel?',
          '¿Qué columnas lleva el archivo?',
          '¿Qué pasa con las filas que tienen error?',
        ],
        pasos: [
          'En el panel de tu empresa entra a «Importar» y toca «Descargar la plantilla de Excel».',
          'Llena una fila por envío y guarda el archivo como .xlsx.',
          'Elige el archivo y el centro de origen, y toca «Previsualizar».',
          'Revisa las filas válidas y los errores, y toca «Confirmar e importar las válidas».',
          'Corrige en tu Excel las filas con error y súbelas otra vez.',
        ],
        nota: 'Después de importar, imprime las etiquetas y arma la ruta (guía «importar envíos e imprimir etiquetas»).',
      },
      {
        id: 'flex-route-distance-and-navigation',
        titulo: 'Divoox Flex: kilómetros y tiempos de la ruta, y «Navegar la ruta»',
        resumen:
          'Cada ruta muestra cuántos kilómetros son por calles, cuánto se maneja y a qué hora se llega a cada parada; el conductor abre todas sus paradas en orden en el mapa con un toque.',
        explicacion: [
          'En el detalle de una ruta, la tarjeta «Recorrido por calles» te dice la distancia total y el tiempo de manejo, medidos por calles y sin tráfico. En «Llegada estimada» ves la hora aproximada a la que el conductor llega a cada parada, contando unos minutos en cada entrega.',
          'Se calcula solo al asignar u ofrecer la ruta. Si cambias el orden de las paradas antes de que salga, toca «Calcular tiempos reales» para ponerlo al día; si el orden no cambió, no vuelve a calcular.',
          'En Divoox Driver, el conductor abre «Mi ruta (paquetes)», entra a la ruta y en la pestaña «Mapa» ve todas las paradas numeradas y la siguiente parada con su distancia aproximada.',
          '«Iniciar navegación» lo lleva a la siguiente parada. «Navegar la ruta» abre Google Maps con las próximas paradas en orden, hasta 10 a la vez; cuando las resuelve, vuelve a tocarlo y se abren las siguientes. Waze y Apple Maps solo admiten una parada a la vez.',
          'Las mismas horas estimadas son las que ve quien recibe en la página de rastreo de su paquete.',
        ],
        capturas: [
          c(
            'flex2-ruta-calles',
            'es',
            'La tarjeta Recorrido por calles de una ruta: 23,4 km y 47 minutos de manejo, con la llegada estimada a cada una de las 4 paradas.',
            'Kilómetros, tiempo de manejo y llegada a cada parada.',
          ),
          c(
            'flex2-driver-ruta',
            'es',
            'La ruta en Divoox Driver con su progreso y el mapa con las paradas numeradas.',
            'La ruta en el celular del conductor.',
          ),
          c(
            'flex2-driver-navegar',
            'es',
            'La siguiente parada con los botones Iniciar navegación y Navegar la ruta en Divoox Driver.',
            '«Navegar la ruta» abre las próximas paradas en orden.',
          ),
          c(
            'flex2-driver-mis-rutas',
            'es',
            'La pantalla Mis rutas de Divoox Driver con la ruta actual de la empresa y el botón para continuarla.',
            'Desde «Mis rutas», el conductor entra a su ruta.',
          ),
        ],
        preguntas: [
          '¿Cuántos kilómetros tiene mi ruta?',
          '¿A qué hora llega el conductor a cada parada?',
          '¿Cómo abre el conductor todas las paradas en Google Maps?',
          '¿Qué hago si cambié el orden de las paradas?',
        ],
        pasos: [
          'Asigna u ofrece la ruta: la distancia y los tiempos se calculan solos.',
          'En el detalle de la ruta, mira «Recorrido por calles» y abre «Llegada estimada».',
          'Si cambiaste el orden de las paradas, toca «Calcular tiempos reales».',
          'El conductor abre «Mi ruta (paquetes)» en Divoox Driver y entra a la ruta.',
          'En la pestaña «Mapa», toca «Navegar la ruta» para ir parada por parada.',
        ],
        nota: 'La distancia que ve el conductor junto a cada parada es aproximada, en línea recta; la del panel es por calles.',
      },
      {
        id: 'flex-tracking-page',
        titulo: 'Divoox Flex: lo que ve quien recibe al rastrear su paquete',
        resumen:
          'Con el número de guía, cualquiera ve el estado, la hora estimada y cuántas paradas faltan; con el enlace que le manda la empresa, quien recibe además marca su ubicación y ve la foto de la entrega.',
        explicacion: [
          'Con el número de seguimiento (empieza por DVX), cualquiera ve en «Rastrear un paquete» el estado actual y el historial con fecha y hora. Si la ruta ya tiene sus tiempos, también ve la llegada estimada y, mientras el conductor está en la calle, cuántas paradas faltan antes de la suya.',
          'Cuando su paquete es la próxima parada, aparece un mapa con dónde va el conductor, de forma aproximada (redondeada a unos 100 metros) y solo si su ubicación es reciente. Al entregarse, dice dónde quedó: en mano, en la recepción, en la puerta o en el buzón.',
          'Con el número de guía nunca se ven nombres, teléfonos, direcciones ni la foto de la entrega. La foto solo se ve en el enlace personal que la empresa le manda a quien recibe, durante 14 días.',
          'Ese mismo enlace sirve, antes de que el paquete salga, para marcar en el mapa el punto exacto de entrega y dejar un punto de referencia. Así el conductor llega directo, sin llamar.',
        ],
        capturas: [
          c(
            'flex2-rastreo-en-camino',
            'es',
            'La página Rastrea tu paquete con el estado En camino a tu dirección, la llegada estimada y Faltan 2 paradas antes de la tuya.',
            'En camino, con la hora estimada y las paradas que faltan.',
          ),
          c(
            'flex2-rastreo-proxima',
            'es',
            'La página de rastreo dice Eres la próxima parada y muestra un mapa con la posición aproximada del conductor.',
            'Siendo la próxima parada, el mapa con el conductor.',
          ),
          c(
            'flex2-enlace-destinatario',
            'es',
            'La página Confirma dónde recibes tu paquete, con el mapa para marcar el punto de entrega y el punto de referencia.',
            'El enlace personal para marcar el punto de entrega.',
          ),
        ],
        preguntas: [
          '¿Cómo rastreo mi paquete con el número de guía?',
          '¿A qué hora llega mi paquete?',
          '¿Dónde veo la foto de la entrega?',
          '¿Cómo le digo al conductor dónde entregar?',
        ],
        pasos: [
          'Abre «Rastrear un paquete» y escribe el número de seguimiento que empieza por DVX.',
          'Mira el estado, la llegada estimada y cuántas paradas faltan.',
          'Si recibiste el enlace de la empresa, ábrelo y marca tu punto de entrega antes de que el paquete salga.',
          'Después de la entrega, abre el mismo enlace para ver la foto.',
        ],
        nota: 'La empresa manda el enlace desde el detalle del envío, con «Pedir la ubicación al destinatario» (guía «la ubicación exacta de cada destinatario»).',
      },
    ],
    ordering: [
      {
        id: 'send-package',
        titulo: 'Enviar un paquete por la ciudad',
        resumen:
          'Envía llaves, documentos o un regalo de un lugar a otro, tan fácil como pedir un viaje.',
        explicacion: [
          'Con Divoox Envíos un conductor recoge tu paquete y lo lleva a quien lo recibe, dentro de la misma ciudad. Escribes dónde se recoge y a dónde va, y ves el precio fijo antes de confirmar. Pagas en efectivo al conductor o con tarjeta, según tu ciudad.',
          'Nos dices qué envías, su valor aproximado y el nombre y celular de quien lo recibe. Cada ciudad tiene un valor máximo por paquete, y confirmas que no envías nada prohibido. Tiene que caber en el maletero de un carro mediano.',
          'Al pedir, ves el PIN de entrega: le llega a quien recibe en un mensaje de texto, con el enlace para seguir el envío. Si el mensaje no le llega, pásaselo tú. El conductor toma una foto del paquete al recogerlo y solo lo entrega con ese PIN.',
        ],
        capturas: [
          c(
            'envios-cliente-precio',
            'es',
            'Divoox Envíos con la dirección de recogida y de entrega, y el precio fijo de 18,27 dólares con la opción de pagar en efectivo o con tarjeta.',
            'Escribe las dos direcciones y mira el precio.',
          ),
          c(
            'envios-cliente-paquete',
            'es',
            'El formulario del envío con qué envías, el valor aproximado, el nombre y el celular de quien recibe y la casilla de no enviar nada prohibido.',
            'Cuéntanos qué envías y quién lo recibe.',
          ),
          c(
            'envios-cliente-pin',
            'es',
            'El envío pedido, buscando conductor, con el PIN de entrega de 4 dígitos para quien recibe.',
            'Tu envío y el PIN de quien recibe.',
          ),
          c(
            'envios-cliente-en-camino',
            'es',
            'El envío en camino con el mapa, el conductor y su moto, y el PIN de entrega.',
            'Sigue el envío en el mapa hasta que se entregue.',
          ),
        ],
        preguntas: [
          '¿Cómo envío un paquete?',
          '¿Cuánto cuesta enviar un paquete?',
          '¿Qué no puedo enviar?',
          '¿Cómo sé que mi paquete llegó?',
        ],
        pasos: [
          'Abre Divoox y toca «Envíos».',
          'Escribe dónde se recoge y a dónde va, y toca «Ver precio».',
          'Elige cómo pagas y cuéntanos qué envías, su valor aproximado y el nombre y celular de quien lo recibe.',
          'Confirma que no envías nada prohibido y toca «Enviar».',
          'Sigue el envío en el mapa. Cuando se entregue, lo verás en la app.',
        ],
        nota: 'No se envían alcohol, medicinas, armas, dinero en efectivo, objetos ilegales ni comida que se dañe.',
      },
      {
        id: 'receive-package',
        titulo: 'Recibir un paquete',
        resumen:
          'Te llega un mensaje con el enlace para seguir el envío en vivo y tu PIN de entrega.',
        explicacion: [
          'Cuando alguien te envía un paquete con Divoox, recibes un mensaje de texto con un enlace para seguirlo en vivo, sin necesidad de tener cuenta. Ahí ves el conductor, su vehículo y placa, de dónde sale y a dónde va, y su ubicación en el mapa. El enlace deja de funcionar cuando el envío termina.',
          'El mensaje trae tu PIN de entrega. Se lo dices al conductor cuando te entrega el paquete: él lo escribe en su app y así sabemos que llegó a la persona correcta. Quien te lo envía también ve el PIN, por si el mensaje no te llega.',
        ],
        capturas: [
          c(
            'envios-destinatario-seguir',
            'es',
            'La página del enlace para seguir el envío en vivo, con el conductor, su moto y placa, el origen y el destino.',
            'Lo que ves al abrir el enlace del mensaje.',
          ),
          c(
            'envios-cliente-pin',
            'es',
            'La app de quien envía muestra el PIN de entrega de 4 dígitos que le llega a quien recibe.',
            'Quien envía también ve tu PIN.',
          ),
          c(
            'envios-driver-pin',
            'es',
            'La app del conductor con el PIN de entrega escrito y el botón Entregar el paquete.',
            'El conductor escribe tu PIN para entregar.',
          ),
        ],
        preguntas: [
          '¿Cómo rastreo un paquete que me envían?',
          '¿Para qué es el PIN de entrega?',
          '¿Necesito una cuenta para recibir?',
        ],
        pasos: [
          'Abre el enlace del mensaje para ver dónde va tu paquete.',
          'Cuando llegue el conductor, dile tu PIN de entrega.',
          'Recibe el paquete. Quien lo envió verá que ya se entregó.',
        ],
        nota: 'No compartas tu PIN por mensaje con nadie que no sea el conductor que te entrega.',
      },
    ],
    drivers: [
      {
        id: 'drive-delivery',
        titulo: 'Entregar paquetes con Divoox Envíos',
        resumen: 'Recoge el paquete, tómale una foto y entrégalo con el PIN de quien lo recibe.',
        explicacion: [
          'La oferta te muestra lo que ganas, cómo cobras, la distancia hasta la recogida y del recorrido, el tiempo estimado, dónde recoges y a dónde llevas el paquete. Si no respondes a tiempo, pasa al siguiente conductor.',
          'Al llegar a la recogida, toca «Llegué», recibe el paquete y toma su foto: sin la foto no puedes empezar. Luego toca «Iniciar viaje» y llévalo a la dirección de entrega.',
          'Al llegar, pídele el PIN de entrega a quien recibe, escríbelo y toca «Entregar el paquete». Si el envío es en efectivo, la app te dice cuánto cobrar.',
        ],
        capturas: [
          c(
            'envios-driver-oferta',
            'es',
            'La oferta de un envío en Divoox Driver con la ganancia, la distancia, el tiempo, la dirección de recogida y la de entrega, y el botón Aceptar.',
            'La oferta: lo que ganas y el recorrido.',
          ),
          c(
            'envios-driver-foto',
            'es',
            'En la recogida, el botón Tomar la foto del paquete, con la descripción del paquete y para quién es.',
            'En la recogida, toma la foto del paquete.',
          ),
          c(
            'envios-driver-pin',
            'es',
            'Llevando el paquete, con la casilla del PIN de entrega llena y el botón Entregar el paquete.',
            'En la entrega, escribe el PIN de quien recibe.',
          ),
        ],
        preguntas: [
          '¿Cómo entrego un paquete de Divoox Envíos?',
          '¿Por qué tengo que tomar foto del paquete?',
          '¿Qué hago si quien recibe no tiene el PIN?',
        ],
        pasos: [
          'Acepta la oferta y ve a la recogida.',
          'Toca «Llegué», recibe el paquete y toma su foto.',
          'Toca «Iniciar viaje» y llévalo a la dirección de entrega.',
          'Pide el PIN de entrega, escríbelo y toca «Entregar el paquete».',
          'Si quien recibe no tiene el PIN, llama a soporte desde la app.',
        ],
      },
    ],
  },
  en: {
    business: [
      {
        id: 'flex-export-spreadsheet',
        titulo: 'Divoox Flex: export your lists to a spreadsheet',
        resumen:
          'Download your shipments, packages, routes, returns, exceptions or wallet activity as a file that opens in Excel or Google Sheets.',
        explicacion: [
          'Every list in the dashboard has its own “Export” button: Shipments, Packages, Routes, Returns, Exceptions and your Wallet activity. The file is a CSV, which opens right away in Excel, Google Sheets or Numbers.',
          'The file contains exactly what you’re looking at: if you searched for a reference or filtered by status, hub, driver or date, only that is exported. That way you can pull, for example, this week’s failed deliveries or one driver’s routes.',
          'Each file holds up to 10,000 rows. If your list is bigger, the dashboard tells you it downloaded the first rows and asks you to add a filter to get the rest. Exporting doesn’t change anything in your account: it only reads.',
        ],
        capturas: [
          c(
            'flex2-exportar',
            'en',
            'The Divoox Flex shipments list with the Export button next to the search box.',
            'The “Export” button sits at the top of every list.',
          ),
          c(
            'flex2-exportar-listo',
            'en',
            'The dashboard confirms the download with a message saying how many rows are in the CSV file.',
            'When it’s done, it tells you how many rows the file has.',
          ),
          c(
            'flex2-exportar-rutas',
            'en',
            'The routes list with its status, hub, driver and date filters, and the Export button.',
            'With filters on, only the filtered rows are exported.',
          ),
        ],
        preguntas: [
          'How do I export my shipments to Excel?',
          'Can I download my routes as a spreadsheet?',
          'How do I export my wallet activity?',
          'How many rows does the exported file have?',
        ],
        pasos: [
          'Open the list you want to download: Shipments, Packages, Routes, Returns, Exceptions or Wallet.',
          'If you only want part of it, search or set the filters (status, hub, driver or date).',
          'Tap “Export” and wait for the message with the number of rows.',
          'Open the downloaded file in Excel or Google Sheets.',
        ],
        nota: 'To load shipments from a spreadsheet, see the guide “import shipments from Excel”.',
      },
      {
        id: 'flex-wallet-local-topup',
        titulo: 'Divoox Flex: top up your wallet by mobile payment, bank transfer, Zelle or cash',
        resumen:
          'In Venezuela you pay by mobile payment, bank transfer, Zelle or cash, report the payment with its reference number and a photo of the receipt, and our team verifies it and adds the balance.',
        explicacion: [
          'In countries where you can’t top up with a card, such as Venezuela, your company wallet has a “Local payment” tab. There you’ll see “Where to pay”: the mobile payment details, the account for bank transfers, the Zelle email and where to pay in cash.',
          'After you pay, you report the top-up: choose the method, enter the amount paid, the reference number, the sending bank (optional) and the date, and upload a photo of the receipt or take one with the camera. The amount has to be between your country’s minimum and maximum.',
          'The top-up shows as “In review”. Our team matches the payment against the receipt and credits it only once: even if you tap twice, it isn’t added twice. If something doesn’t match, the team declines it and tells you why.',
          'Once it’s credited, the balance shows up in “Overview” and the top-up appears in your activity. If you had an outstanding balance, the top-up pays it first and the rest goes to your available balance.',
        ],
        capturas: [
          c(
            'flex2-recarga-local',
            'en',
            'The wallet’s Local payment tab with the where-to-pay details and the form to report a mobile payment.',
            'Where to pay and the form to report your payment.',
          ),
          c(
            'flex2-recarga-local-revision',
            'en',
            'The reported top-up appears in the list with the status In review.',
            'Your top-up is in review.',
          ),
          c(
            'flex2-recarga-local-historial',
            'en',
            'The list of local-payment top-ups shows the 20-dollar mobile payment as Credited.',
            'Once the team verifies it, it changes to “Credited”.',
          ),
          c(
            'flex2-recarga-local-acreditada',
            'en',
            'The wallet overview with a 20-dollar available balance and the top-up in recent activity.',
            'The balance is now in your wallet.',
          ),
        ],
        preguntas: [
          'How do I top up with mobile payment in Divoox Flex?',
          'Can I top up my wallet with Zelle or a bank transfer?',
          'How do I top up with cash?',
          'How long until my top-up shows up?',
          'Why was my top-up declined?',
        ],
        pasos: [
          'In your company dashboard, go to “Wallet” and open the “Local payment” tab.',
          'Pay using the “Where to pay” details by mobile payment, bank transfer, Zelle or cash.',
          'Choose the method and enter the amount, reference number, bank (optional) and payment date.',
          'Upload a photo of the receipt or take one with the camera, and tap “Send for review”.',
          'When the top-up changes to “Credited”, check your balance in “Overview”.',
        ],
        nota: 'Local-payment top-ups are turned on country by country. Keep your receipt until the top-up is credited.',
      },
      {
        id: 'flex-import-excel',
        titulo: 'Divoox Flex: import shipments from Excel with the template',
        resumen:
          'Download the template, fill in one row per shipment and upload it as is: the dashboard reads your Excel file, shows you every row and creates the valid shipments.',
        explicacion: [
          'In “Import” you can upload an Excel file (.xlsx) or a CSV. The Excel file is read in your browser, without uploading it: the first sheet and its saved values are used (formulas, colors and formatting don’t count).',
          'Tap “Download the Excel template” to get a sheet with the column headers: reference, recipient, phone, email, address, latitude, longitude, number of packages, description, instructions and delivery window. Headers are in English and Spanish headers work too. Only the recipient and the address are required.',
          'Before anything is created, “Preview” shows how many rows there are, how many are valid and the exact error for each row that isn’t. When you confirm, only the valid rows are created; fix the others in your Excel file and upload them again.',
          'Each file can have up to 5,000 rows and 5 MB. Your previous imports stay in the list below, with their status.',
        ],
        capturas: [
          c(
            'flex2-importar',
            'en',
            'The Import screen in the dashboard with the file picker and the Download the Excel template link.',
            'Upload your file and download the template here.',
          ),
          c(
            'flex2-importar-vista',
            'en',
            'The preview of the shipments.xlsx file: 3 rows, 3 valid, and the list of shipments with recipient and address.',
            'The preview before the shipments are created.',
          ),
          c(
            'flex2-importar-listo',
            'en',
            'The finished import with 3 shipments created and the history of previous imports.',
            'Done: the shipments are now in your list.',
          ),
        ],
        preguntas: [
          'How do I import shipments from Excel?',
          'Where do I download the Excel template?',
          'Which columns does the file need?',
          'What happens to rows with errors?',
        ],
        pasos: [
          'In your company dashboard, go to “Import” and tap “Download the Excel template”.',
          'Fill in one row per shipment and save the file as .xlsx.',
          'Choose the file and the origin hub, and tap “Preview”.',
          'Check the valid rows and the errors, and tap the button to confirm and import the valid ones.',
          'Fix the rows with errors in your Excel file and upload them again.',
        ],
        nota: 'After importing, print the labels and build the route (guide “import shipments and print labels”).',
      },
      {
        id: 'flex-route-distance-and-navigation',
        titulo: 'Divoox Flex: route distance and times, and “Navigate the route”',
        resumen:
          'Every route shows its road distance, driving time and the arrival time at each stop; the driver opens all the stops in order on the map with one tap.',
        explicacion: [
          'In a route’s detail page, the “Route by road” card shows the total distance and driving time, measured by road and without traffic. Under “Estimated arrival” you see the approximate time the driver reaches each stop, counting a few minutes at each delivery.',
          'It’s calculated automatically when you assign or offer the route. If you change the order of the stops before it leaves, tap “Calculate real times” to update it; if the order didn’t change, it isn’t recalculated.',
          'In Divoox Driver, the driver opens “My route (packages)”, goes into the route and, on the “Map” tab, sees all the numbered stops and the next stop with its approximate distance.',
          '“Start navigation” takes them to the next stop. “Navigate the route” opens Google Maps with the next stops in order, up to 10 at a time; once those are done, tapping it again opens the next ones. Waze and Apple Maps only take one stop at a time.',
          'These same estimated times are what the recipient sees on their package’s tracking page.',
        ],
        capturas: [
          c(
            'flex2-ruta-calles',
            'en',
            'A route’s Route by road card with the total distance, driving time and estimated arrival at each of the 4 stops.',
            'Distance, driving time and arrival at each stop.',
          ),
          c(
            'flex2-driver-ruta',
            'en',
            'The route in Divoox Driver with its progress and the map with numbered stops.',
            'The route on the driver’s phone.',
          ),
          c(
            'flex2-driver-navegar',
            'en',
            'The next stop with the Start navigation and Navigate the route buttons in Divoox Driver.',
            '“Navigate the route” opens the next stops in order.',
          ),
          c(
            'flex2-driver-mis-rutas',
            'en',
            'The My routes screen in Divoox Driver with the company’s current route and the button to continue it.',
            'From “My routes”, the driver opens their route.',
          ),
        ],
        preguntas: [
          'How many miles or kilometers is my route?',
          'What time does the driver reach each stop?',
          'How does the driver open all the stops in Google Maps?',
          'What do I do if I changed the order of the stops?',
        ],
        pasos: [
          'Assign or offer the route: distance and times are calculated automatically.',
          'In the route’s detail page, check “Route by road” and open “Estimated arrival”.',
          'If you changed the order of the stops, tap “Calculate real times”.',
          'The driver opens “My route (packages)” in Divoox Driver and goes into the route.',
          'On the “Map” tab, they tap “Navigate the route” to go stop by stop.',
        ],
        nota: 'The distance the driver sees next to each stop is approximate, in a straight line; the one in the dashboard is by road.',
      },
      {
        id: 'flex-tracking-page',
        titulo: 'Divoox Flex: what the recipient sees when tracking their package',
        resumen:
          'With the tracking number, anyone sees the status, the estimated time and how many stops are left; with the link the company sends, the recipient can also mark their location and see the delivery photo.',
        explicacion: [
          'With the tracking number (it starts with DVX), anyone can see the current status and the history with dates and times in “Track a package”. If the route already has its times, they also see the estimated arrival and, while the driver is out, how many stops are before theirs.',
          'When their package is the next stop, a map shows where the driver is, approximately (rounded to about 100 meters) and only if the location is recent. Once delivered, it says where it was left: handed over, at the front desk, at the door or in the mailbox.',
          'The tracking number never shows names, phone numbers, addresses or the delivery photo. The photo can only be seen in the personal link the company sends the recipient, for 14 days.',
          'Before the package leaves, that same link lets the recipient mark the exact delivery spot on the map and add a landmark. That way the driver goes straight there, without calling.',
        ],
        capturas: [
          c(
            'flex2-rastreo-en-camino',
            'en',
            'The Track your package page with the status On its way to your address, the estimated arrival and 2 stops before yours.',
            'On its way, with the estimated time and the stops left.',
          ),
          c(
            'flex2-rastreo-proxima',
            'en',
            'The tracking page says You’re the next stop and shows a map with the driver’s approximate position.',
            'As the next stop, the map with the driver.',
          ),
          c(
            'flex2-enlace-destinatario',
            'en',
            'The Confirm where you receive your package page, with the map to mark the delivery spot and the landmark field.',
            'The personal link to mark the delivery spot.',
          ),
        ],
        preguntas: [
          'How do I track my package with the tracking number?',
          'What time will my package arrive?',
          'Where do I see the delivery photo?',
          'How do I tell the driver where to deliver?',
        ],
        pasos: [
          'Open “Track a package” and enter the tracking number that starts with DVX.',
          'Check the status, the estimated arrival and how many stops are left.',
          'If you got the company’s link, open it and mark your delivery spot before the package leaves.',
          'After delivery, open the same link to see the photo.',
        ],
        nota: 'The company sends the link from the shipment’s detail page with “Ask the recipient for their location” (guide “the exact location of each recipient”).',
      },
    ],
    ordering: [
      {
        id: 'send-package',
        titulo: 'Send a package across town',
        resumen:
          'Send keys, documents or a gift from one place to another, as easily as requesting a ride.',
        explicacion: [
          'With Divoox Delivery, a driver picks up your package and takes it to the recipient within the same city. You enter the pickup and drop-off addresses and see the upfront price before you confirm. You pay the driver in cash or by card, depending on your city.',
          'You tell us what you’re sending, its approximate value and the recipient’s name and mobile number. Each city has a maximum value per package, and you confirm you’re not sending anything prohibited. It has to fit in the trunk of a midsize car.',
          'When you request, you see the delivery PIN: the recipient gets it in a text message, with the link to follow the delivery. If the message doesn’t reach them, pass it on yourself. The driver takes a photo of the package at pickup and only hands it over with that PIN.',
        ],
        capturas: [
          c(
            'envios-cliente-precio',
            'en',
            'Divoox Delivery with the pickup and drop-off addresses and the upfront price of 18.27 dollars, with the option to pay in cash or by card.',
            'Enter both addresses and check the price.',
          ),
          c(
            'envios-cliente-paquete',
            'en',
            'The delivery form with what you’re sending, its approximate value, the recipient’s name and mobile number, and the no-prohibited-items box.',
            'Tell us what you’re sending and who gets it.',
          ),
          c(
            'envios-cliente-pin',
            'en',
            'The requested delivery, looking for a driver, with the recipient’s 4-digit delivery PIN.',
            'Your delivery and the recipient’s PIN.',
          ),
          c(
            'envios-cliente-en-camino',
            'en',
            'The delivery on its way with the map, the driver and their motorcycle, and the delivery PIN.',
            'Follow the delivery on the map until it arrives.',
          ),
        ],
        preguntas: [
          'How do I send a package?',
          'How much does it cost to send a package?',
          'What can’t I send?',
          'How do I know my package arrived?',
        ],
        pasos: [
          'Open Divoox and tap “Delivery”.',
          'Enter the pickup and drop-off addresses and tap “See price”.',
          'Choose how you pay and tell us what you’re sending, its approximate value and the recipient’s name and mobile number.',
          'Confirm you’re not sending anything prohibited and tap “Send”.',
          'Follow the delivery on the map. When it’s delivered, you’ll see it in the app.',
        ],
        nota: 'You can’t send alcohol, medication, weapons, cash, illegal items or perishable food.',
      },
      {
        id: 'receive-package',
        titulo: 'Receive a package',
        resumen: 'You get a text with a link to follow the delivery live and your delivery PIN.',
        explicacion: [
          'When someone sends you a package with Divoox, you get a text with a link to follow it live, no account needed. There you see the driver, their vehicle and plate, where it’s coming from and where it’s going, and their location on the map. The link stops working when the delivery ends.',
          'The text includes your delivery PIN. You tell it to the driver when they hand you the package: they enter it in their app, so we know it reached the right person. The sender can also see the PIN, in case the text doesn’t reach you.',
        ],
        capturas: [
          c(
            'envios-destinatario-seguir',
            'en',
            'The link page to follow the delivery live, with the driver, their motorcycle and plate, the pickup and the drop-off.',
            'What you see when you open the link in the text.',
          ),
          c(
            'envios-cliente-pin',
            'en',
            'The sender’s app shows the 4-digit delivery PIN that the recipient gets.',
            'The sender can see your PIN too.',
          ),
          c(
            'envios-driver-pin',
            'en',
            'The driver’s app with the delivery PIN entered and the Deliver the package button.',
            'The driver enters your PIN to deliver.',
          ),
        ],
        preguntas: [
          'How do I track a package someone is sending me?',
          'What is the delivery PIN for?',
          'Do I need an account to receive?',
        ],
        pasos: [
          'Open the link in the text to see where your package is.',
          'When the driver arrives, tell them your delivery PIN.',
          'Receive the package. The sender will see it was delivered.',
        ],
        nota: 'Don’t share your PIN by message with anyone other than the driver delivering it.',
      },
    ],
    drivers: [
      {
        id: 'drive-delivery',
        titulo: 'Delivering packages with Divoox Delivery',
        resumen: 'Pick up the package, take a photo of it and deliver it with the recipient’s PIN.',
        explicacion: [
          'The offer shows what you earn, how you get paid, the distance to the pickup and of the trip, the estimated time, where you pick up and where you take the package. If you don’t respond in time, it goes to the next driver.',
          'At pickup, tap “I’ve arrived”, get the package and take its photo: you can’t start without it. Then tap “Start ride” and take it to the drop-off address.',
          'When you get there, ask the recipient for the delivery PIN, enter it and tap “Deliver the package”. If the delivery is paid in cash, the app tells you how much to collect.',
        ],
        capturas: [
          c(
            'envios-driver-oferta',
            'en',
            'A delivery offer in Divoox Driver with the earnings, distance, time, pickup and drop-off addresses, and the Accept button.',
            'The offer: what you earn and the trip.',
          ),
          c(
            'envios-driver-foto',
            'en',
            'At pickup, the Take a photo of the package button, with the package description and who it’s for.',
            'At pickup, take the photo of the package.',
          ),
          c(
            'envios-driver-pin',
            'en',
            'Taking the package, with the delivery PIN box filled in and the Deliver the package button.',
            'At drop-off, enter the recipient’s PIN.',
          ),
        ],
        preguntas: [
          'How do I deliver a Divoox Delivery package?',
          'Why do I have to take a photo of the package?',
          'What do I do if the recipient doesn’t have the PIN?',
        ],
        pasos: [
          'Accept the offer and go to the pickup.',
          'Tap “I’ve arrived”, get the package and take its photo.',
          'Tap “Start ride” and take it to the drop-off address.',
          'Ask for the delivery PIN, enter it and tap “Deliver the package”.',
          'If the recipient doesn’t have the PIN, call support from the app.',
        ],
      },
    ],
  },
};

/**
 * C-DOCS-SEMANA (14 nov 2026, noche): «El tamaño de tu paquete» y «Paquetes por tamaño y foto de
 * entrega» se publican desde su borrador con capturas REALES (capturas-envios.mjs). «Reservar un viaje
 * para más tarde» sigue en borrador hasta tener su captura real.
 */
const CAPTURAS_TAMANO = {
  es: {
    cliente: [
      c(
        'envios-cliente-precio',
        'es',
        'Divoox Envíos con la dirección de recogida y de entrega y el precio fijo.',
        'Primero, las dos direcciones y el precio.',
      ),
      c(
        'envios-cliente-paquete',
        'es',
        'El formulario del envío con el tamaño del paquete elegido (sobre, pequeño, mediano o grande) y qué vehículos lo llevan.',
        'Elige el tamaño: debajo dice quién lo puede llevar.',
      ),
      c(
        'envios-cliente-pin',
        'es',
        'El envío pedido, buscando conductor, con el PIN de entrega para quien recibe.',
        'Listo: tu envío busca un conductor que pueda llevarlo.',
      ),
    ],
    conductor: [
      c(
        'envios-driver-oferta',
        'es',
        'La oferta de un envío de paquete en Divoox Driver con la ganancia, el recorrido y el botón Aceptar envío.',
        'Te llegan los envíos que caben en tu vehículo.',
      ),
      c(
        'envios-driver-foto',
        'es',
        'En la recogida, el botón para tomar la foto del paquete.',
        'Al recoger, la foto del paquete.',
      ),
      c(
        'envios-driver-pin',
        'es',
        'Llevando el paquete, con el PIN de entrega, el botón Agregar foto de la entrega y el botón Entregar el paquete.',
        'En la entrega: el PIN y, si quieres, la foto.',
      ),
    ],
  },
  en: {
    cliente: [
      c(
        'envios-cliente-precio',
        'en',
        'Divoox Delivery with the pickup and drop-off addresses and the fixed price.',
        'First, both addresses and the price.',
      ),
      c(
        'envios-cliente-paquete',
        'en',
        'The delivery form with the package size selected (envelope, small, medium, or large) and which vehicles can take it.',
        'Pick the size: below it says who can carry it.',
      ),
      c(
        'envios-cliente-pin',
        'en',
        'The delivery requested, looking for a driver, with the delivery PIN for the recipient.',
        'Done: your delivery is looking for a driver who can carry it.',
      ),
    ],
    conductor: [
      c(
        'envios-driver-oferta',
        'en',
        'A package delivery offer in Divoox Driver with the earnings, the trip, and the Accept delivery button.',
        'You get deliveries that fit your vehicle.',
      ),
      c(
        'envios-driver-foto',
        'en',
        'At pickup, the button to take a photo of the package.',
        'At pickup, the package photo.',
      ),
      c(
        'envios-driver-pin',
        'en',
        'Taking the package, with the delivery PIN, the Add a delivery photo button, and the Deliver the package button.',
        'At drop-off: the PIN and, if you want, a photo.',
      ),
    ],
  },
};

const publicar = (
  destino: Partial<Record<SeccionDocs['id'], Guia[]>>,
  borrador: { cliente: Guia[]; conductor: Guia[] },
  capturas: (typeof CAPTURAS_TAMANO)['es'],
) => {
  const tamano = borrador.cliente.find((g) => g.id === 'package-size');
  const conductor = borrador.conductor.find((g) => g.id === 'driver-package-size-photo');
  if (tamano) destino.ordering?.push({ ...tamano, capturas: [...capturas.cliente] });
  if (conductor) destino.drivers?.push({ ...conductor, capturas: [...capturas.conductor] });
};
publicar(GUIAS_FLEX_ENVIOS.es, BORRADORES_VIAJES_2.es, CAPTURAS_TAMANO.es);
publicar(GUIAS_FLEX_ENVIOS.en, BORRADORES_VIAJES_2.en, CAPTURAS_TAMANO.en);
