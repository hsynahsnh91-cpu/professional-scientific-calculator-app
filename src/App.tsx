import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUp, Atom, Bookmark, BookOpen, Braces, Calculator, ChartSpline, Check, ChevronLeft, CircleHelp, Copy, CornerDownLeft, Delete, Ellipsis, FlaskConical, History, Keyboard, LayoutGrid, LockKeyhole, Menu, Moon, Plus, Redo2, Settings2, Sun, Trash2, Undo2, X } from 'lucide-react';
import type { MathfieldElement } from 'mathlive';
import { MathEditor, MathText } from './components/MathField';
import { HistoryPanel, HistoryWorkspace } from './components/History';
import { ConstantsWorkspace, ConverterWorkspace, EquationWorkspace, GraphWorkspace } from './components/Workspaces';
import { AdvancedTools, type AdvancedTool } from './components/AdvancedTools';
import { Modal } from './components/Modal';
import { calculate, INITIAL_EXPRESSION, normalizeDigits, numberLatex, readStorage, trimHistory, writeStorage, type AngleMode, type CalculationResult, type HistoryEntry } from './lib/calculator';

type Page = 'calculator' | 'equations' | 'graph' | 'converter' | 'history' | 'saved' | 'constants';
type Dialog = AdvancedTool | 'help' | 'settings' | 'clear' | null;
type KeyGroup = 'common' | 'trig' | 'advanced';
type Preferences = { theme: 'light' | 'dark'; angle: AngleMode; precision: number; livePreview: boolean };

const NAV_ITEMS: { id: Page; title: string; icon: typeof Calculator }[] = [
  { id: 'calculator', title: 'الآلة الحاسبة', icon: Calculator },
  { id: 'equations', title: 'حل المعادلات', icon: Braces },
  { id: 'graph', title: 'الرسم البياني', icon: ChartSpline },
  { id: 'converter', title: 'تحويل الوحدات', icon: ArrowLeftRight },
  { id: 'history', title: 'سجل العمليات', icon: History },
  { id: 'saved', title: 'المحفوظات', icon: Bookmark },
  { id: 'constants', title: 'الثوابت العلمية', icon: FlaskConical },
];

const PAGE_TITLES: Record<Page, { first: string; accent: string; description: string }> = {
  calculator: { first: 'فكّر بوضوح.', accent: 'احسب بثقة.', description: 'آلة حاسبة علمية تكتب الرياضيات تمامًا كما في دفترك.' },
  equations: { first: 'لكل مجهول،', accent: 'حلّ ينتظره.', description: 'حل المعادلات الخطية والتربيعية بصياغة رياضية طبيعية.' },
  graph: { first: 'لا تحسب الدالة فقط.', accent: 'شاهدها.', description: 'استكشف منحنيات الدوال، وكبّر التفاصيل، واكتشف العلاقة.' },
  converter: { first: 'غيّر الوحدة.', accent: 'واحتفظ بالدقة.', description: 'حوّل بين الوحدات العلمية بقيم تتحدث لحظيًا.' },
  history: { first: 'كل خطوة،', accent: 'محفوظة لك.', description: 'ارجع إلى عملياتك السابقة، وابدأ من حيث انتهت فكرتك.' },
  saved: { first: 'أفكار تستحق', accent: 'أن تبقى.', description: 'مسائلك المهمة ونتائجك المفضلة، دائمًا في مكان واحد.' },
  constants: { first: 'ثوابت العلم.', accent: 'بين يديك.', description: 'قيم أساسية للرياضيات والفيزياء والكيمياء، جاهزة للاستخدام.' },
};

interface KeyDef { id: string; label?: ReactNode; math?: string; insert?: string; action?: string; title: string; className?: string }
const mathKey = (id: string, math: string, insert: string, title: string): KeyDef => ({ id, math, insert, title });

function getScientificKeys(group: KeyGroup, second: boolean): KeyDef[] {
  if (group === 'trig') return [
    mathKey('sin', '\\sin', '\\sin\\left(#?\\right)', 'جيب الزاوية'),
    mathKey('cos', '\\cos', '\\cos\\left(#?\\right)', 'جيب تمام الزاوية'),
    mathKey('tan', '\\tan', '\\tan\\left(#?\\right)', 'ظل الزاوية'),
    mathKey('asin', '\\sin^{-1}', '\\arcsin\\left(#?\\right)', 'معكوس الجيب'),
    mathKey('acos', '\\cos^{-1}', '\\arccos\\left(#?\\right)', 'معكوس جيب التمام'),
    mathKey('atan', '\\tan^{-1}', '\\arctan\\left(#?\\right)', 'معكوس الظل'),
    mathKey('sinh', '\\sinh', '\\sinh\\left(#?\\right)', 'الجيب الزائدي'),
    mathKey('cosh', '\\cosh', '\\cosh\\left(#?\\right)', 'جيب التمام الزائدي'),
    mathKey('tanh', '\\tanh', '\\tanh\\left(#?\\right)', 'الظل الزائدي'),
    mathKey('cot', '\\cot', '\\cot\\left(#?\\right)', 'ظل التمام'),
    mathKey('sec', '\\sec', '\\sec\\left(#?\\right)', 'القاطع'),
    mathKey('csc', '\\csc', '\\csc\\left(#?\\right)', 'قاطع التمام'),
    mathKey('pi', '\\pi', '\\pi', 'ثابت باي'),
    mathKey('degree', '{}^{\\circ}', '\\degree', 'علامة الدرجة'),
    mathKey('abs', '|x|', '\\left|#?\\right|', 'القيمة المطلقة'),
  ];
  if (group === 'advanced') return [
    mathKey('nthroot', '\\sqrt[n]{x}', '\\sqrt[#?]{#?}', 'الجذر النوني'),
    mathKey('logbase', '\\log_a', '\\log_{#?}\\left(#?\\right)', 'لوغاريتم بأساس اختياري'),
    mathKey('abs', '|x|', '\\left|#?\\right|', 'القيمة المطلقة'),
    mathKey('reciprocal', '\\frac{1}{x}', '\\frac{1}{#?}', 'المقلوب'),
    mathKey('binomial', '\\binom{n}{r}', '\\binom{#?}{#?}', 'التوافيق'),
    mathKey('factorial', 'n!', '{#@}!', 'المضروب'),
    mathKey('variable', 'x', 'x', 'المتغير x'),
    mathKey('imaginary', 'i', '\\imaginaryI', 'الوحدة التخيلية'),
    { id: 'ans', label: 'Ans', action: 'ans', title: 'آخر نتيجة' },
    { id: 'derivative', math: '\\frac{d}{dx}', action: 'derivative', title: 'التفاضل' },
    { id: 'integral', math: '\\int_a^b', action: 'integral', title: 'التكامل المحدد' },
    mathKey('sum', '\\sum', '\\sum_{n=#?}^{#?}#?', 'المجموع المتسلسل'),
    { id: 'matrix', math: '\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}', action: 'matrix', title: 'المصفوفات', className: 'matrix-key' },
    { id: 'statistics', math: '\\bar{x}', action: 'statistics', title: 'الإحصاء الوصفي' },
    mathKey('exp10', '10^x', '10^{#?}', 'عشرة مرفوعة لأس'),
  ];
  return [
    { id: 'second', label: <span className="second-label">2<sup>nd</sup></span>, action: 'second', title: 'تبديل الدوال الثانوية', className: second ? 'second-key selected' : 'second-key' },
    mathKey('pi', '\\pi', '\\pi', 'ثابت باي'),
    mathKey('e', 'e', 'e', 'عدد أويلر'),
    mathKey('square', second ? 'x^3' : 'x^2', second ? '{#@}^{3}' : '{#@}^{2}', second ? 'المكعب' : 'التربيع'),
    mathKey('power', 'x^{\\placeholder{}}', '{#@}^{#?}', 'رفع لأس مع خانة علوية'),
    mathKey('sqrt', second ? '\\sqrt[3]{x}' : '\\sqrt{x}', second ? '\\sqrt[3]{#?}' : '\\sqrt{#?}', second ? 'الجذر التكعيبي' : 'الجذر التربيعي'),
    mathKey('sin', second ? '\\sin^{-1}' : '\\sin', second ? '\\arcsin\\left(#?\\right)' : '\\sin\\left(#?\\right)', second ? 'معكوس الجيب' : 'جيب الزاوية'),
    mathKey('cos', second ? '\\cos^{-1}' : '\\cos', second ? '\\arccos\\left(#?\\right)' : '\\cos\\left(#?\\right)', second ? 'معكوس جيب التمام' : 'جيب تمام الزاوية'),
    mathKey('tan', second ? '\\tan^{-1}' : '\\tan', second ? '\\arctan\\left(#?\\right)' : '\\tan\\left(#?\\right)', second ? 'معكوس الظل' : 'ظل الزاوية'),
    mathKey('ln', second ? 'e^x' : '\\ln', second ? 'e^{#?}' : '\\ln\\left(#?\\right)', second ? 'الأس الطبيعي' : 'اللوغاريتم الطبيعي'),
    mathKey('log', second ? '10^x' : '\\log', second ? '10^{#?}' : '\\log\\left(#?\\right)', second ? 'عشرة مرفوعة لأس' : 'اللوغاريتم العشري'),
    mathKey('factorial', 'n!', '{#@}!', 'مضروب العدد'),
    mathKey('left-paren', '(', '(', 'فتح قوس'),
    mathKey('right-paren', ')', ')', 'إغلاق قوس'),
    mathKey('fraction', '\\frac{a}{b}', '\\frac{#@}{#?}', 'كسر ببسط ومقام'),
  ];
}

const NUMBER_KEYS: KeyDef[] = [
  { id: 'clear', label: 'AC', action: 'clear', title: 'مسح الكل', className: 'clear-key' },
  { id: 'delete', label: <Delete size={22} strokeWidth={1.6} />, action: 'delete', title: 'حذف الرمز السابق', className: 'utility-key' },
  mathKey('percent', '\\%', '\\%', 'النسبة المئوية'),
  { ...mathKey('divide', '\\div', '\\frac{#@}{#?}', 'القسمة ككسر'), className: 'operator-key' },
  ...['7', '8', '9'].map((n) => ({ id: `digit-${n}`, label: n, insert: n, title: n, className: 'number-key' })),
  { ...mathKey('multiply', '\\times', '\\times', 'الضرب'), className: 'operator-key' },
  ...['4', '5', '6'].map((n) => ({ id: `digit-${n}`, label: n, insert: n, title: n, className: 'number-key' })),
  { ...mathKey('minus', '-', '-', 'الطرح'), className: 'operator-key' },
  ...['1', '2', '3'].map((n) => ({ id: `digit-${n}`, label: n, insert: n, title: n, className: 'number-key' })),
  { ...mathKey('plus', '+', '+', 'الجمع'), className: 'operator-key' },
  { id: 'sign', math: '\\pm', action: 'sign', title: 'تغيير الإشارة' },
  { id: 'digit-0', label: '0', insert: '0', title: '0', className: 'number-key' },
  { id: 'decimal', label: '.', insert: '.', title: 'الفاصلة العشرية', className: 'number-key' },
  { id: 'equals', label: '=', action: 'equals', title: 'احسب النتيجة', className: 'equals-key' },
];

function Brand({ onClick }: { onClick: () => void }) {
  return <button className="brand" aria-label="برهان، الصفحة الرئيسية" onClick={onClick}><span className="brand-mark"><svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M10 13h8M14 9v8M25 13h6M10 26l7 7m0-7-7 7M25 27h6m-6 5h6" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" transform="translate(0 -2)" /></svg></span><span className="brand-wordmark">بُرهان<span>مساحة لكل حلّ</span></span></button>;
}

function KeyButton({ item, onPress }: { item: KeyDef; onPress: (item: KeyDef) => void }) {
  return <motion.button type="button" className={`calc-key ${item.className || ''}`} title={item.title} aria-label={item.title} onPointerDown={(event) => event.preventDefault()} onClick={() => onPress(item)} whileTap={{ scale: 0.93 }} transition={{ duration: 0.12 }}>
    {item.math ? <MathText latex={item.math} /> : item.label}
  </motion.button>;
}

const defaultPreferences: Preferences = { theme: 'light', angle: 'deg', precision: 12, livePreview: true };

export default function App() {
  const [preferences, setPreferences] = useState<Preferences>(() => {
    const stored = readStorage<Partial<Preferences>>('burhan-preferences', {});
    return { theme: stored?.theme === 'dark' ? 'dark' : 'light', angle: stored?.angle === 'rad' ? 'rad' : 'deg', precision: [8, 12, 15].includes(stored?.precision || 0) ? stored.precision! : 12, livePreview: stored?.livePreview !== false };
  });
  const [page, setPage] = useState<Page>('calculator');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [scientific, setScientific] = useState(true);
  const [group, setGroup] = useState<KeyGroup>('common');
  const [second, setSecond] = useState(false);
  const [expression, setExpression] = useState(INITIAL_EXPRESSION);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState('');
  const [exact, setExact] = useState(false);
  const [hasCalculated, setHasCalculated] = useState(false);
  const [lastAnswer, setLastAnswer] = useState('0');
  const [memory, setMemory] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    const stored = readStorage<HistoryEntry[]>('burhan-history', []);
    return Array.isArray(stored) ? trimHistory(stored.filter((entry) => entry && typeof entry.id === 'string' && typeof entry.expression === 'string' && typeof entry.result?.decimal === 'string' && typeof entry.result?.exact === 'string' && typeof entry.result?.text === 'string' && typeof entry.createdAt === 'number' && ['deg', 'rad'].includes(entry.angle))) : [];
  });
  const editor = useRef<MathfieldElement | null>(null);
  const justEvaluated = useRef(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const title = PAGE_TITLES[page];
  const currentSaved = history.some((entry) => entry.expression === expression && entry.angle === preferences.angle && entry.saved);

  const notify = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    writeStorage('burhan-preferences', preferences);
  }, [preferences]);

  useEffect(() => { setStorageAvailable(writeStorage('burhan-history', history)); }, [history]);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  useEffect(() => {
    if (!expression.trim()) { setResult(null); return; }
    if (!preferences.livePreview && !hasCalculated) { setResult(null); return; }
    const timer = setTimeout(() => {
      try { setResult(calculate(expression, preferences.angle, preferences.precision)); }
      catch { if (!hasCalculated) setResult(null); }
    }, 130);
    return () => clearTimeout(timer);
  }, [expression, preferences.angle, preferences.precision, preferences.livePreview, hasCalculated]);

  const updatePreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences((previous) => ({ ...previous, [key]: value }));
    if (key === 'angle' || key === 'precision') { setResult(null); setHasCalculated(false); setError(''); }
  };

  const navigate = (nextPage: Page) => {
    setPage(nextPage); setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const changeExpression = (value: string) => {
    setExpression(value); setResult(null); setError(''); setHasCalculated(false); justEvaluated.current = false;
  };

  const writeExpression = (value: string, focus = true) => {
    changeExpression(value);
    if (editor.current) { editor.current.setValue(value, { silenceNotifications: true }); editor.current.position = -1; if (focus) editor.current.focus(); }
  };

  const useExpression = (value: string, angle?: AngleMode) => {
    navigate('calculator');
    if (angle) updatePreference('angle', angle);
    writeExpression(value, false); setDialog(null);
    requestAnimationFrame(() => { if (editor.current) { editor.current.position = -1; editor.current.focus(); } });
  };

  const clear = () => { writeExpression(''); setResult(null); setExact(false); };

  const addHistory = (calculation: CalculationResult, saved = false, source = expression) => {
    setHistory((previous) => {
      const match = previous.find((entry) => entry.expression === source && entry.angle === preferences.angle);
      if (match && saved) return previous.map((entry) => entry.id === match.id ? { ...entry, saved: !entry.saved } : entry);
      if (match) return [{ ...match, result: calculation, createdAt: Date.now() }, ...previous.filter((entry) => entry.id !== match.id)];
      return trimHistory([{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, expression: source, result: calculation, angle: preferences.angle, createdAt: Date.now(), saved }, ...previous]);
    });
  };

  const compute = () => {
    try {
      const source = editor.current?.value ?? expression;
      const answer = calculate(source, preferences.angle, preferences.precision);
      setExpression(source);
      setResult(answer); setError(''); setHasCalculated(true); setLastAnswer(answer.decimal);
      justEvaluated.current = true;
      addHistory(answer, false, source);
    } catch (caught) { setResult(null); setError(caught instanceof Error ? caught.message : 'تعذر الحساب. تحقق من التعبير.'); }
  };

  const insert = (latex: string) => {
    const field = editor.current;
    if (!field) return;
    if (justEvaluated.current) {
      const continueFromAnswer = latex.includes('#@') || ['+', '-', '\\times', '\\%', '!'].includes(latex);
      field.setValue(continueFromAnswer ? (result?.decimal || expression) : '', { silenceNotifications: true });
      field.position = -1;
      justEvaluated.current = false;
    }
    field.focus();
    field.insert(latex, { insertionMode: 'replaceSelection', selectionMode: 'placeholder', format: 'latex' });
    changeExpression(field.value);
  };

  const pressKey = (key: KeyDef) => {
    if (key.insert !== undefined) { insert(key.insert); return; }
    switch (key.action) {
      case 'second': setSecond((value) => !value); break;
      case 'clear': clear(); break;
      case 'delete': editor.current?.executeCommand('deleteBackward'); if (editor.current) { changeExpression(editor.current.value); editor.current.focus(); } break;
      case 'equals': compute(); break;
      case 'sign': if (!expression) insert('-'); else writeExpression(`-\\left(${expression}\\right)`); break;
      case 'ans': insert(lastAnswer); break;
      case 'derivative': case 'integral': case 'statistics': case 'matrix': setDialog(key.action); break;
    }
  };

  const physicalKey = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === '=') { event.preventDefault(); event.stopPropagation(); compute(); return; }
    if (justEvaluated.current && /^[0-9٠-٩۰-۹.+\-*/^()]$/.test(event.key)) {
      event.preventDefault(); event.stopPropagation();
      const templates: Record<string, string> = { '*': '\\times', '/': '\\frac{#@}{#?}', '^': '{#@}^{#?}' };
      insert(templates[event.key] || normalizeDigits(event.key));
    }
  };

  const copy = async (text: string) => {
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(text);
      else {
        const textarea = document.createElement('textarea');
        textarea.value = text; textarea.style.position = 'fixed'; textarea.style.opacity = '0';
        document.body.appendChild(textarea); textarea.select();
        const success = document.execCommand('copy'); textarea.remove();
        if (!success) throw new Error('clipboard unavailable');
      }
      notify('نُسخت النتيجة إلى الحافظة');
    } catch { notify('تعذر النسخ. اسمح بالوصول إلى الحافظة في المتصفح.'); }
  };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && sidebarOpen) { event.preventDefault(); setSidebarOpen(false); return; }
      if (page !== 'calculator' || dialog || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT', 'MATH-FIELD'].includes(target.tagName) || target.closest('math-field')) return;
      if (/^[0-9٠-٩۰-۹.+\-()]$/.test(event.key)) { event.preventDefault(); insert(normalizeDigits(event.key)); }
      else if (event.key === '*') { event.preventDefault(); insert('\\times'); }
      else if (event.key === '/') { event.preventDefault(); insert('\\frac{#@}{#?}'); }
      else if (event.key === '^') { event.preventDefault(); insert('{#@}^{#?}'); }
      else if (event.key === '=') { event.preventDefault(); compute(); }
      else if (event.key === 'Enter' && target.tagName !== 'BUTTON') { event.preventDefault(); compute(); }
      else if (event.key === 'Escape') { event.preventDefault(); clear(); }
      else if (event.key === 'Backspace') { event.preventDefault(); pressKey(NUMBER_KEYS[1]); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });

  const historyProps = {
    history,
    onRestore: (value: string, angle: AngleMode) => useExpression(value, angle),
    onSave: (id: string) => setHistory((previous) => previous.map((entry) => entry.id === id ? { ...entry, saved: !entry.saved } : entry)),
    onDelete: (id: string) => { setHistory((previous) => previous.filter((entry) => entry.id !== id)); notify('حُذفت العملية من السجل'); },
    onClear: () => setDialog('clear'),
    onCopy: copy,
  };

  const editingCommand = (command: 'undo' | 'redo' | 'moveToNextChar' | 'moveToPreviousChar' | 'moveUp' | 'moveDown') => {
    justEvaluated.current = false;
    editor.current?.executeCommand(command);
    if (editor.current) { if (command === 'undo' || command === 'redo') changeExpression(editor.current.value); editor.current.focus(); }
  };

  return <div className="app-shell" dir="rtl">
    {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
      <div className="brand-row"><Brand onClick={() => navigate('calculator')} /><button className="icon-button mobile-close" aria-label="إغلاق القائمة" onClick={() => setSidebarOpen(false)}><X size={20} /></button></div>
      <nav className="sidebar-nav" aria-label="التنقل الرئيسي">
        <p className="nav-section-label">مساحة العمل</p>
        {NAV_ITEMS.slice(0, 4).map(({ id, title: navTitle, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}>{page === id && <motion.span layoutId="navigation-highlight" className="nav-highlight" transition={{ type: 'spring', stiffness: 430, damping: 36 }} />}<Icon size={19} /><span>{navTitle}</span>{id === 'calculator' && <span className="nav-badge">{scientific ? 'علمية' : 'أساسية'}</span>}</button>)}
        <div className="nav-divider" /><p className="nav-section-label">مكتبتك</p>
        {NAV_ITEMS.slice(4).map(({ id, title: navTitle, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}>{page === id && <motion.span layoutId="navigation-highlight" className="nav-highlight" transition={{ type: 'spring', stiffness: 430, damping: 36 }} />}<Icon size={19} /><span>{navTitle}</span>{id === 'saved' && history.some((entry) => entry.saved) && <span className="saved-count latin">{history.filter((entry) => entry.saved).length}</span>}</button>)}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-thought"><span className="infinity-mark"><MathText latex={'\\infty'} /></span><p>فضولك بلا حدود.<br /><strong>وكذلك أفكارك.</strong></p></div><button className="nav-item" onClick={() => setDialog('settings')}><Settings2 size={19} /><span>تفضيلات التطبيق</span></button><div className="sidebar-version"><span>بُرهان <span className="latin">1.0</span></span><span className="version-dot" /> صُمّم للمعرفة</div></div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="فتح القائمة" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button><LayoutGrid size={17} className="breadcrumb-icon" /><span className="breadcrumb-parent">مساحة العمل</span><ChevronLeft size={13} /><strong>{NAV_ITEMS.find((item) => item.id === page)?.title}</strong></div><div className="topbar-actions"><button className="help-button" onClick={() => setDialog('help')}><CircleHelp size={18} /><span>دليل الاستخدام</span></button><span className="topbar-divider" /><button className="icon-button theme-button" aria-label={preferences.theme === 'light' ? 'تفعيل الوضع الداكن' : 'تفعيل الوضع الفاتح'} onClick={() => updatePreference('theme', preferences.theme === 'light' ? 'dark' : 'light')}>{preferences.theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}</button><button className="workspace-avatar" aria-label="تفضيلات مساحة الطالب" onClick={() => setDialog('settings')}>ط</button></div></header>

      <main className="main-content">
        <div className="page-heading"><motion.div key={page} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}><h1>{title.first} <span>{title.accent}</span></h1><p>{title.description}</p></motion.div><button className="new-calculation-button" aria-label="مسألة جديدة" onClick={() => useExpression('')}><Plus size={17} /><span>مسألة جديدة</span></button></div>

        <motion.div className="page-body" key={page} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.04 }}>
          {page === 'calculator' && <div className="calculator-layout"><div className="calculator-column"><section className="calculator" aria-label="الآلة الحاسبة العلمية">
            <div className="calculator-toolbar"><div className="mode-switch" role="group" aria-label="نوع الحاسبة"><button className={scientific ? 'active' : ''} onClick={() => setScientific(true)}><Atom size={16} />علمية</button><button className={!scientific ? 'active' : ''} onClick={() => setScientific(false)}><Calculator size={15} />أساسية</button></div><div className="calculator-options"><div className="angle-switch" dir="ltr" role="group" aria-label="وحدة الزوايا">{(['deg', 'rad'] as AngleMode[]).map((angle) => <button className={preferences.angle === angle ? 'active' : ''} key={angle} aria-pressed={preferences.angle === angle} title={angle === 'deg' ? 'الزوايا بالدرجات' : 'الزوايا بالراديان'} onClick={() => { updatePreference('angle', angle); setError(''); setHasCalculated(false); }}>{angle.toUpperCase()}</button>)}</div><button className="icon-button" title="خيارات الحاسبة" aria-label="خيارات الحاسبة" onClick={() => setDialog('settings')}><Ellipsis size={20} /></button></div></div>

            <div className={`calculator-display ${error ? 'has-error' : ''}`}><div className="display-topline"><span>التعبير الرياضي</span><span className="natural-writing"><span /> كتابة طبيعية</span></div>
              <MathEditor className="main-math-editor" value={expression} onChange={changeExpression} onEnter={compute} onEscape={clear} onInteract={() => { justEvaluated.current = false; }} onKeyDown={physicalKey} editorRef={editor} label="محرر المسألة الرياضية" />
              <div className="display-result-row"><div className="result-area" aria-live="polite">{error ? <p className="display-error" role="alert">{error}</p> : <AnimatePresence mode="wait"><motion.div className="result-value" dir="ltr" key={`${result?.text || '0'}-${exact}`} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.15 }}><span className="result-equals">=</span>{result ? result.kind === 'number' && !exact && !result.text.includes('e') ? <span className="latin">{result.text}</span> : <MathText latex={exact ? result.exact : result.decimal} /> : <span className={`latin ${expression ? 'pending-result' : ''}`}>{expression ? '...' : '0'}</span>}</motion.div></AnimatePresence>}</div>
                <div className="display-actions"><button className={`icon-button tiny ${currentSaved ? 'is-saved' : ''}`} aria-label={currentSaved ? 'إلغاء حفظ النتيجة' : 'حفظ النتيجة'} disabled={!result} onClick={() => { if (result) { addHistory(result, true); notify(currentSaved ? 'أُزيلت العملية من المحفوظات' : 'أُضيفت العملية إلى المحفوظات'); } }}><Bookmark size={16} fill={currentSaved ? 'currentColor' : 'none'} /></button><button className="icon-button tiny" aria-label="نسخ النتيجة" disabled={!result} onClick={() => result && copy(exact ? result.exact : result.text)}><Copy size={15} /></button><span className="display-action-divider" /><button className={`format-toggle ${exact ? 'active' : ''}`} disabled={!result} title="التبديل بين الناتج العشري والصيغة الدقيقة" onClick={() => setExact((value) => !value)}><ArrowLeftRight size={13} /><span>{exact ? 'دقيق' : 'عشري'}</span></button></div>
              </div>
            </div>

            <div className="function-toolbar"><div className="function-tabs" role="group" aria-label="مجموعات الدوال">{scientific ? ([['common', 'شائعة'], ['trig', 'مثلثية'], ['advanced', 'متقدمة']] as [KeyGroup, string][]).map(([id, name]) => <button key={id} className={group === id ? 'active' : ''} onClick={() => setGroup(id)}>{name}</button>) : <span className="basic-label">العمليات الأساسية</span>}</div><div className="editing-tools"><button className="icon-button tiny" aria-label="تراجع" title="تراجع" onPointerDown={(event) => event.preventDefault()} onClick={() => editingCommand('undo')}><Undo2 size={16} /></button><button className="icon-button tiny" aria-label="إعادة" title="إعادة" onPointerDown={(event) => event.preventDefault()} onClick={() => editingCommand('redo')}><Redo2 size={16} /></button><span className="editing-divider" /><button className="icon-button tiny" aria-label="تحريك المؤشر إلى اليسار" title="الموضع السابق" onPointerDown={(event) => event.preventDefault()} onClick={() => editingCommand('moveToPreviousChar')}><ArrowLeft size={15} /></button><button className="icon-button tiny" aria-label="تحريك المؤشر إلى اليمين والخروج من الأس" title="الموضع التالي" onPointerDown={(event) => event.preventDefault()} onClick={() => editingCommand('moveToNextChar')}><ArrowRight size={15} /></button></div></div>

            <div className={`keypad ${scientific ? '' : 'basic-keypad'}`} dir="ltr">{scientific && <div className="scientific-keys">{getScientificKeys(group, second).map((item) => <KeyButton key={item.id} item={item} onPress={pressKey} />)}</div>}<div className="number-keys">{NUMBER_KEYS.map((item) => <KeyButton key={item.id} item={item} onPress={pressKey} />)}</div></div>

            <div className="calculator-footer"><button className="keyboard-help" onClick={() => setDialog('help')}><Keyboard size={16} /><span>لوحة المفاتيح مدعومة</span><kbd>Enter</kbd><span className="enter-description">للحساب</span></button><div className="memory-controls" dir="ltr"><span className={`memory-indicator ${memory !== null ? 'active' : ''}`} title={memory !== null ? `الذاكرة: ${memory}` : 'الذاكرة فارغة'} /><button disabled={memory === null} title="مسح الذاكرة" aria-label="مسح الذاكرة" onClick={() => { setMemory(null); notify('مُسحت الذاكرة'); }}>MC</button><button disabled={memory === null} title="استدعاء الذاكرة" aria-label="استدعاء الذاكرة" onClick={() => memory !== null && insert(numberLatex(memory))}>MR</button><button disabled={result?.numeric == null} title="إضافة النتيجة إلى الذاكرة" aria-label="إضافة النتيجة إلى الذاكرة" onClick={() => { if (result?.numeric != null) { const total = (memory ?? 0) + result.numeric; if (Number.isFinite(total)) { setMemory(total); notify('أُضيفت النتيجة إلى الذاكرة'); } else notify('القيمة تتجاوز النطاق العددي للذاكرة'); } }}>M+</button></div></div>
          </section><div className="under-calculator"><span><LockKeyhole size={13} />{storageAvailable ? 'حساباتك تبقى على جهازك. خصوصيتك أولًا.' : 'التخزين غير متاح. السجل محفوظ لهذه الجلسة فقط.'}</span><button onClick={() => setDialog('help')}>تعرّف على الاختصارات <ChevronLeft size={13} /></button></div></div><HistoryPanel {...historyProps} onViewAll={() => navigate('history')} /></div>}
          {page === 'equations' && <EquationWorkspace onUse={useExpression} />}
          {page === 'graph' && <GraphWorkspace />}
          {page === 'converter' && <ConverterWorkspace onCopy={copy} onUse={useExpression} />}
          {page === 'constants' && <ConstantsWorkspace onUse={useExpression} />}
          {(page === 'history' || page === 'saved') && <HistoryWorkspace {...historyProps} savedOnly={page === 'saved'} />}
        </motion.div>
        <footer className="workspace-footer"><span>من أول مسألة، إلى أبعد فكرة.</span><span>بُرهان <span className="footer-dot" /> صُمم لشغفك بالمعرفة</span></footer>
      </main>
    </div>

    <AnimatePresence>
      {dialog && ['derivative', 'integral', 'matrix', 'statistics'].includes(dialog) && <AdvancedTools key={dialog} tool={dialog as AdvancedTool} onClose={() => setDialog(null)} onUse={useExpression} onCopy={copy} />}
      {dialog === 'help' && <Modal title="اكتب الرياضيات، كما تفكّر بها." subtitle="خطوات صغيرة، لتجربة أكثر سلاسة." onClose={() => setDialog(null)} wide>
        <div className="help-intro"><BookOpen size={21} /><p>اضغط داخل التعبير لتعديله، أو ابدأ مباشرة باستخدام لوحة الحاسبة. يمكنك النقر على أي خانة رياضية للكتابة داخلها.</p></div>
        <div className="help-examples"><div><MathText latex={'x^{\\color{#8c70df}{\\placeholder{}}}'} /><h3>أسس في مكانها</h3><p>اختر زر الأس، واكتب داخل الخانة العلوية. استخدم السهم الأيمن للعودة إلى السطر.</p></div><div><MathText latex={'\\frac{\\placeholder{}}{\\placeholder{}}'} /><h3>كسور لا شرطات</h3><p>اختر زر الكسر، ثم اكتب البسط والمقام. تنقّل بين الخانات بالنقر أو بمفتاح Tab.</p></div><div><MathText latex={'\\sin\\left(\\placeholder{}\\right)'} /><h3>دوال واضحة</h3><p>اختر الدالة واكتب قيمتها بين القوسين. تأكد من وحدة الزوايا DEG أو RAD.</p></div></div>
        <h3 className="shortcuts-title">اختصارات تجعل الفكرة أسرع</h3><div className="shortcut-table"><div><span>حساب النتيجة</span><kbd>Enter <CornerDownLeft size={12} /></kbd></div><div><span>مسح التعبير</span><kbd>Esc</kbd></div><div><span>حذف الرمز السابق</span><kbd>Backspace</kbd></div><div><span>الخانة التالية</span><kbd>Tab</kbd></div><div><span>التنقل داخل التعبير</span><div className="arrow-shortcuts">{[ArrowLeft, ArrowUp, ArrowDown, ArrowRight].map((Icon, index) => <kbd key={index}><Icon size={12} /></kbd>)}</div></div><div><span>التراجع عن الكتابة</span><kbd>Ctrl + Z</kbd></div></div>
        <p className="small-note help-note">من تبويب «متقدمة» ستجد أدوات المصفوفات والإحصاء والتفاضل والتكامل. تُحفظ العمليات على هذا المتصفح فقط.</p><button className="primary-button wide-button" onClick={() => setDialog(null)}>لنبدأ التفكير <ArrowLeft size={16} /></button>
      </Modal>}
      {dialog === 'settings' && <Modal title="على طريقتك." subtitle="اضبط مساحة العمل لتناسب أسلوبك." onClose={() => setDialog(null)}>
        <div className="setting-row"><div><h3>المظهر</h3><p>مساحة مريحة لعينيك</p></div><div className="segmented-control"><button className={preferences.theme === 'light' ? 'active' : ''} onClick={() => updatePreference('theme', 'light')}><Sun size={16} />فاتح</button><button className={preferences.theme === 'dark' ? 'active' : ''} onClick={() => updatePreference('theme', 'dark')}><Moon size={16} />داكن</button></div></div>
        <div className="setting-row"><div><h3>وحدة الزوايا</h3><p>للدوال المثلثية في الحاسبة</p></div><select className="form-select setting-select" value={preferences.angle} aria-label="وحدة الزوايا الافتراضية" onChange={(event) => updatePreference('angle', event.target.value as AngleMode)}><option value="deg">درجات (DEG)</option><option value="rad">راديان (RAD)</option></select></div>
        <div className="setting-row"><div><h3>دقة العرض</h3><p>عدد الأرقام المعنوية في النتائج</p></div><select className="form-select setting-select" value={preferences.precision} aria-label="دقة النتائج" onChange={(event) => updatePreference('precision', Number(event.target.value))}>{[8, 12, 15].map((precision) => <option value={precision} key={precision}>{precision} رقمًا</option>)}</select></div>
        <div className="setting-row"><div><h3>المعاينة المباشرة</h3><p>شاهد النتيجة أثناء كتابة المسألة</p></div><button className={`toggle-switch ${preferences.livePreview ? 'on' : ''}`} role="switch" aria-checked={preferences.livePreview} aria-label="المعاينة المباشرة" onClick={() => updatePreference('livePreview', !preferences.livePreview)}><span /></button></div>
        <div className="settings-footer"><button className="text-button" onClick={() => { setPreferences(defaultPreferences); notify('أُعيدت التفضيلات الافتراضية'); }}>استعادة الافتراضي</button><button className="primary-button" onClick={() => { setDialog(null); notify('حُفظت تفضيلاتك'); }}>حفظ التفضيلات <Check size={17} /></button></div>
      </Modal>}
      {dialog === 'clear' && <Modal title="مساحة لبداية جديدة؟" subtitle="سيُحذف سجل العمليات غير المحفوظة. تبقى المسائل المحفوظة في مكتبتك." onClose={() => setDialog(null)}><div className="confirm-actions"><button className="danger-button" onClick={() => { setHistory((previous) => previous.filter((entry) => entry.saved)); setDialog(null); notify('مُسح السجل مع الاحتفاظ بالمحفوظات'); }}><Trash2 size={17} />حذف السجل</button><button className="secondary-button" onClick={() => setDialog(null)}>الاحتفاظ بالسجل</button></div></Modal>}
    </AnimatePresence>
    <AnimatePresence>{toast && <motion.div className="toast" role="status" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}><span><Check size={16} /></span>{toast}<button aria-label="إغلاق التنبيه" onClick={() => setToast('')}><X size={15} /></button></motion.div>}</AnimatePresence>
  </div>;
}
