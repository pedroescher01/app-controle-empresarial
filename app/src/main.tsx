import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { DadosProvider } from './lib/hooks';
import './styles.css';
import { iniciarNuvem } from './lib/nuvem';

iniciarNuvem();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DadosProvider>
      <App />
    </DadosProvider>
  </StrictMode>,
);
