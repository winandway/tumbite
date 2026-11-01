# Cómo probar la logística de Divoox (Divoox Flex) con tu impresora

Para Richard, 31 oct 2026 (al día el 1 nov). Todo es en producción (divoox.com), con las apps de
TestFlight, en Novi y Walled Lake (Michigan). No se mueve dinero: Flex no cobra.

**Antes de esta guía, lee las dos de base:** el documento «LOGISTICA-COMO-FUNCIONA» (quién usa qué
y el día de trabajo) y la guía pública «Empieza con Divoox Flex» en Docs (paso a paso con las
pantallas reales).

## Quién es quién en esta prueba

- **La empresa** es la cuenta del cliente del revisor: entra en la computadora a divoox.com, menú
  de la cuenta → «Divoox Flex (empresas)». Es la dueña de «Divoox Demo Logística».
- **El conductor** es la cuenta de Driver del revisor, en la app Divoox Driver de TestFlight. Ya
  está en la empresa.
- **Quien recibe** es la cuenta del cliente del revisor en la app Divoox (o cualquiera con el
  número de seguimiento).

## Lo que ya está armado para ti

- La empresa **Divoox Demo Logística**, con sus datos legales y su centro: **Centro Demo Novi**
  (43000 Grand River Ave, Novi).
- **Seis envíos** por Walled Lake y Novi: cinco a la puerta y uno en un **punto de encuentro**
  (la estación de servicio de 13 Mile y Novi Rd), para que veas cómo avisa al llegar.
- Una **ruta** con los seis, asignada a la cuenta de Driver del revisor (la que usaste para el video).
- Las **seis etiquetas en un PDF** listo para imprimir: se llama etiquetas-demo-logistica, en la
  carpeta privado del proyecto. Te lo mando al chat.
- El primer envío va a la cuenta del cliente del revisor: lo vas a ver en la app Divoox, en
  «Mis paquetes».

## La prueba, paso a paso

1. **Imprime** el PDF de las etiquetas y pega cada una en una caja o en un sobre.
2. **Driver** (con la cuenta del revisor): entra a «Mi ruta», acepta la ruta y toca «Llegué al
   centro» cuando estés en el centro.
3. **Carga:** escanea las seis etiquetas con la cámara. Cuando estén todas, aparece «Salir a la ruta».
4. **En la calle:** toca «Parada actual». En cada parada:
   - escanea la etiqueta de ese paquete («1 de 1 paquetes escaneados»);
   - si te pide foto, tómala; elige dónde lo dejaste;
   - desliza para finalizar.
     El sistema no deja entregar a más de 200 metros de la dirección: tienes que estar ahí.
5. **Del lado de quien recibe** (otro teléfono, o el mismo con la app Divoox):
   - entra con la cuenta del cliente del revisor → Mi cuenta → Mis paquetes: ahí está el primer
     envío, con el mapa;
   - o toca «Rastrear un paquete» y escribe o escanea cualquier número de seguimiento (empieza
     con DVX) de las etiquetas: lo sigues y te llegan los avisos.
   - Cuando el conductor esté a menos de 800 metros (1,5 km si es el punto de encuentro), llega el
     aviso **«Tu paquete ya llega»**, con el nombre del conductor, el vehículo y la placa.
6. **Al terminar:** «Terminar entregas y volver al centro» y después «Cerrar la ruta».

## Para hacer otra ruta igual

En la computadora del proyecto:

```bash
cd /Users/windocellc/Divoox && node scripts/produccion/armar-demo-logistica.mjs
```

Arma seis envíos nuevos, otra ruta y un PDF nuevo de etiquetas.

## Si quieres probar también la invitación de un conductor

1. En el panel: «Conductores» → «Invitar conductor». Escribe un nombre y TU celular (o un correo
   tuyo que no sea de una cuenta de restaurante).
2. Te llega el enlace por correo (y por SMS cuando Twilio apruebe el número). En el panel también
   aparece el enlace con «Mandar por WhatsApp».
3. Abre el enlace en el celular: dice qué empresa te invita y cómo instalar Divoox Driver.
4. En Divoox Driver, crea una cuenta con ese mismo celular o correo: en el inicio aparece «Divoox
   Demo Logística te invitó». Toca «Aceptar».

## Lo que todavía depende de otros

- **Mensajes de texto en EE. UU.:** salen solos cuando Twilio apruebe el número gratuito (en
  revisión desde el 31 oct).
