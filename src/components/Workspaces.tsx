import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownUp, ArrowLeft, Check, ChevronLeft, Copy, Focus, Info, Minus, Plus, Search } from 'lucide-react';
import { unit } from 'mathjs';
import { compileFunction, formatNumber, normalizeDigits, numberLatex, solveEquation } from '../lib/calculator';
import { MathEditor, MathText } from './MathField';

export function EquationWorkspace({ onUse }: { onUse: (latex: string) => void }) {
  const [expression, setExpression] = useState('x^2-5x+6=0');
  const [variable, setVariable] = useState('x');
  const [solutions, setSolutions] = useState<string[]>([]);
  const [error, setError] = useState('');
  const solve = () => {
    try { setSolutions(solveEquation(expression, variable)); setError(''); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'تعذر حل المعادلة.'); setSolutions([]); }
  };
  const change = (value: string) => { setExpression(value); setSolutions([]); setError(''); };
  return <div className="tool-page-grid">
    <section className="workspace-panel equation-workspace">
      <div className="panel-title"><span className="section-number latin">01</span><h2>اكتب المعادلة</h2><label className="variable-select">المتغير <select value={variable} onChange={(event) => { setVariable(event.target.value); setSolutions([]); }}>{['x', 'y', 't'].map((value) => <option key={value}>{value}</option>)}</select></label></div>
      <div className="tool-math-input"><MathEditor value={expression} onChange={change} onEnter={solve} label="المعادلة المطلوب حلها" /></div>
      <div className="tool-examples"><span>أو جرّب</span>{['2x+8=0', 'x^2-5x+6=0', 'x^2+1=0'].map((example) => <button key={example} onClick={() => { change(example); setVariable('x'); }}><MathText latex={example} /></button>)}</div>
      <button className="primary-button wide-button" onClick={solve}>أوجد الحل <ArrowLeft size={17} /></button>
      {error && <p className="form-error" role="alert">{error}</p>}
      {solutions.length > 0 && <motion.div className="equation-solutions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><div className="result-heading"><Check size={17} /><h3>مجموعة الحل</h3></div>{solutions.map((solution, index) => <div className="equation-solution" key={index}><MathText latex={`${variable}${solutions.length > 1 ? `_{${index + 1}}` : ''}=${solution}`} /><button className="text-button" onClick={() => onUse(solution)}>استخدم النتيجة <ChevronLeft size={15} /></button></div>)}</motion.div>}
    </section>
    <aside className="tool-aside"><span className="aside-eyebrow">مسألة واحدة، احتمالات كثيرة</span><h2>دع المجهول<br />يصبح معلومًا.</h2><p>حل المعادلات الخطية والتربيعية بمتغير واحد، مع عرض الجذور الحقيقية والمركبة بشكل رياضي واضح.</p><div className="reference-formula"><MathText latex={String.raw`x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}`} /></div><p className="small-note"><Info size={15} /> اكتب طرفي المعادلة، أو اكتب تعبيرًا لنساويه بالصفر.</p></aside>
  </div>;
}

export function GraphWorkspace() {
  const [input, setInput] = useState(String.raw`\sin(x)`);
  const [expression, setExpression] = useState(input);
  const [span, setSpan] = useState(8);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState('');
  const width = 900, height = 430;
  const verticalSpan = span * height / width;
  const graph = useMemo(() => {
    try {
      const f = compileFunction(expression);
      let path = '', previousY: number | null = null, validPoints = 0;
      for (let i = 0; i <= 700; i++) {
        const x = (i / 700 * 2 - 1) * span;
        const y = f(x);
        const py = height / 2 - y / verticalSpan * height / 2;
        if (!Number.isFinite(py) || Math.abs(py) > height * 4) { previousY = null; continue; }
        const px = i / 700 * width;
        path += `${previousY === null || Math.abs(py - previousY) > height ? 'M' : 'L'}${px.toFixed(2)},${py.toFixed(2)} `;
        previousY = py;
        validPoints++;
      }
      return { path, f, valid: validPoints > 0 };
    } catch { return { path: '', f: (_x: number) => NaN, valid: false }; }
  }, [expression, span, verticalSpan]);
  const plot = (latex = input) => {
    try {
      const f = compileFunction(latex);
      if (![0, 0.5, 1, 2, -1].some((x) => Number.isFinite(f(x)))) throw new Error();
      setExpression(latex); setError(''); setHover(null);
    } catch { setError('تعذر رسم هذه الدالة. استخدم المتغير x وتحقق من مجالها.'); }
  };
  const gridStep = span <= 3 ? 0.5 : span <= 12 ? 1 : span <= 30 ? 5 : 10;
  const xTicks = Array.from({ length: Math.ceil(span * 2 / gridStep) + 1 }, (_, i) => (Math.ceil(-span / gridStep) + i) * gridStep).filter((x) => x >= -span && x <= span);
  const yTicks = Array.from({ length: Math.ceil(verticalSpan * 2 / gridStep) + 1 }, (_, i) => (Math.ceil(-verticalSpan / gridStep) + i) * gridStep).filter((y) => y >= -verticalSpan && y <= verticalSpan);
  const sx = (x: number) => (x / span + 1) * width / 2;
  const sy = (y: number) => (1 - y / verticalSpan) * height / 2;

  return <section className="workspace-panel graph-workspace">
    <div className="graph-input-row"><span className="function-label latin">f(x) =</span><MathEditor value={input} onChange={setInput} onEnter={() => plot()} label="الدالة المراد رسمها" /><button className="primary-button" onClick={() => plot()}>ارسم الدالة <ArrowLeft size={16} /></button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="graph-canvas" dir="ltr">
      <div className="graph-zoom"><button className="icon-button" aria-label="تكبير الرسم" onClick={() => setSpan((s) => Math.max(1, s / 1.5))}><Plus size={18} /></button><button className="icon-button" aria-label="تصغير الرسم" onClick={() => setSpan((s) => Math.min(80, s * 1.5))}><Minus size={18} /></button><button className="icon-button" aria-label="إعادة ضبط الرسم" onClick={() => setSpan(8)}><Focus size={18} /></button></div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="الرسم البياني للدالة" onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width * 2 - 1) * span;
        try { const y = graph.f(x); setHover(Number.isFinite(y) && Math.abs(y) < verticalSpan ? { x, y } : null); } catch { setHover(null); }
      }} onPointerLeave={() => setHover(null)}>
        <defs><clipPath id="plot-clip"><rect width={width} height={height} /></clipPath></defs>
        {xTicks.map((x) => <g key={`x${x}`}><line className={x === 0 ? 'graph-axis' : 'graph-grid-line'} x1={sx(x)} x2={sx(x)} y1={0} y2={height} />{x !== 0 && <text className="graph-tick" x={sx(x)} y={height / 2 + 21} textAnchor="middle">{Number(x.toFixed(1))}</text>}</g>)}
        {yTicks.map((y) => <g key={`y${y}`}><line className={y === 0 ? 'graph-axis' : 'graph-grid-line'} x1={0} x2={width} y1={sy(y)} y2={sy(y)} />{y !== 0 && <text className="graph-tick" x={width / 2 - 13} y={sy(y) + 4} textAnchor="end">{Number(y.toFixed(1))}</text>}</g>)}
        <text className="graph-axis-label" x={width - 16} y={height / 2 - 13}>x</text><text className="graph-axis-label" x={width / 2 + 12} y={20}>y</text>
        <g clipPath="url(#plot-clip)"><motion.path key={`${expression}-${span}`} d={graph.path} fill="none" stroke="var(--purple)" strokeWidth={3} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7 }} />
          {hover && <><line x1={sx(hover.x)} x2={sx(hover.x)} y1={sy(hover.y)} y2={height / 2} stroke="var(--purple)" strokeDasharray="4 5" opacity={0.5} /><circle cx={sx(hover.x)} cy={sy(hover.y)} r={6} fill="var(--purple)" stroke="var(--surface)" strokeWidth={3} /></>}
        </g>
      </svg>
      <div className="graph-coordinate latin">{hover ? `x = ${formatNumber(hover.x, 5)}   y = ${formatNumber(hover.y, 5)}` : 'x, y'}</div>
      {!graph.valid && <p className="graph-empty">لا توجد نقاط حقيقية في هذا المجال.</p>}
    </div>
    <div className="graph-footer"><div className="tool-examples"><span>استكشف</span>{['x^2', String.raw`\sin(x)`, String.raw`\frac{1}{x}`].map((example) => <button key={example} onClick={() => { setInput(example); plot(example); }}><MathText latex={example} /></button>)}</div><span className="small-note">الدوال المثلثية بالراديان (RAD)</span></div>
  </section>;
}

const UNIT_CATEGORIES = [
  { id: 'length', name: 'الطول', units: [['m', 'متر'], ['cm', 'سنتيمتر'], ['mm', 'مليمتر'], ['km', 'كيلومتر'], ['inch', 'بوصة'], ['ft', 'قدم'], ['mile', 'ميل']] },
  { id: 'mass', name: 'الكتلة', units: [['kg', 'كيلوجرام'], ['g', 'جرام'], ['mg', 'مليجرام'], ['lb', 'رطل'], ['oz', 'أونصة'], ['tonne', 'طن']] },
  { id: 'temperature', name: 'الحرارة', units: [['degC', 'درجة مئوية'], ['degF', 'فهرنهايت'], ['K', 'كلفن']] },
  { id: 'time', name: 'الزمن', units: [['s', 'ثانية'], ['min', 'دقيقة'], ['h', 'ساعة'], ['day', 'يوم'], ['week', 'أسبوع']] },
  { id: 'area', name: 'المساحة', units: [['m2', 'متر مربع'], ['cm2', 'سنتيمتر مربع'], ['km2', 'كيلومتر مربع'], ['hectare', 'هكتار'], ['acre', 'فدان دولي']] },
  { id: 'volume', name: 'الحجم', units: [['L', 'لتر'], ['mL', 'مليلتر'], ['m3', 'متر مكعب'], ['gal', 'جالون أمريكي']] },
  { id: 'speed', name: 'السرعة', units: [['m/s', 'متر في الثانية'], ['km/h', 'كيلومتر في الساعة'], ['mile/h', 'ميل في الساعة']] },
  { id: 'energy', name: 'الطاقة', units: [['J', 'جول'], ['kJ', 'كيلوجول'], ['Wh', 'واط ساعة'], ['kWh', 'كيلوواط ساعة'], ['eV', 'إلكترون فولت']] },
  { id: 'angle', name: 'الزوايا', units: [['deg', 'درجة'], ['rad', 'راديان'], ['grad', 'غراد']] },
];

export function ConverterWorkspace({ onCopy, onUse }: { onCopy: (text: string) => void; onUse: (latex: string) => void }) {
  const [categoryId, setCategoryId] = useState('length');
  const category = UNIT_CATEGORIES.find((item) => item.id === categoryId)!;
  const [from, setFrom] = useState('m');
  const [to, setTo] = useState('cm');
  const [amount, setAmount] = useState('1');
  let result: number | null = null;
  try {
    if (amount.trim() && Number.isFinite(Number(normalizeDigits(amount)))) {
      const converted = unit(Number(normalizeDigits(amount)), from).toNumber(to);
      if (Number.isFinite(converted)) result = converted;
    }
  } catch { result = null; }
  const changeCategory = (id: string) => {
    const selected = UNIT_CATEGORIES.find((item) => item.id === id)!;
    setCategoryId(id); setFrom(selected.units[0][0]); setTo(selected.units[1][0]);
  };
  return <div className="tool-page-grid"><section className="workspace-panel converter-workspace">
    <label className="field-label" htmlFor="unit-category">ماذا تريد أن تحوّل؟</label><select id="unit-category" className="form-select" value={categoryId} onChange={(event) => changeCategory(event.target.value)}>{UNIT_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
    <div className="conversion-field"><label className="field-label" htmlFor="convert-from">من</label><div className="conversion-input"><input id="convert-from" inputMode="decimal" dir="ltr" value={amount} onChange={(event) => setAmount(event.target.value)} /><select aria-label="الوحدة الأصلية" value={from} onChange={(event) => setFrom(event.target.value)}>{category.units.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>
    <div className="swap-row"><span /><button className="swap-button" aria-label="تبديل الوحدات" onClick={() => { setFrom(to); setTo(from); if (result !== null) setAmount(formatNumber(result)); }}><ArrowDownUp size={21} /></button><span /></div>
    <div className="conversion-field"><label className="field-label">إلى</label><div className="conversion-input conversion-output"><output dir="ltr">{result !== null ? formatNumber(result) : '...'}</output><select aria-label="الوحدة المطلوبة" value={to} onChange={(event) => setTo(event.target.value)}>{category.units.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>
    {result === null && amount && <p className="form-error">أدخل قيمة عددية صالحة للتحويل.</p>}
    <div className="conversion-actions"><button className="primary-button" disabled={result === null} onClick={() => result !== null && onUse(numberLatex(result))}>استخدم في الحاسبة <ChevronLeft size={16} /></button><button className="secondary-button" disabled={result === null} onClick={() => result !== null && onCopy(formatNumber(result))}><Copy size={16} /> نسخ النتيجة</button></div>
  </section><aside className="tool-aside"><span className="aside-eyebrow">نفس القيمة، منظور آخر</span><h2>بين الوحدات،<br />بكل بساطة.</h2><p>تحويل مباشر بين وحدات الطول والكتلة والطاقة والزمن وغيرها، دون أن تغادر مساحة عملك.</p><div className="reference-formula"><MathText latex={String.raw`1\,\mathrm{m}=100\,\mathrm{cm}`} /></div><p className="small-note"><Info size={15} /> تتحدث النتيجة تلقائيًا عند تغيير القيمة أو الوحدة.</p></aside></div>;
}

const CONSTANTS = [
  { name: 'ثابت الدائرة', symbol: '\\pi', value: '3.14159265358979', latex: '\\pi', unit: '', type: 'رياضيات' },
  { name: 'عدد أويلر', symbol: 'e', value: '2.71828182845905', latex: 'e', unit: '', type: 'رياضيات' },
  { name: 'النسبة الذهبية', symbol: '\\varphi', value: '1.61803398874989', latex: '\\frac{1+\\sqrt{5}}{2}', unit: '', type: 'رياضيات' },
  { name: 'سرعة الضوء في الفراغ', symbol: 'c', value: '299792458', latex: '299792458', unit: '\\mathrm{m}\\,\\mathrm{s}^{-1}', type: 'فيزياء' },
  { name: 'تسارع الجاذبية القياسي', symbol: 'g_n', value: '9.80665', latex: '9.80665', unit: '\\mathrm{m}\\,\\mathrm{s}^{-2}', type: 'فيزياء' },
  { name: 'ثابت بلانك', symbol: 'h', value: '6.62607015e-34', latex: '6.62607015\\times10^{-34}', unit: '\\mathrm{J}\\,\\mathrm{s}', type: 'فيزياء' },
  { name: 'ثابت أفوجادرو', symbol: 'N_A', value: '6.02214076e23', latex: '6.02214076\\times10^{23}', unit: '\\mathrm{mol}^{-1}', type: 'كيمياء' },
  { name: 'ثابت بولتزمان', symbol: 'k_B', value: '1.380649e-23', latex: '1.380649\\times10^{-23}', unit: '\\mathrm{J}\\,\\mathrm{K}^{-1}', type: 'فيزياء' },
  { name: 'الشحنة الأولية', symbol: 'e', value: '1.602176634e-19', latex: '1.602176634\\times10^{-19}', unit: '\\mathrm{C}', type: 'فيزياء' },
];

export function ConstantsWorkspace({ onUse }: { onUse: (latex: string) => void }) {
  const [search, setSearch] = useState('');
  const constants = CONSTANTS.filter((item) => `${item.name} ${item.symbol} ${item.type}`.includes(search));
  return <section className="workspace-panel constants-workspace"><div className="section-toolbar"><div className="search-field"><Search size={17} /><input aria-label="البحث في الثوابت" placeholder="ابحث عن ثابت علمي..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><span className="small-note">قيم الثوابت المعرفة وفق النظام الدولي SI</span></div><div className="constants-table"><div className="constants-table-heading"><span>الثابت</span><span>القيمة</span><span /></div>{constants.map((constant) => <div className="constant-row" key={constant.name}><div className="constant-name"><MathText latex={constant.symbol} /><div><h3>{constant.name}</h3><span>{constant.type}</span></div></div><div className="constant-value"><MathText latex={numberLatex(constant.value)} />{constant.unit && <MathText latex={constant.unit} className="constant-unit" />}</div><button className="text-button" onClick={() => onUse(constant.latex)}>استخدام <Plus size={16} /></button></div>)}</div>{!constants.length && <div className="large-empty"><Search size={30} /><h3>لم نجد ثابتًا بهذا الاسم</h3><p>جرّب اسمًا آخر، مثل بلانك أو سرعة الضوء.</p></div>}<p className="constants-footnote">تُدرج القيمة العددية فقط في الحاسبة. راعِ توافق الوحدات عند استخدامها في المسائل الفيزيائية.</p></section>;
}