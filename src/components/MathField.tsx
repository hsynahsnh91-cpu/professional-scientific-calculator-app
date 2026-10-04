import { memo, useEffect, useMemo, useRef, type RefObject } from 'react';
import { MathfieldElement, convertAsciiMathToLatex, convertLatexToMarkup } from 'mathlive';
import { normalizeDigits } from '../lib/calculator';
import 'mathlive/fonts.css';
import 'mathlive/static.css';

// Vite bundles the font stylesheet, so the editor does not need a font CDN.
MathfieldElement.fontsDirectory = null;
MathfieldElement.soundsDirectory = null;
MathfieldElement.locale = 'ar';

interface MathEditorProps {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  onEscape?: () => void;
  onInteract?: () => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  editorRef?: RefObject<MathfieldElement | null>;
  label?: string;
  className?: string;
}

export function MathEditor({ value, onChange, onEnter, onEscape, onInteract, onKeyDown, editorRef, label = 'أدخل التعبير الرياضي', className = '' }: MathEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const field = useRef<MathfieldElement | null>(null);
  const callbacks = useRef({ onChange, onEnter, onEscape, onInteract, onKeyDown });
  const initialValue = useRef(value);
  callbacks.current = { onChange, onEnter, onEscape, onInteract, onKeyDown };

  useEffect(() => {
    const mathfield = new MathfieldElement({
      mathVirtualKeyboardPolicy: editorRef ? 'manual' : 'auto',
      smartFence: true,
      smartSuperscript: false,
      defaultMode: 'math',
    });
    mathfield.value = initialValue.current;
    mathfield.setAttribute('dir', 'ltr');
    mathfield.setAttribute('aria-label', label);
    mathfield.placeholder = '\\placeholder{}';
    mathfield.menuItems = [];
    mathfield.inlineShortcuts = { ...mathfield.inlineShortcuts, '*': '\\times', pi: '\\pi', sqrt: '\\sqrt{#?}' };
    const input = () => callbacks.current.onChange(mathfield.value);
    const interact = () => callbacks.current.onInteract?.();
    const keydown = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) interact();
      callbacks.current.onKeyDown?.(event);
      if (event.defaultPrevented) return;
      if (event.key === 'Enter' && callbacks.current.onEnter) {
        event.preventDefault();
        event.stopPropagation();
        callbacks.current.onEnter();
      } else if (event.key === 'Escape' && callbacks.current.onEscape) {
        event.preventDefault();
        event.stopPropagation();
        callbacks.current.onEscape();
      } else if (event.key === '*') {
        event.preventDefault();
        event.stopPropagation();
        mathfield.insert('\\times');
        input();
      } else if (/^[٠-٩۰-۹]$/.test(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        mathfield.insert(normalizeDigits(event.key));
        input();
      }
    };
    const paste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text/plain')?.trim();
      if (!text || text.includes('\\') || text.length > 2000 || !/^[\d\sa-zA-Z٠-٩۰-۹+\-*/^().,%=π×÷−]+$/.test(text)) return;
      try {
        const latex = convertAsciiMathToLatex(normalizeDigits(text).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'pi'));
        if (!latex) return;
        event.preventDefault(); event.stopPropagation();
        mathfield.insert(latex, { format: 'latex', selectionMode: 'after' });
        input();
      } catch { /* Let MathLive handle clipboard formats outside ASCII math. */ }
    };
    mathfield.addEventListener('input', input);
    mathfield.addEventListener('keydown', keydown, true);
    mathfield.addEventListener('pointerdown', interact);
    mathfield.addEventListener('paste', paste, true);
    host.current?.appendChild(mathfield);
    field.current = mathfield;
    if (editorRef) editorRef.current = mathfield;
    return () => {
      mathfield.removeEventListener('input', input);
      mathfield.removeEventListener('keydown', keydown, true);
      mathfield.removeEventListener('pointerdown', interact);
      mathfield.removeEventListener('paste', paste, true);
      mathfield.remove();
      field.current = null;
      if (editorRef) editorRef.current = null;
    };
  }, [editorRef, label]);

  useEffect(() => {
    if (field.current && field.current.value !== value) {
      field.current.setValue(value, { silenceNotifications: true });
    }
  }, [value]);

  return <div className={`math-editor ${className}`} ref={host} dir="ltr" />;
}

export const MathText = memo(function MathText({ latex, className = '' }: { latex: string; className?: string }) {
  const markup = useMemo(() => {
    try { return convertLatexToMarkup(latex, { defaultMode: 'math' }); }
    catch { return ''; }
  }, [latex]);
  return <span className={`math-text ${className}`} dir="ltr" aria-label={latex} dangerouslySetInnerHTML={{ __html: markup }} />;
});