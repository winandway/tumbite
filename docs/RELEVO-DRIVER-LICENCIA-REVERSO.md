# Relevo: licencia de una cara y la Driver nueva (26 nov 2026)

Lo escribió la sesión «paquete chico y licencia» por orden de Gerencia: la sesión pasó el tope de tamaño. Venezuela, menos donde se dice otra cosa.

## Qué ya está hecho

- **Paquete chico:** en vivo en divoox.com desde main 65632e0, comprobado. La bandeja de Camila dice los motivos en frases, la firma es «Samira, de Soporte Divoox» y el aviso de «Cambiar ciudad» ya no sale con una sola elección.
- **Licencia de una cara (C-LICENCIA-REVERSO-OPCIONAL):** está en main (d711aacb91), pero **todavía no en producción**.
  - El frente de la licencia es obligatorio y basta. El reverso se ofrece como opcional y nunca sale en «te falta». La cédula sigue sin reverso.
  - La regla está en `politicaPlazoDeFabrica('VE')`, campos `sinReverso` y `reversoOpcional`.
  - Qué trae cada cara: `docs/VERIFICACION-DOCUMENTOS-VENEZUELA.md`. Los candados están en `CANDADOS.md`.
- **Conteo en producción del 26 nov:** cero conductores trabados por un reverso.
- **WhatsApp «lo que te falta»:** cerrado. Lo manda solo el vigilante automático, con sus topes. Gerencia dijo que se queda encendido.

## Lo que está en curso

- **La publicación de d711aacb91 a producción no pasó** (45866126853). Cayó en el semáforo porque la salud del sitio de pruebas dio 503: aprobadosNoElegibles, panicoZonas y regalos en error, tiempoReal atrasado y llegada en tope. Producción sigue en 65632e0.
- **La pasada del registro por ciudad** (45868305666, rama fase-registro-todo-pais) lleva unidas la privacidad (0ceb97ab1b) y el arreglo de pruebas (fcdd9c740d, que sube en su próximo empuje). Si sale en verde, su paso a main publica juntos la licencia, la privacidad y el registro. Esa sesión avisa el commit.
- **Pendiente:** cuando eso esté en vivo, comprobar la licencia en Venezuela. Con `GET /datos/conductor/verificacion?opcionales=1`, un conductor de moto de Venezuela tiene que ver `licencia_reverso` con `opcional: true`, y sin el parámetro no tiene que verlo.

## La Driver nueva (Android, com.windoce.tumbite.driver)

- **Lo que trae:** el paso opcional del reverso de la licencia, con «Saltar este paso» y el aviso «Puede mostrar datos de salud; solo se usa para verificar tu licencia». Archivos: `apps/repartidor/src/papeles/` (AsistentePapeles, logica y TusPapeles).
- **Google Play:** la 0.1.77 (versionCode 77) quedó publicada el 25 nov. No hay ninguna revisión en curso para Driver; lo comprobé en la consola con la cuenta go@windoce.com. El candado `play-en-revision` de Driver ya se archivó como aprobado.
- **La compilación de hoy** se detuvo a propósito, porque no traía el aviso de salud. No hay ningún archivo compilado que sirva.
- **El auditor de tiendas dio NO APTO.** Pidió esto:
  - **B1** (política: se lee la fecha de nacimiento) y **B2** (política: el reverso puede traer datos de salud): hechos en 0ceb97ab1b, en los dos idiomas y con la fecha al 26 nov. Salen con la rama del registro.
  - **B3:** en la consola de Play, Divoox Driver, Contenido de la app, Seguridad de los datos, dejar así:
    - «Información personal», «Otra información» (fecha de nacimiento): recogida y obligatoria, para Funcionalidad de la app y Prevención de fraude, seguridad y cumplimiento;
    - «Salud y actividad física», «Información de salud»: recogida y opcional, para Funcionalidad de la app;
    - Gemini cuenta como proveedor de servicio, no como «compartido».
  - **C1:** primero el servidor en producción y después la app.
  - **C2:** comprobar el paquete: que venga de la punta de main con todo, que el versionCode sea mayor que 77, que apunte a la API 36 y que tenga los mismos permisos que la 77. Y entrar con la cuenta de revisión de Driver.
  - **R1** (el aviso de salud en la pantalla): hecho.

## Pasos que faltan, en orden

1. Esperar a que la privacidad, la licencia y el registro estén en producción, y comprobar la licencia en vivo (arriba).
2. Compilar en esta Mac desde la punta de main: `node scripts/tiendas/compilar.mjs repartidor android production`.
3. Volver al auditor de tiendas con el archivo compilado, para que revise el punto C2 y dé el APTO.
4. Hacer el punto B3 en la consola de Play, en el mismo envío.
5. Subir a la pista de producción de Google Play, crear el candado `~/.config/tumbite/play-en-revision/com.windoce.tumbite.driver` y comprobar en «Actividad de envío».

## Otras cosas abiertas

- La rama `prep-privacidad-reverso` (fcdd9c740d) existe solo para pasarle el arreglo de pruebas al registro. Se puede borrar cuando esté en main.
- En el panel de producción, la salud marca «panicoZonas» en error. Lo vio el auditor y no viene de estos cambios.
- La lámina del INTT sobre qué trae cada cara de la licencia no se pudo abrir. Queda marcada como no comprobada en el documento de Venezuela.
