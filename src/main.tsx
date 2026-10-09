import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Limpeza única de dados salvos de testes locais para lançamento oficial limpo
const LAUNCH_CLEAN_KEY = 'lanhouse_launch_clean_v1';
try {
  if (!localStorage.getItem(LAUNCH_CLEAN_KEY)) {
    localStorage.clear();
    localStorage.setItem(LAUNCH_CLEAN_KEY, 'true');
  }
} catch (e) {
  console.warn('Storage init:', e);
}

createRoot(document.getElementById('root')!).render(<App />);
