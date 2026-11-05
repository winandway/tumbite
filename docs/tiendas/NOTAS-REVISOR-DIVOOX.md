# Notas para el revisor de Apple: Divoox (app del cliente)

Escritas el 4 nov 2026 con el dictamen previo del auditor de tiendas (B1). Reemplazan las que están cargadas hoy en App Store Connect («App Review Information» → «Notes»), que dicen cosas que ya no son ciertas: «work from any location», «starting from launch» y un camino de borrado viejo. **No se cargan todavía**: se cargan junto con la respuesta, con el APTO del auditor y el sí de Richard. La contraseña de la cuenta de prueba va solo en el formulario de Apple, nunca aquí.

## Texto para pegar (en inglés)

```
ONE MARKETPLACE, THREE APPS: Divoox, Divoox Driver and Divoox Restaurants are the three sides of one delivery marketplace owned and operated by Windoce LLC, like DoorDash, Dasher and DoorDash Merchant. Each app is for a different person with a different job and different permissions.

WHERE TO TEST: Divoox is live in Novi, Michigan. Please use the address 27500 Novi Rd, Novi, MI 48377 ("Deliver to" at the top of the home screen, then pick the suggestion). Outside the live area the app correctly shows that there is no coverage yet. The review restaurant, Divoox Review Kitchen, is open 24 hours during the review.

HOW TO USE IT: You can browse restaurants and menus without an account. The account is asked for at checkout. A new account confirms its email before paying: the app shows "Confirm your email", the email "Confirm your Divoox email" has a "Confirm my email" button, and the app then shows "Your email is verified" and goes back to the cart. The demo account below already has its email confirmed, so it goes straight to the cart.

DEMO ACCOUNT: sign in with the customer demo account in the fields below. Add dishes from Divoox Review Kitchen, tap "View cart", then "Continue to payment". Paying is optional for review: everything up to the payment sheet can be reviewed without a charge. Purchases are physical goods (food and delivery) and use Stripe, not in-app purchase.

ACCOUNT DELETION: My account > "⋮" (below "Sign out") > "Delete my account" > type DELETE > "Delete my account" > "Your account was deleted". It happens inside the app. A new account that has not confirmed its email can also be deleted from the "Confirm your email" screen.

LOCATION AND MAPS: the customer's location is only used while the app is open. Maps on iPhone use Apple Maps; address suggestions use Google Maps Platform.

BUILD AND SCREEN RECORDING: build 30. The recording is attached, made on a physical iPhone running the latest iOS. It starts on the Home Screen, opens the app, creates a new account, confirms the email, shows the main flow, signs out and in, and deletes the account.
```

## Antes de cargarlas

- Que el video adjunto de verdad empiece en la pantalla de inicio y muestre todo lo que dice el último párrafo. Si no, se corrige el párrafo, no se deja una frase falsa.
- Entrar con la cuenta de prueba en la compilación que se manda, en producción, el mismo día (lo hace Richard).
