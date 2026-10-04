import { useState } from 'react';
import { ArrowLeft, Check, ChevronLeft, Copy, Info } from 'lucide-react';
import { differentiate, formatNumber, integrate, matrixOperation, normalizeDigits, numberLatex } from '../lib/calculator';
import { MathEditor, MathText } from './MathField';
import { Modal } from './Modal';

export type AdvancedTool = 'derivative' | 'integral' | 'statistics' | 'matrix';

export function AdvancedTools({ tool, onClose, onUse, onCopy }: { tool: AdvancedTool; onClose: () => void; onUse: (latex: string) => void; onCopy: (text: string) => void }) {
  if (tool === 'statistics') return <StatisticsTool onClose={onClose} onUse={onUse} />;
  if (tool === 'matrix') return <MatrixTool onClose={onClose} onUse={onUse} onCopy={onCopy} />;
  return <CalculusTool initialMode={tool} onClose={onClose} onUse={onUse} />;
}

function CalculusTool({ initialMode, onClose, onUse }: { initialMode: 'derivative' | 'integral'; onClose: () => void; onUse: (latex: string) => void }) {
  const [mode, setMode] = useState(initialMode);
  const [expression, setExpression] = useState('x^3+2x');
  const [variable, setVariable] = useState('x');
  const [order, setOrder] = useState(1);
  const [lower, setLower] = useState('0');
  const [upper, setUpper] = useState('1');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const resetResult = () => { setResult(''); setError(''); };
  const calculate = () => {
    try {
      if (mode === 'integral' && (!lower.trim() || !upper.trim())) throw new Error('أدخل حدي التكامل أولًا.');
      const output = mode === 'derivative' ? differentiate(expression, variable, order) : numberLatex(integrate(expression, Number(normalizeDigits(lower)), Number(normalizeDigits(upper)), variable));
      setResult(output); setError('');
    } catch (caught) { setResult(''); setError(caught instanceof Error ? caught.message : 'تعذر إجراء العملية.'); }
  };
  return <Modal title="التفاضل والتكامل" subtitle="تعمّق في الدالة، خطوة أبعد." onClose={onClose}>
    <div className="tool-switch"><button className={mode === 'derivative' ? 'active' : ''} onClick={() => { setMode('derivative'); resetResult(); }}>التفاضل</button><button className={mode === 'integral' ? 'active' : ''} onClick={() => { setMode('integral'); resetResult(); }}>التكامل المحدد</button></div>
    <label className="field-label">الدالة</label><div className="tool-math-input"><MathEditor value={expression} onChange={(value) => { setExpression(value); resetResult(); }} onEnter={calculate} label="دالة التفاضل أو التكامل" /></div>
    <div className="form-grid"><label className="field-label">المتغير<select className="form-select" value={variable} onChange={(event) => { setVariable(event.target.value); resetResult(); }}>{['x', 'y', 't'].map((value) => <option key={value}>{value}</option>)}</select></label>
      {mode === 'derivative' ? <label className="field-label">رتبة المشتقة<select className="form-select" value={order} onChange={(event) => { setOrder(Number(event.target.value)); resetResult(); }}><option value={1}>الأولى</option><option value={2}>الثانية</option><option value={3}>الثالثة</option></select></label> : <><label className="field-label">الحد السفلي<input className="form-input latin" value={lower} onChange={(event) => { setLower(event.target.value); resetResult(); }} inputMode="decimal" /></label><label className="field-label">الحد العلوي<input className="form-input latin" value={upper} onChange={(event) => { setUpper(event.target.value); resetResult(); }} inputMode="decimal" /></label></>}
    </div>
    <p className="small-note"><Info size={14} /> {mode === 'derivative' ? 'مشتقة رمزية. تُحسب الدوال المثلثية بالراديان.' : 'تقريب عددي لتكامل دالة حقيقية متصلة. الزوايا بالراديان.'}</p>
    <button className="primary-button wide-button" onClick={calculate}>{mode === 'derivative' ? 'احسب المشتقة' : 'احسب التكامل'}<ArrowLeft size={17} /></button>
    {error && <p className="form-error" role="alert">{error}</p>}
    {result && <div className="tool-result"><div className="result-heading"><Check size={16} /><span>{mode === 'derivative' ? 'المشتقة' : 'القيمة التقريبية للتكامل'}</span></div><MathText latex={result} /><button className="text-button" onClick={() => onUse(result)}>استخدم في الحاسبة <ChevronLeft size={15} /></button></div>}
  </Modal>;
}

function MatrixTool({ onClose, onUse, onCopy }: { onClose: () => void; onUse: (latex: string) => void; onCopy: (text: string) => void }) {
  const [size, setSize] = useState(2);
  const [values, setValues] = useState([['1', '2'], ['3', '4']]);
  const [result, setResult] = useState('');
  const [operation, setOperation] = useState<'det' | 'inverse' | 'transpose'>('det');
  const [error, setError] = useState('');
  const calculate = (action: typeof operation) => {
    try {
      if (values.some((row) => row.some((value) => !value.trim()))) throw new Error('أكمل جميع خانات المصفوفة أولًا.');
      setResult(matrixOperation(values.map((row) => row.map((value) => Number(normalizeDigits(value)))), action));
      setOperation(action); setError('');
    } catch (caught) { setResult(''); setError(caught instanceof Error ? caught.message : 'تعذر إجراء عملية المصفوفة.'); }
  };
  return <Modal title="المصفوفات" subtitle="المحدد والمعكوس والمنقول، في مساحة واحدة." onClose={onClose}>
    <div className="matrix-size-row"><span className="field-label">أبعاد المصفوفة</span><div className="segmented-control" dir="ltr">{[2, 3].map((dimension) => <button className={size === dimension ? 'active' : ''} key={dimension} onClick={() => { setSize(dimension); setValues(Array.from({ length: dimension }, (_, i) => Array.from({ length: dimension }, (_, j) => i === j ? '1' : '0'))); setResult(''); setError(''); }}>{dimension} &times; {dimension}</button>)}</div></div>
    <div className="matrix-input" dir="ltr" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>{values.flatMap((row, rowIndex) => row.map((value, columnIndex) => <input key={`${rowIndex}-${columnIndex}`} className="form-input latin" aria-label={`الصف ${rowIndex + 1} العمود ${columnIndex + 1}`} inputMode="decimal" value={value} onChange={(event) => { setValues((previous) => previous.map((r, i) => r.map((v, j) => i === rowIndex && j === columnIndex ? event.target.value : v))); setResult(''); setError(''); }} />))}</div>
    <div className="matrix-actions"><button className="primary-button" onClick={() => calculate('det')}>المحدد <MathText latex="|A|" /></button><button className="secondary-button" onClick={() => calculate('inverse')}>المعكوس <MathText latex="A^{-1}" /></button><button className="secondary-button" onClick={() => calculate('transpose')}>المنقول <MathText latex="A^T" /></button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {result && <div className="tool-result"><div className="result-heading"><Check size={16} /><span>النتيجة</span></div><MathText latex={result} />{operation === 'det' ? <button className="text-button" onClick={() => onUse(result)}>استخدم في الحاسبة <ChevronLeft size={15} /></button> : <button className="text-button" onClick={() => onCopy(result)}>نسخ بصيغة LaTeX <Copy size={15} /></button>}</div>}
  </Modal>;
}

function StatisticsTool({ onClose, onUse }: { onClose: () => void; onUse: (latex: string) => void }) {
  const [input, setInput] = useState('12, 15, 18, 18, 21, 24');
  const [results, setResults] = useState<{ label: string; value: number | null }[]>([]);
  const [error, setError] = useState('');
  const calculate = () => {
    const entries = normalizeDigits(input).split(/[\s,،;؛]+/).filter(Boolean);
    const numbers = entries.map(Number);
    if (!numbers.length || numbers.some((n) => !Number.isFinite(n)) || numbers.length > 10000) { setError('أدخل قائمة من الأرقام الصحيحة أو العشرية، بحد أقصى 10000 قيمة.'); return; }
    const sum = numbers.reduce((a, b) => a + b, 0);
    const mean = sum / numbers.length;
    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(numbers.length / 2);
    const median = numbers.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    const variance = numbers.length > 1 ? numbers.reduce((total, n) => total + (n - mean) ** 2, 0) / (numbers.length - 1) : null;
    if (![sum, mean, median, variance ?? 0].every(Number.isFinite)) {
      setResults([]); setError('القيم تتجاوز النطاق العددي المدعوم. جرّب إعادة تحجيم البيانات.'); return;
    }
    setResults([{ label: 'عدد القيم', value: numbers.length }, { label: 'المجموع', value: sum }, { label: 'المتوسط الحسابي', value: mean }, { label: 'الوسيط', value: median }, { label: 'أصغر قيمة', value: sorted[0] }, { label: 'أكبر قيمة', value: sorted[sorted.length - 1] }, { label: 'تباين العينة', value: variance }, { label: 'الانحراف المعياري للعينة', value: variance === null ? null : Math.sqrt(variance) }]);
    setError('');
  };
  return <Modal title="الإحصاء الوصفي" subtitle="حوّل مجموعة الأرقام إلى صورة أوضح." onClose={onClose}>
    <label className="field-label" htmlFor="statistics-data">القيم</label><textarea className="form-input statistics-input latin" id="statistics-data" dir="ltr" rows={3} value={input} onChange={(event) => { setInput(event.target.value); setResults([]); setError(''); }} /><p className="small-note">افصل بين القيم بفاصلة أو مسافة أو سطر جديد.</p><button className="primary-button wide-button" onClick={calculate}>حلّل البيانات <ArrowLeft size={17} /></button>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!!results.length && <div className="statistics-results">{results.map((result) => <div className="statistic-line" key={result.label}><span>{result.label}</span><strong className="latin" dir="ltr">{result.value === null ? 'N/A' : formatNumber(result.value)}</strong><button className="icon-button tiny" disabled={result.value === null} aria-label={`استخدام ${result.label} في الحاسبة`} onClick={() => result.value !== null && onUse(numberLatex(result.value))}><ChevronLeft size={16} /></button></div>)}</div>}
  </Modal>;
}