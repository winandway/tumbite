# Verificación de identidad AUTOMÁTICA, con módulo propio (29 oct 2026) — EE. UU. primero; luego cada país

Pedido de Richard: que la verificación no dependa de una persona. Un módulo nuestro, con IA, que lea el
documento, compruebe que la cara de la selfie es la del documento y que es una persona viva, y le diga a
la persona al instante si quedó verificada. Que pida en EE. UU. lo que piden los grandes (licencia,
número de seguro social, datos para impuestos), copiado de cómo lo hacen.

## 1. Cómo se hace hoy (evidencia)

- [REA] Código abierto **Idswyft** (licencia MIT, `team-idswyft/idswyft-community`), analizado sin
  ejecutarlo. Paquete `evidencia-rea-2026-10-29-kyc-automatico.json`, evidencia del análisis
  `ev_18016b9bf017da29e4743ff72ab5d77d60486622439a11e72787f2f0a2281d72` (raíz del motor
  `4ad450e8…642b`). Su motor:
  - **Cara:** `@vladmandic/face-api` (licencia MIT, corre con TensorFlow en el servidor). Hace tres cosas:
    encontrar la cara (SSD MobileNet), sacar 68 puntos de la cara y convertir la cara en una «huella» de
    números (128 valores). Dos fotos son de la misma persona si las huellas se parecen lo suficiente
    (umbral de similitud 0,60 en producción).
  - **Persona viva:** le pide a la persona girar la cabeza y sigue los puntos de la cara entre fotos; así
    una foto impresa o una pantalla no pasan (umbral 0,75).
  - **Documento:** lee el **código de barras PDF417** del reverso de las licencias de EE. UU. (formato
    AAMVA, librería `parse-usdl`) y la **franja de lectura del pasaporte** (MRZ, librería `mrz`); lee el
    frente con OCR (`ppu-paddle-ocr`). **Cruza** los datos: el nombre, la fecha de nacimiento, el número
    y la fecha de vencimiento del código de barras tienen que coincidir con el frente.
  - **Falsificación:** busca señales de imagen alterada o generada (análisis de frecuencias, colores).
  - **Decisión:** si todo pasa los umbrales, aprobado al instante; si algo queda en duda, va a revisión de
    una persona con el motivo escrito.
- [REA] Uber (blog de ingeniería): la foto de perfil verificada es la referencia y las selfies al azar se
  comparan con ella; si no coincide, bloqueo temporal (ver la ficha de identidad del mismo día).
- [DOC] Stripe Connect: Stripe pide y verifica el **número de identificación fiscal** (seguro social o
  ITIN) de cada repartidor, lo comprueba con la base del IRS y prepara los formularios **1099** (1099-NEC
  para contratistas o 1099-K). Con cuentas Express, Divoox es quien los presenta, con la herramienta de
  Stripe. Divoox **no guarda** el número de seguro social.
- [DOC] Requisitos de los grandes (fuentes de terceros, confirmar en sus páginas oficiales): 18 años o
  más (19 en algunos estados), licencia vigente si reparte en carro, seguro social o ITIN para la
  verificación de antecedentes y los impuestos, verificación de antecedentes con un proveedor (Checkr).
- [INF] Permiso de trabajo: un repartidor es contratista independiente, no empleado. El formulario I-9
  de permiso de trabajo es para empleados. Lo que piden los grandes es el número fiscal (seguro social o
  ITIN) y la verificación de antecedentes. Confirmar con el abogado.

## 2. El módulo de Divoox (diseño)

Un **motor de verificación propio** (servicio aparte, en un contenedor), copiado de la arquitectura de
Idswyft, que el servidor llama por una ruta firmada. Pasos, en este orden:

1. **Documento:** el repartidor fotografía el frente y el reverso (o el pasaporte). El motor lee el código
   de barras o la franja, cruza los datos con el frente, revisa que no esté vencido y que tenga la edad.
2. **Persona viva:** la app le pide mirar a la cámara y girar la cabeza a un lado y al otro (tres fotos).
3. **Cara:** compara la cara de la selfie con la del documento; si coincide, la selfie queda como su foto
   de perfil verificada (ya construido, C-FOTO-VERIFICADA).
4. **Caras repetidas:** compara la huella con las de cuentas cerradas por mala conducta; si se parece, va a
   revisión del equipo (nunca se rechaza solo por esto).
5. **Decisión al instante:** todo verde, «verificado» en segundos; algo dudoso, «en revisión» y el equipo
   ve el motivo; documento vencido o cara distinta, «hay que repetir» con la explicación.
6. **Impuestos y antecedentes:** el número de seguro social o ITIN lo pide Stripe al conectar la cuenta
   para cobrar (y la verificación de antecedentes, Checkr). Divoox no lo guarda.

Se guarda solo la **huella de la cara** (números), las fotos privadas y el resultado. Todo con su
consentimiento escrito antes de tomar la selfie, y se borra al cerrar la cuenta (salvo la huella de una
cuenta cerrada por mala conducta, si el abogado lo aprueba).

## 2b. Lo construido (29 oct, noche)

- Documento: licencia de EE. UU. desde la foto del reverso (código de barras) y pasaporte desde la franja,
  con corrección por posición y dígitos de control; el frente se cruza buscando en su texto los datos del
  código. Candados C-KYC-DOCUMENTO, C-KYC-CODIGO-FOTO y C-KYC-OCR.
- Caras: selfie contra documento, persona viva con el giro de cabeza y caras repetidas contra la lista de
  mala conducta. Candado C-KYC-CARAS. Todo corre sin internet, con las librerías de código abierto.

## 3. Lo que decide Richard

- **Dónde corre el motor:** necesita un contenedor (no cabe en YaDominios Cloud ni en un Worker normal).
  Opción recomendada: contenedores de Cloudflare en la cuenta de Divoox (plan de pago de Workers, unos
  5 dólares al mes más el uso). Es un recurso nuevo con costo: espera su sí.
- **Consentimiento biométrico:** el texto lo aprueba el abogado (Illinois, Texas y Washington son estrictos).

## 4. Pruebas de aceptación

- Una licencia de prueba (de las muestras públicas de AAMVA) se lee y sus datos se cruzan con el frente.
- Una licencia vencida o de un menor de edad no pasa.
- Una foto de una foto (sin girar la cabeza) no pasa la prueba de vida.
- Dos fotos de la misma persona coinciden; de personas distintas, no.
- Sin el motor encendido, todo sigue como hoy: revisión del equipo.
