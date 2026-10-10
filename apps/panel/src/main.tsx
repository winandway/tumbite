import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Inicio } from './Inicio';
import './estilos.css';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Falta el elemento #raiz');
createRoot(raiz).render(
  <StrictMode>
    <Inicio />
  </StrictMode>,
);
