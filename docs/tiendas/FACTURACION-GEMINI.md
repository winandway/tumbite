# Cómo confirmar que la llave de Gemini tiene facturación de pago

Por qué importa: con permiso de IA, el chat de ayuda y las fotos del asistente de papeles pasan por
Gemini. Con una cuenta de pago, Google no usa esos datos para mejorar sus productos; en un proyecto
gratuito sí podría. Las notas para los revisores de Apple y Google dicen «paid API terms», así que
tiene que seguir siendo verdad. La llave nunca se imprime ni se escribe en el repositorio: vive en
las variables de los sitios (`GEMINI_API_KEY`) y en una copia local de la Mac (archivo `gemini-api-key`
de la carpeta de configuración de Tumbite). Proyecto, cuenta y tarjeta están en el registro privado
de proveedores de IA de esa misma carpeta.

## 1. Que la llave funciona (lo hace la IA, sin mostrarla)

```bash
cd /Users/windocellc/Divoox && curl -s -o /dev/null -w 'codigo %{http_code}\n' -H "x-goog-api-key: $(cat ~/.config/tumbite/gemini-api-key)" https://generativelanguage.googleapis.com/v1beta/models
```

- `codigo 200`: la llave es válida. Comprobado el 21 nov 2026.
- `400` o `403`: la llave fue anulada o el proyecto no tiene la API activa.
- Esto NO dice si el proyecto es de pago: la API no lo informa.

## 2. Que el proyecto es de pago (en la pantalla de Google, con la cuenta dueña del proyecto)

1. Entrar a Google AI Studio con la cuenta dueña del proyecto (la del registro privado).
2. Abrir la página de límites activos (la documentación oficial de límites la enlaza con el botón
   «View your active rate limits in AI Studio»): https://aistudio.google.com/rate-limit
3. Elegir el proyecto de la llave. El nivel tiene que decir **Tier 1** (o superior). Si dice **Free**,
   el proyecto perdió la facturación: es un fallo y se avisa a Gerencia ese mismo día, porque las notas
   de las tiendas dejarían de ser verdad.
4. Opcional: en la página de llaves de AI Studio (https://aistudio.google.com/apikey) la fila de la llave
   muestra el mismo proyecto y su plan.

## 3. Señal en producción si se acaba el saldo

El proyecto es prepago. Si se acaba el saldo, Gemini responde `429` y Camila sigue contestando sin IA
(Docs y respuestas aprobadas); el fallo queda en el registro de errores. Eso no cambia el nivel del
proyecto, pero hay que recargar.

## Estado conocido

- 21 nov 2026: nivel de pago (Tier 1, prepago), confirmado en el sexto dictamen del auditor de tiendas.
  Llave válida (`codigo 200`) el mismo día.
- Pendiente recomendado: un proyecto de Gemini propio de Divoox, para no compartir el saldo.
