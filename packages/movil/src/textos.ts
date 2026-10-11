import type { Idioma } from '@tumbite/compartido';

const es = {
  entrar: 'Entrar',
  crearCuenta: 'Crear cuenta',
  yaTengo: '¿Ya tienes cuenta? Entra',
  noTengo: '¿Eres nuevo? Crea tu cuenta',
  olvide: '¿Olvidaste tu contraseña?',
  nombre: 'Nombre y apellido',
  correo: 'Correo',
  clave: 'Contraseña',
  telefono: 'Celular',
  cumple: 'Fecha de cumpleaños (opcional, AAAA-MM-DD)',
  cumpleAyuda: 'Para tu regalo de cumpleaños',
  verClave: 'Ver la contraseña',
  ocultarClave: 'Ocultar la contraseña',
  recuperado: 'Recuperamos lo que estabas escribiendo.',
  empezarDeNuevo: 'Empezar de nuevo',
  enviando: 'Un momento…',
  salir: 'Cerrar sesión',
  hola: 'Hola',
  rolEquivocado:
    'Esta cuenta no es de esta app. Descarga la app de Tumbite que corresponde a tu cuenta.',
  soloPanel: 'Las cuentas de restaurante se crean en tumbite.com/panel. Aquí solo entras.',
};

type T = typeof es;

const en: T = {
  entrar: 'Sign in',
  crearCuenta: 'Create account',
  yaTengo: 'Already have an account? Sign in',
  noTengo: 'New here? Create your account',
  olvide: 'Forgot your password?',
  nombre: 'Full name',
  correo: 'Email',
  clave: 'Password',
  telefono: 'Mobile phone',
  cumple: 'Birthday (optional, YYYY-MM-DD)',
  cumpleAyuda: 'For your birthday gift',
  verClave: 'Show password',
  ocultarClave: 'Hide password',
  recuperado: 'We restored what you were typing.',
  empezarDeNuevo: 'Start over',
  enviando: 'One moment…',
  salir: 'Sign out',
  hola: 'Hi',
  rolEquivocado:
    'This account doesn’t belong to this app. Please download the Tumbite app for your account type.',
  soloPanel: 'Restaurant accounts are created at tumbite.com/panel. Sign in here.',
};

export const TEXTOS_MOVIL: Record<Idioma, T> = { es, en };
