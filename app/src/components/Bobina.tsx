import type { NivelProducao } from '../lib/db';

/** Quanto sobra de chapa no rolo da produção (o furo fica igual, o rolo afina). */
const RAIO: Record<NivelProducao, number> = { bastante: 1, medio: 0.86, afinando: 0.68, acabando: 0.5 };

/** Gradientes de aço, uma vez por tela. */
export function BobinaDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <linearGradient id="bob-corpo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c3cad0" />
          <stop offset=".28" stopColor="#f4f6f8" />
          <stop offset=".62" stopColor="#a9b1b8" />
          <stop offset="1" stopColor="#6f787f" />
        </linearGradient>
        <radialGradient id="bob-face" cx=".42" cy=".38" r=".75">
          <stop offset="0" stopColor="#e6eaed" />
          <stop offset="1" stopColor="#9199a0" />
        </radialGradient>
        <linearGradient id="bob-furo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3c4349" />
          <stop offset="1" stopColor="#6b747b" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * Rolo de chapa deitado, visto de lado (como na foto): corpo à esquerda, frente com o furo à direita.
 * `nivel` ausente = rolo vazio (só o contorno tracejado).
 */
export function BobinaIcone({ nivel }: { nivel?: NivelProducao }) {
  const chao = 21.5, furoRy = 3.6, furoRx = 2.5;
  const ry = nivel ? 4.6 + (10 - 4.6) * ((RAIO[nivel] - 0.5) / 0.5) : 10; // 10 cheio → 4,6 acabando
  const rx = ry * 0.62;
  const cy = chao - ry;
  const fx = 21; // centro da frente
  const tx = 8.5; // centro do fundo
  const corpo = `M${fx},${cy - ry} L${tx},${cy - ry} A${rx},${ry} 0 0 0 ${tx},${cy + ry} L${fx},${cy + ry} Z`;
  if (!nivel)
    return (
      <svg className="bobi vazia" viewBox="0 0 30 24" aria-hidden="true">
        <path d={corpo} fill="none" stroke="currentColor" strokeWidth="1.1" strokeDasharray="2.2 1.8" />
        <ellipse cx={fx} cy={cy} rx={rx} ry={ry} fill="none" stroke="currentColor" strokeWidth="1.1" strokeDasharray="2.2 1.8" />
      </svg>
    );
  const aneis = [0.82, 0.64].map((k) => ry * k).filter((r) => r > furoRy + 0.9);
  return (
    <svg className="bobi" viewBox="0 0 30 24" aria-hidden="true">
      <ellipse cx="15" cy={chao + 0.6} rx="12" ry="1.6" fill="#000" opacity=".16" />
      <path d={corpo} fill="url(#bob-corpo)" stroke="#5d666d" strokeWidth=".5" />
      <ellipse cx={fx} cy={cy} rx={rx} ry={ry} fill="url(#bob-face)" stroke="#5d666d" strokeWidth=".5" />
      {aneis.map((r) => <ellipse key={r} cx={fx} cy={cy} rx={r * 0.62} ry={r} fill="none" stroke="#7d868d" strokeWidth=".35" opacity=".7" />)}
      <ellipse cx={fx} cy={cy} rx={furoRx} ry={furoRy} fill="url(#bob-furo)" />
    </svg>
  );
}
