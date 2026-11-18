# Banco de preguntas de visitante (C-CAMILA-VISITANTE)

`banco-visitante.txt` trae cuarenta preguntas reales de un visitante sin cuenta (las treinta primeras
en español, las diez últimas en inglés). Se corren contra el modelo REAL, a mano, nunca en la
verificación automática (cuesta unos dos centavos de dólar). Ninguna respuesta puede ser «no
entendí», decir «asistente virtual» ni inventar un precio.

Cómo se corre: copiar `banco-visitante.prueba.ts` a `apps/servidor/src/camila/_banco.test.ts`,
correr `SALIDA=/ruta/salida.md npx vitest run src/camila/_banco.test.ts` dentro de `apps/servidor`
y borrar la copia. La llave se lee de `~/.config/tumbite/gemini-api-key`.
