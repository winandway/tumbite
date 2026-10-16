# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recorrido.spec.ts >> recorrido completo de un pedido (es)
- Location: e2e/recorrido/recorrido.spec.ts:107:7

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByText('Pizza Bella xl23u')

```

# Page snapshot

```yaml
- generic [ref=e3]:
    - banner [ref=e4]:
        - link [ref=e5] [cursor=pointer]:
            - /url: /
            - img "Tumbite" [ref=e6]
        - generic [ref=e7]:
            - group [ref=e8]:
                - generic "Marco" [ref=e9] [cursor=pointer]
            - button "Cambiar idioma" [ref=e11] [cursor=pointer]:
                - generic [aria-hidden] [ref=e12]: 🇪🇸
                - text: ES
                - generic [aria-hidden] [ref=e13]: ▾
    - generic [ref=e14]:
        - navigation "Panel" [ref=e15]:
            - link "Inicio" [ref=e16] [cursor=pointer]:
                - /url: /panel
            - link "Mi restaurante" [ref=e17] [cursor=pointer]:
                - /url: /panel/restaurant
            - link "Mi empresa" [ref=e18] [cursor=pointer]:
                - /url: /panel/company
            - link "Menú" [ref=e19] [cursor=pointer]:
                - /url: /panel/menu
            - link "Pedidos" [ref=e20] [cursor=pointer]:
                - /url: /panel/orders
            - link "Beneficios" [ref=e21] [cursor=pointer]:
                - /url: /panel/earnings
            - link "Regalos y marketing" [ref=e22] [cursor=pointer]:
                - /url: /panel/gifts
        - main [ref=e23]:
            - generic [ref=e24]:
                - heading "Regalos y marketing" [level=1] [ref=e25]
                - paragraph [ref=e26]: 'Aparta un porcentaje de tus ventas para premiar a tus clientes fieles. No te guardamos dinero: cada regalo usado se descuenta de tu pago en ese pedido.'
                - generic [ref=e27]:
                    - generic [ref=e28]:
                        - generic [ref=e29]: Acumulado
                        - strong [ref=e30]: $4.50
                    - generic [ref=e31]:
                        - generic [ref=e32]: Regalado
                        - strong [ref=e33]: $0.00
                    - generic [ref=e34]:
                        - generic [ref=e35]: Disponible para regalar
                        - strong [ref=e36]: $4.50
                    - generic [ref=e37]:
                        - generic [ref=e38]: Regalos usados
                        - strong [ref=e39]: '0'
                - generic [ref=e40]:
                    - generic [ref=e41]:
                        - generic [ref=e42]: Porcentaje de tus ventas para regalos
                        - generic [ref=e43]:
                            - 'textbox "Porcentaje de tus ventas para regalos % Recomendado: 3 %" [ref=e44]': '20'
                            - emphasis [ref=e45]: '%'
                        - generic [ref=e46]: 'Recomendado: 3 %'
                    - group [ref=e47]:
                        - generic [ref=e48]:
                            - checkbox "Regalo de cumpleaños" [checked] [ref=e49]
                            - text: Regalo de cumpleaños
                        - generic [ref=e53]: A clientes que ya te compraron, una vez al año, cerca de su cumpleaños.
                        - generic [ref=e54]:
                            - generic [ref=e55]: Plato de regalo
                            - combobox "Plato de regalo" [ref=e56]:
                                - option "Elige un plato"
                                - option "Limonada de coco · $4.50"
                                - option "Nudos de ajo · $3.00" [selected]
                                - option "Pizza margarita · $14.00"
                    - group [ref=e57]:
                        - generic [ref=e58]:
                            - checkbox "Tarjeta de sellos" [checked] [ref=e59]
                            - text: Tarjeta de sellos
                        - generic [ref=e62]: Al completar estos pedidos, un plato gratis.
                        - generic [ref=e63]:
                            - generic [ref=e64]: Pedidos para completar la tarjeta
                            - spinbutton "Pedidos para completar la tarjeta" [ref=e65]: '10'
                        - generic [ref=e66]:
                            - generic [ref=e67]: Plato de regalo
                            - combobox "Plato de regalo" [ref=e68]:
                                - option "Elige un plato" [selected]
                                - option "Limonada de coco · $4.50"
                                - option "Nudos de ajo · $3.00"
                                - option "Pizza margarita · $14.00"
                    - group [ref=e69]:
                        - generic [ref=e70]:
                            - checkbox "Cliente que vuelve" [ref=e71]
                            - text: Cliente que vuelve
                        - generic [ref=e77]: Descuento a quien lleva tiempo sin pedir.
                    - status [ref=e78]: Guardado
                    - button "Guardar" [active] [ref=e79] [cursor=pointer]
    - button "Ayuda" [ref=e81] [cursor=pointer]
```

# Test source

```ts
  538 |     await rep.getByLabel(L.clave, { exact: true }).fill(DATOS.clave);
  539 |     await rep.getByRole('button', { name: L.crearCuenta }).click();
  540 |     // Identidad continua: al intentar conectarse, la app le pide una foto de control (en el
  541 |     // recorrido se pide siempre). La toma y recién ahí se conecta.
  542 |     await rep
  543 |       .getByRole('switch')
  544 |       .or(rep.getByRole('button', { name: L.conectarme }))
  545 |       .first()
  546 |       .click();
  547 |     await expect(rep.getByRole('button', { name: L.tomarSelfie })).toBeVisible({ timeout: 20_000 });
  548 |     await foto(rep, 'repartidor-foto-identidad');
  549 |     const [selectorSelfie] = await Promise.all([
  550 |       rep.waitForEvent('filechooser'),
  551 |       rep.getByRole('button', { name: L.tomarSelfie }).click(),
  552 |     ]);
  553 |     await selectorSelfie.setFiles(FOTO_RECOGIDA);
  554 |     await expect(rep.getByText(L.selfieLista)).toBeVisible({ timeout: 20_000 });
  555 |     await rep
  556 |       .getByRole('switch')
  557 |       .or(rep.getByRole('button', { name: L.conectarme }))
  558 |       .first()
  559 |       .click();
  560 |     await expect(
  561 |       rep.getByText(/Online: receiving orders|Conectado: recibiendo pedidos/),
  562 |     ).toBeVisible();
  563 |     await foto(rep, 'repartidor-conectado');
  564 |
  565 |     // 5. El cliente se registra, elige, arma el carrito y paga.
  566 |     const cliCtx = await nuevoContexto('celular', CASA);
  567 |     const cli = await cliCtx.newPage();
  568 |     cli.on('pageerror', (e) => console.error('app del cliente:', e.message));
  569 |     cli.on(
  570 |       'console',
  571 |       (m) => m.type() === 'error' && console.error('consola del cliente:', m.text()),
  572 |     );
  573 |     await cli.goto('/app/');
  574 |     await cli.getByText(L.appCrear).click();
  575 |     await cli.getByLabel(L.nombreCompleto).fill('Ana García');
  576 |     await cli.getByLabel(L.correo).fill(correo('cliente'));
  577 |     await cli.getByLabel(L.celular).fill('3055550103');
  578 |     // Cumple hoy: así, después de su primer pedido, le toca el regalo de cumpleaños.
  579 |     const hoy = new Date().toISOString().slice(5, 10);
  580 |     await cli.getByLabel(L.cumple).fill(`1995-${hoy}`);
  581 |     await cli.getByLabel(L.clave, { exact: true }).fill(DATOS.clave);
  582 |     await foto(cli, 'cliente-registro');
  583 |     await cli.getByRole('button', { name: L.crearCuenta }).click();
  584 |     await expect(cli.getByText(restaurante)).toBeVisible({ timeout: 20_000 });
  585 |     await cli.waitForTimeout(CAPTURAS ? 1500 : 0);
  586 |     await foto(cli, 'cliente-inicio');
  587 |     // «Comida» abre la lista de restaurantes (diseño aprobado del 14 oct) y de ahí, el menú.
  588 |     await cli.getByRole('button', { name: /^(Comida|Food)$/ }).click();
  589 |     await expect(cli.getByLabel(/Buscar restaurantes|Search restaurants/)).toBeVisible();
  590 |     const enLista = cli.getByText(restaurante).filter({ visible: true });
  591 |     await expect(enLista).toBeVisible({ timeout: 20_000 });
  592 |     await foto(cli, 'cliente-restaurantes');
  593 |     await enLista.click();
  594 |     await expect(
  595 |       cli.getByText(idioma === 'en' ? 'Margherita pizza' : 'Pizza margarita'),
  596 |     ).toBeVisible();
  597 |     await foto(cli, 'cliente-menu');
  598 |     const plato = {
  599 |       pizza: idioma === 'en' ? 'Margherita pizza' : 'Pizza margarita',
  600 |       limonada: idioma === 'en' ? 'Coconut lemonade' : 'Limonada de coco',
  601 |       nudos: idioma === 'en' ? 'Garlic knots' : 'Nudos de ajo',
  602 |     };
  603 |     type Cobro = {
  604 |       pedidoId: string;
  605 |       clientSecret: string;
  606 |       desglose: {
  607 |         totalCliente: number;
  608 |         pagoRestaurante: number;
  609 |         pagoRepartidor: number;
  610 |         gananciaPlataforma: number;
  611 |       };
  612 |     };
  613 |     /** El restaurante rechaza un pedido desde los tres puntos de su fila (el cliente recibe su dinero). */
  614 |     const rechazarEnPanel = async (pedidoId: string) => {
  615 |       await panel.getByRole('link', { name: L.pedidos, exact: true }).click();
  616 |       const codigo = pedidoId.slice(0, 4).toUpperCase();
  617 |       // La fila de ESE pedido: el ⋮ que está junto a su número.
  618 |       const fila = panel
  619 |         .locator('strong', { hasText: `#${codigo}` })
  620 |         .locator(`xpath=ancestor::*[.//button[@aria-label="${L.masOpciones}"]][1]`);
  621 |       await expect(fila).toBeVisible({ timeout: 20_000 });
  622 |       panel.once('dialog', (d) => void d.accept());
  623 |       await fila.getByRole('button', { name: L.masOpciones }).click();
  624 |       await panel.getByRole('menuitem', { name: L.rechazar }).click();
  625 |       await expect(panel.locator('strong', { hasText: `#${codigo}` })).toContainText(
  626 |         /Canceled|Cancelado/,
  627 |       );
  628 |     };
  629 |     /** Del menú al pago: agrega los platos, va al carrito, paga y el banco aprueba (simulado). */
  630 |     const pedirYPagar = async (
  631 |       platos: string[],
  632 |       fotoCarrito?: string,
  633 |       modo?: 'recoger',
  634 |     ): Promise<Cobro> => {
  635 |       if (!cli.url().includes('/restaurant/')) {
  636 |         await cli.goto('/app/');
  637 |         try {
> 638 |           await cli.getByText(restaurante).click({ timeout: 15_000 });
      |                                            ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  639 |         } catch (e) {
  640 |           console.error(
  641 |             'DEPURAR inicio:',
  642 |             cli.url(),
  643 |             (await cli.locator('body').innerText()).slice(0, 800),
  644 |           );
  645 |           await cli.screenshot({ path: join(RAIZ, 'test-results', 'depurar-inicio.png') });
  646 |           throw e;
  647 |         }
  648 |       }
  649 |       for (const p of platos) {
  650 |         await cli
  651 |           .getByRole('button', { name: `${L.agregar} ${p}` })
  652 |           .filter({ visible: true })
  653 |           .click();
  654 |         // La pizza pide tamaño: se elige «Grande» (+4) y se agrega.
  655 |         if (p === plato.pizza) {
  656 |           const grande = cli.getByRole('radio', { name: L.grande });
  657 |           await expect(grande).toBeVisible({ timeout: 10_000 });
  658 |           if (fotoCarrito) {
  659 |             await cli.waitForTimeout(900); // la ventana termina de subir
  660 |             await foto(cli, 'cliente-opciones');
  661 |           }
  662 |           await grande.click();
  663 |           await cli.getByRole('button', { name: L.agregarAlCarrito }).click();
  664 |         }
  665 |       }
  666 |       await cli.getByRole('button', { name: L.verCarrito }).filter({ visible: true }).click();
  667 |       if (modo === 'recoger') {
  668 |         // Recogida en el local: sin dirección ni envío.
  669 |         await cli.getByRole('radio', { name: L.recojo }).click();
  670 |         await expect(cli.getByLabel(L.direccionEntrega)).toHaveCount(0);
  671 |       } else {
  672 |         // El borrador del carrito recuerda la última elección: se vuelve a «En la puerta».
  673 |         await cli.getByRole('radio', { name: L.enPuerta }).click();
  674 |         await cli.getByLabel(L.direccionEntrega).fill('200 S Biscayne Blvd, Apt 12');
  675 |       }
  676 |       if (fotoCarrito) {
  677 |         await mapaListo(cli);
  678 |         // Para Docs: cómo se ve «En mano» con el interruptor del PIN; luego vuelve a «En la puerta».
  679 |         await cli.getByRole('radio', { name: L.enMano }).click();
  680 |         await expect(cli.getByRole('switch', { name: L.pinTitulo })).toBeVisible();
  681 |         await cli.getByRole('switch', { name: L.pinTitulo }).scrollIntoViewIfNeeded();
  682 |         await foto(cli, 'cliente-carrito-mano');
  683 |         await cli.getByRole('radio', { name: L.enPuerta }).click();
  684 |         await cli.getByText(L.continuarPago).filter({ visible: true }).scrollIntoViewIfNeeded();
  685 |         await foto(cli, fotoCarrito);
  686 |       }
  687 |       const [respuesta] = await Promise.all([
  688 |         cli.waitForResponse(
  689 |           (r) => r.url().endsWith('/datos/pedidos') && r.request().method() === 'POST',
  690 |         ),
  691 |         cli.getByText(L.continuarPago).filter({ visible: true }).click(),
  692 |       ]);
  693 |       expect(respuesta.status()).toBe(201);
  694 |       const c = (await respuesta.json()) as Cobro;
  695 |       // El banco AUTORIZA la tarjeta (se cobra al entregar): aviso firmado de Stripe, como el de verdad.
  696 |       await avisoStripe('payment_intent.amount_capturable_updated', {
  697 |         id: c.clientSecret.split('_secret')[0],
  698 |         amount_capturable: c.desglose.totalCliente,
  699 |         metadata: { pedido_id: c.pedidoId },
  700 |       });
  701 |       // El dinero cuadra al centavo: lo que paga el cliente se reparte entero.
  702 |       const d = c.desglose;
  703 |       expect(d.pagoRestaurante + d.pagoRepartidor + d.gananciaPlataforma).toBe(d.totalCliente);
  704 |       return c;
  705 |     };
  706 |     const cobro = await pedirYPagar([plato.pizza, plato.limonada], 'cliente-carrito');
  707 |     // Al pagar, la app abre el pedido con la confirmación «¡Pedido realizado!» (diseño del 14 oct).
  708 |     await cli.goto(`/app/order/${cobro.pedidoId}?nuevo=1`);
  709 |     await expect(cli.getByText(/Payment received|Recibimos tu pago|Pago recibido/)).toBeVisible();
  710 |     await expect(cli.getByText(/Order placed!|¡Pedido realizado!/)).toBeVisible();
  711 |     await foto(cli, 'cliente-pagado');
  712 |     await cli.getByRole('button', { name: /Track order|Ver seguimiento/ }).click();
  713 |     await expect(cli.getByText(/Confirmed|Confirmado/)).toBeVisible();
  714 |
  715 |     // 6. El restaurante acepta con su tiempo y avisa que está listo.
  716 |     await panel.getByRole('link', { name: L.pedidos, exact: true }).click();
  717 |     await expect(panel.getByText(cobro.pedidoId.slice(0, 4).toUpperCase()).first()).toBeVisible({
  718 |       timeout: 20_000,
  719 |     });
  720 |     await foto(panel, 'restaurante-pedido-nuevo');
  721 |     // Para las tiendas: la app del restaurante en celular y en tableta, con el mismo pedido.
  722 |     // La app del restaurante (diseño del 14 oct) se maneja en cada corrida, en celular; en el modo
  723 |     // de tiendas también en tableta. La de celular acepta, marca listo y ve la recogida.
  724 |     const restApps: Page[] = [];
  725 |     {
  726 |       for (const tipo of TIENDA ? (['celular', 'tableta'] as const) : (['celular'] as const)) {
  727 |         const ctx = await nuevoContexto(tipo);
  728 |         const p = await ctx.newPage();
  729 |         await p.goto('/restaurant/');
  730 |         await expect(p.getByLabel(L.correo)).toBeVisible({ timeout: 20_000 });
  731 |         await foto(p, 'restapp-entrar');
  732 |         await p.getByLabel(L.correo).fill(correo('restaurante'));
  733 |         await p.getByLabel(L.clave, { exact: true }).fill(DATOS.clave);
  734 |         await p.getByRole('button', { name: idioma === 'en' ? 'Sign in' : 'Entrar' }).click();
  735 |         await expect(
  736 |           p.getByText(`#${cobro.pedidoId.slice(0, 4).toUpperCase()}`).first(),
  737 |         ).toBeVisible({ timeout: 20_000 });
  738 |         await foto(p, 'restapp-nuevo');
```
