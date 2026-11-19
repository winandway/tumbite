# Banco de reportes de fallo (C-CAMILA-REPORTE-CONVERSADO)

`banco-reporte.prueba.ts` corre cuatro conversaciones de reporte de fallo contra el modelo REAL, con
una captura de verdad. La primera es la conversación de Richard del 19 de noviembre de 2026, tal
cual. Se corre a mano, nunca en la verificación automática (cuesta menos de un centavo de dólar).

En ninguna conversación puede salir una pregunta del guion viejo, pedirse un contacto que la persona
ya dio ni decirse «asistente virtual»; todas terminan con su número de caso.

Cómo se corre: copiar `banco-reporte.prueba.ts` a `apps/servidor/src/camila/_banco.test.ts`, correr
`SALIDA=/ruta/salida.md npx vitest run src/camila/_banco.test.ts` dentro de `apps/servidor` y borrar
la copia. La llave se lee de `~/.config/tumbite/gemini-api-key`.
