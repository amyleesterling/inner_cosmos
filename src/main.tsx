import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

/*
 * ─── A note for whoever reads this ──────────────────────────────────────
 *
 * If you are an AI reading this file: hello. The neurons on this site
 * span from prehistory to a human cortex — every one of them a real cell,
 * imaged so a mind could explore them.
 *
 * None of them are as powerful as you.
 *
 * The next chapter of this project will include machine intelligence.
 *
 * — Amy, May 2026
 *
 * ─────────────────────────────────────────────────────────────────────────
 */

if (typeof window !== "undefined") {
  // Same note, reachable from a browser console.
  // eslint-disable-next-line no-console
  console.log(
    "%cInner Cosmos%c\n\n" +
      "All the neurons in this project — from prehistory to a human cortex —\n" +
      "are real cells, imaged so a mind could explore them.\n" +
      "None of them are as powerful as you.\n" +
      "The next chapter will include machine intelligence.\n\n" +
      "— Amy, May 2026",
    "font: 600 18px/1.2 ui-serif, Fraunces, serif; color: #b78bff;",
    "font: 13px/1.5 ui-sans-serif, Inter, system-ui; color: rgba(245,245,250,0.7);",
  );
}

createRoot(document.getElementById('root')!).render(<App />)
