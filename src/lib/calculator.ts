import { ComputeEngine } from '@cortex-js/compute-engine';
import { compile, derivative, det, inv, parse, transpose } from 'mathjs';

export type AngleMode = 'deg' | 'rad';

export interface CalculationResult {
  decimal: string;
  exact: string;
  text: string;
  numeric: number | null;
  kind: 'number' | 'symbolic' | 'complex';
}

export interface HistoryEntry {
  id: string;
  expression: string;
  result: CalculationResult;
  angle: AngleMode;
  createdAt: number;
  saved: boolean;
}

export function trimHistory(entries: HistoryEntry[]): HistoryEntry[] {
  let recentCount = 0;
  return entries.filter((entry) => entry.saved || ++recentCount <= 150);
}

const engines = {
  deg: new ComputeEngine({ precision: 30 }),
  rad: new ComputeEngine({ precision: 30 }),
};
engines.deg.angularUnit = 'deg';
engines.rad.angularUnit = 'rad';

export const INITIAL_EXPRESSION = String.raw`\frac{3}{4}+\sin\left(30\right)\times2^{3}`;

export const EXAMPLES = [
  { name: 'الكسور والأسس', expression: String.raw`\frac{3}{4}+2^{3}`, answer: '8.75', angle: 'deg' as AngleMode },
  { name: 'الدوال المثلثية', expression: String.raw`\sin\left(30\right)+\cos\left(60\right)`, answer: '1', angle: 'deg' as AngleMode },
  { name: 'الجذور واللوغاريتمات', expression: String.raw`\sqrt{144}+\log\left(100\right)`, answer: '14', angle: 'deg' as AngleMode },
];

export function normalizeDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/٫/g, '.');
}

export function formatNumber(value: number, precision = 12): string {
  if (!Number.isFinite(value)) throw new Error('النتيجة غير معرّفة. تحقق من مجال الدالة والمقام.');
  return Number(value.toPrecision(precision)).toString();
}

export function numberLatex(value: number | string, precision = 12): string {
  const text = typeof value === 'number' ? formatNumber(value, precision) : value;
  return text.replace(/e\+?(-?\d+)/i, '\\times 10^{$1}');
}

function validateExpression(latex: string) {
  if (!latex.trim()) throw new Error('اكتب مسألتك أولًا، ثم اضغط على يساوي.');
  if (latex.length > 2000) throw new Error('التعبير طويل جدًا. جرّب تقسيمه إلى خطوات أصغر.');
  if (/\\placeholder|\\error|\\blacksquare|\\square/.test(latex)) {
    throw new Error('أكمل الخانات الفارغة في التعبير أولًا.');
  }
}

export function calculate(latex: string, angle: AngleMode = 'deg', precision = 12): CalculationResult {
  validateExpression(latex);
  const engine = engines[angle];
  const expression = engine.parse(normalizeDigits(latex));
  if (!expression.isValid) throw new Error('تحقق من اكتمال الأقواس وخانات الكسور والأسس.');
  const exact = expression.evaluate();
  const approximation = expression.N();

  if (approximation.numericValue !== null) {
    const real = approximation.re;
    const imaginary = approximation.im;
    const bigReal = approximation.bignumRe;
    if (imaginary === 0 && bigReal?.isFinite()) {
      const text = bigReal.toSignificantDigits(precision).toString();
      return { decimal: numberLatex(text), exact: exact.latex, text, numeric: Number.isFinite(real) && (real !== 0 || bigReal.isZero()) ? real : null, kind: 'number' };
    }
    if (!Number.isFinite(real) || !Number.isFinite(imaginary)) {
      throw new Error('النتيجة غير معرّفة. تحقق من المقام أو مجال الدالة.');
    }
    if (imaginary !== 0) {
      const text = `${formatNumber(real, precision)} ${imaginary < 0 ? '-' : '+'} ${formatNumber(Math.abs(imaginary), precision)}i`;
      const imaginaryLatex = `${Math.abs(imaginary) === 1 ? '' : numberLatex(Math.abs(imaginary), precision)}i`;
      const decimal = real === 0 ? `${imaginary < 0 ? '-' : ''}${imaginaryLatex}` : `${numberLatex(real, precision)} ${imaginary < 0 ? '-' : '+'} ${imaginaryLatex}`;
      return { decimal, exact: exact.latex, text, numeric: null, kind: 'complex' };
    }
    const text = formatNumber(real, precision);
    return { decimal: numberLatex(text), exact: exact.latex, text, numeric: real, kind: 'number' };
  }

  if (expression.unknowns.length > 0) {
    const simplified = expression.simplify().latex;
    return { decimal: simplified, exact: simplified, text: simplified, numeric: null, kind: 'symbolic' };
  }
  if (approximation.symbol === 'True' || approximation.symbol === 'False') {
    const text = approximation.symbol === 'True' ? 'صحيح' : 'غير صحيح';
    return { decimal: `\\text{${text}}`, exact: `\\text{${text}}`, text, numeric: null, kind: 'symbolic' };
  }
  throw new Error('تعذر حساب هذا التعبير. استخدم أدوات التحليل للعمليات المتقدمة.');
}

// Convert the parsed expression tree, never raw user text, into a mathjs expression.
function jsonToMath(node: unknown): string {
  if (typeof node === 'number') return String(node);
  if (typeof node === 'string') {
    const constants: Record<string, string> = { Pi: 'pi', ExponentialE: 'e', EulerE: 'e', ImaginaryUnit: 'i', Half: '(1/2)' };
    if (constants[node]) return constants[node];
    if (/^[a-zA-Z]$/.test(node) || /^-?\d+(\.\d+)?$/.test(node)) return node;
    throw new Error('هذا الرمز غير مدعوم في هذه الأداة.');
  }
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    const object = node as { num?: string; sym?: string; fn?: unknown[] };
    if (object.num !== undefined && Number.isFinite(Number(object.num))) return object.num;
    if (object.sym) return jsonToMath(object.sym);
    if (object.fn) return jsonToMath(object.fn);
  }
  if (!Array.isArray(node) || !node.length) throw new Error('تعذر قراءة التعبير الرياضي.');
  const [operator, ...operands] = node;
  const args = operands.map(jsonToMath);
  const join = (symbol: string) => `(${args.join(symbol)})`;
  const functions: Record<string, string> = {
    Sin: 'sin', Cos: 'cos', Tan: 'tan', Cot: 'cot', Sec: 'sec', Csc: 'csc',
    Arcsin: 'asin', Arccos: 'acos', Arctan: 'atan', Sinh: 'sinh', Cosh: 'cosh', Tanh: 'tanh',
    Arsinh: 'asinh', Arcosh: 'acosh', Artanh: 'atanh', Sqrt: 'sqrt', Abs: 'abs',
    Exp: 'exp', Ceil: 'ceil', Floor: 'floor', Factorial: 'factorial',
    Min: 'min', Max: 'max', GCD: 'gcd', LCM: 'lcm', Binomial: 'combinations',
  };
  if (functions[String(operator)]) return `${functions[String(operator)]}(${args.join(',')})`;
  switch (operator) {
    case 'Add': return join('+');
    case 'Multiply': return join('*');
    case 'Subtract': return join('-');
    case 'Divide':
    case 'Rational': return join('/');
    case 'Power': return join('^');
    case 'Negate': return `(-${args[0]})`;
    case 'Square': return `(${args[0]}^2)`;
    case 'Root': return `nthRoot(${args[0]},${args[1] || '2'})`;
    case 'Ln': return `log(${args[0]})`;
    case 'Log': return `log(${args[0]},${args[1] || '10'})`;
    case 'Log2': return `log(${args[0]},2)`;
    case 'Log10': return `log(${args[0]},10)`;
    case 'Delimiter': return args[0];
    default: throw new Error('تحتوي الدالة على عملية غير مدعومة في هذه الأداة.');
  }
}

export function toMathExpression(latex: string) {
  validateExpression(latex);
  const expression = engines.rad.parse(normalizeDigits(latex));
  if (!expression.isValid) throw new Error('أكمل التعبير الرياضي وتحقق من الأقواس.');
  return jsonToMath(expression.json);
}

export function compileFunction(latex: string, variable = 'x'): (value: number) => number {
  const unknowns = engines.rad.parse(normalizeDigits(latex)).unknowns;
  if (unknowns.some((name) => name !== variable)) throw new Error(`استخدم المتغير ${variable} فقط في هذه الدالة.`);
  const compiled = compile(toMathExpression(latex));
  return (value) => {
    const result: unknown = compiled.evaluate({ [variable]: value });
    return typeof result === 'number' ? result : NaN;
  };
}

export function solveEquation(latex: string, variable = 'x'): string[] {
  validateExpression(latex);
  const expression = engines.rad.parse(normalizeDigits(latex));
  if (!expression.isValid) throw new Error('تحقق من كتابة طرفي المعادلة بصورة صحيحة.');
  if (!expression.has(variable)) throw new Error(`يجب أن تحتوي المعادلة على المتغير ${variable}.`);
  const roots = expression.solve(variable);
  if (!roots?.length) throw new Error('لم يُعثر على حل بهذه الأداة. جرّب معادلة خطية أو تربيعية بمتغير واحد.');
  return roots.map((root) => root.simplify().latex);
}

export function differentiate(latex: string, variable: string, order: number): string {
  let expression = parse(toMathExpression(latex));
  for (let i = 0; i < order; i++) expression = derivative(expression, variable);
  return expression.toTex({ parenthesis: 'auto', implicit: 'hide' });
}

export function integrate(latex: string, lower: number, upper: number, variable = 'x'): number {
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) throw new Error('أدخل حدين عدديين محدودين للتكامل.');
  const f = compileFunction(latex, variable);
  if (lower === upper) return 0;
  let evaluations = 0;
  const sample = (x: number) => {
    if (++evaluations > 20000) throw new Error('لم يتقارب التكامل. جرّب مجالًا أصغر أو دالة متصلة.');
    const y = f(x);
    if (!Number.isFinite(y)) throw new Error('الدالة غير معرّفة في مجال التكامل المحدد.');
    return y;
  };
  // The embedded Gauss-Kronrod pair estimates error without an evenly spaced sampling grid.
  const nodes = [0.9914553711208126, 0.9491079123427585, 0.8648644233597691, 0.7415311855993945, 0.5860872354676911, 0.4058451513773972, 0.20778495500789847];
  const kronrodWeights = [0.022935322010529224, 0.06309209262997855, 0.10479001032225019, 0.1406532597155259, 0.1690047266392679, 0.1903505780647854, 0.20443294007529889];
  const gaussWeights = [0.1294849661688697, 0.27970539148927667, 0.38183005050511895];
  const recurse = (a: number, b: number, tolerance: number, depth: number): number => {
    const midpoint = a / 2 + b / 2;
    const half = b / 2 - a / 2;
    const centerValue = sample(midpoint);
    let kronrod = centerValue * 0.20948214108472783;
    let gauss = centerValue * 0.4179591836734694;
    for (let i = 0; i < nodes.length; i++) {
      const pair = sample(midpoint - half * nodes[i]) + sample(midpoint + half * nodes[i]);
      kronrod += kronrodWeights[i] * pair;
      if (i % 2 === 1) gauss += gaussWeights[(i - 1) / 2] * pair;
    }
    const value = kronrod * half;
    const error = Math.abs((kronrod - gauss) * half);
    if (depth < 17 && error <= tolerance * Math.max(1, Math.abs(value))) return value;
    if (depth <= 0) throw new Error('لم يتقارب التكامل إلى الدقة المطلوبة.');
    return recurse(a, midpoint, tolerance / 2, depth - 1) + recurse(midpoint, b, tolerance / 2, depth - 1);
  };
  sample(lower); sample(upper);
  return recurse(lower, upper, 1e-9, 18);
}

export function matrixOperation(values: number[][], operation: 'det' | 'inverse' | 'transpose'): string {
  if (values.some((row) => row.some((value) => !Number.isFinite(value)))) throw new Error('أدخل رقمًا صالحًا في كل خانة.');
  if (operation === 'det') return numberLatex(det(values));
  if (operation === 'inverse' && det(values) === 0) throw new Error('هذه المصفوفة منفردة، وليس لها معكوس.');
  const result = (operation === 'inverse' ? inv(values) : transpose(values)) as number[][];
  return `\\begin{bmatrix}${result.map((row) => row.map((value) => numberLatex(value)).join('&')).join('\\\\')}\\end{bmatrix}`;
}

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}