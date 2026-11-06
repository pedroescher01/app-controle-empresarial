import { BANDEIRAS, taxaPct, valorTaxa, type Cartao, type Meio, type TabelaTaxas } from '../lib/taxas';
import { brl } from '../lib/format';
import { Seg } from './ui';

export const CARTAO_PADRAO: Cartao = { meio: 'maquininha', bandeira: 'visamaster', parcelas: 1 };
export const ehCartao = (forma: string) => forma.startsWith('Cartão');

/** Campos do cartão (maquininha ou link, bandeira, parcelas) + quanto cai de verdade. */
export function CartaoCampos({ forma, cartao, onChange, valor, tabela }: { forma: string; cartao: Cartao; onChange: (c: Cartao) => void; valor: number; tabela: TabelaTaxas }) {
  if (!ehCartao(forma)) return null;
  const debito = forma === 'Cartão de débito';
  const pct = taxaPct(forma, cartao, tabela);
  return (
    <div className="card pad stack-s" style={{ boxShadow: 'none', background: 'var(--surface-2)', border: 0 }}>
      <Seg<Meio> label="Como passou" value={cartao.meio} onChange={(meio) => onChange({ ...cartao, meio })}
        options={[{ value: 'maquininha', label: 'Maquininha / Tap' }, { value: 'link', label: 'Link de pagamento' }]} />
      {cartao.meio === 'maquininha' && (
        <div className="chips" style={{ flexWrap: 'wrap', margin: 0, padding: 0 }}>
          {BANDEIRAS.filter((b) => !(debito && b.k === 'amexhiper')).map((b) => (
            <button key={b.k} className="chip" aria-pressed={cartao.bandeira === b.k} onClick={() => onChange({ ...cartao, bandeira: b.k })}>{b.l}</button>
          ))}
        </div>
      )}
      {!debito && (
        <div className="field"><label htmlFor="cc-p">Parcelas no cartão</label>
          <select id="cc-p" className="input" value={cartao.parcelas} onChange={(e) => onChange({ ...cartao, parcelas: Number(e.target.value) })}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? 'À vista (1x)' : `${n}x`}</option>)}
          </select>
        </div>
      )}
      {pct == null
        ? <span className="err">Essa opção não existe na InfinitePay. Escolha outra.</span>
        : <div className="small"><b>Taxa {pct.toFixed(2).replace('.', ',')}%</b>{valor > 0 && <> · {brl(valorTaxa(valor, pct))} · <b style={{ color: 'var(--ok)' }}>cai {brl(valor - valorTaxa(valor, pct))}</b></>}</div>}
    </div>
  );
}
