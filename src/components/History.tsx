import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpLeft, Bookmark, Check, ChevronLeft, Copy, History, Lightbulb, Search, Trash2 } from 'lucide-react';
import { EXAMPLES, type AngleMode, type HistoryEntry } from '../lib/calculator';
import { MathText } from './MathField';

interface HistoryProps {
  history: HistoryEntry[];
  onRestore: (expression: string, angle: AngleMode) => void;
  onSave: (id: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onCopy: (text: string) => void;
}

function HistoryRow({ entry, onRestore, onSave, onDelete, onCopy, compact = false }: Omit<HistoryProps, 'history' | 'onClear'> & { entry: HistoryEntry; compact?: boolean }) {
  return <motion.div className={`history-row ${compact ? 'compact' : ''}`} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }}>
    <div className="history-meta"><span>{new Date(entry.createdAt).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}</span><span className="latin">{entry.angle.toUpperCase()}</span></div>
    <button className="history-expression" title="إعادة استخدام هذه المسألة" onClick={() => onRestore(entry.expression, entry.angle)}><MathText latex={entry.expression} /></button>
    <div className="history-result-row"><MathText latex={`= ${entry.result.decimal}`} className="history-answer" /><div className="history-row-actions">
      <button className={`icon-button tiny ${entry.saved ? 'is-saved' : ''}`} aria-label={entry.saved ? 'إزالة من المحفوظات' : 'حفظ العملية'} onClick={() => onSave(entry.id)}><Bookmark size={15} fill={entry.saved ? 'currentColor' : 'none'} /></button>
      <button className="icon-button tiny" aria-label="نسخ النتيجة" onClick={() => onCopy(entry.result.text)}><Copy size={14} /></button>
      {!compact && <button className="icon-button tiny" aria-label="حذف العملية" onClick={() => onDelete(entry.id)}><Trash2 size={14} /></button>}
    </div></div>
  </motion.div>;
}

export function HistoryPanel(props: HistoryProps & { onViewAll: () => void }) {
  const [tab, setTab] = useState<'all' | 'saved'>('all');
  const entries = (tab === 'saved' ? props.history.filter((item) => item.saved) : props.history).slice(0, 3);
  return <aside className="history-panel" aria-label="سجل العمليات والأمثلة">
    <div className="history-panel-heading"><h2><History size={18} /> سجل العمليات</h2><button className="icon-button tiny" aria-label="مسح سجل العمليات" disabled={!props.history.some((item) => !item.saved)} onClick={props.onClear}><Trash2 size={16} /></button></div>
    <div className="history-tabs"><button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>الكل <span>{props.history.length}</span></button><button className={tab === 'saved' ? 'active' : ''} onClick={() => setTab('saved')}><Bookmark size={13} /> المحفوظة</button></div>
    {entries.length ? <div className="history-list">{entries.map((entry) => <HistoryRow key={entry.id} entry={entry} {...props} compact />)}</div> : tab === 'saved' ? <div className="mini-empty"><Bookmark size={26} /><h3>احتفظ بما يهمك</h3><p>اضغط على علامة الحفظ بجوار أي نتيجة.</p></div> : <>
      <div className="empty-history-caption"><span className="small-status-dot" /> هنا تبدأ حكاية حلولك.</div>
      <div className="examples-heading">جرّب إحدى هذه المسائل</div>
      <div className="example-list">{EXAMPLES.map((example) => <button key={example.name} className="example-row" onClick={() => props.onRestore(example.expression, example.angle)}>
        <span className="example-label">{example.name}<ArrowUpLeft size={14} /></span>
        <MathText latex={example.expression} />
        <span className="example-answer latin">= {example.answer}</span>
      </button>)}</div>
    </>}
    {props.history.length > 0 && <button className="view-history-button" onClick={props.onViewAll}>عرض السجل الكامل <ChevronLeft size={15} /></button>}
    <div className="natural-note"><span className="note-icon"><Lightbulb size={20} strokeWidth={1.6} /></span><h3>الرياضيات، كما في دفترك.</h3><p>أسس في مكانها، وكسور بشكلها الطبيعي. ركّز على الفكرة، ودع التنسيق لنا.</p><div className="note-formula"><MathText latex={String.raw`\frac{a}{b}\; +\; x^{\color{#8c70df}{n}}`} /><span className="note-dashed-line" /><Check size={16} /></div></div>
  </aside>;
}

export function HistoryWorkspace(props: HistoryProps & { savedOnly?: boolean }) {
  const [search, setSearch] = useState('');
  const entries = props.history.filter((entry) => (!props.savedOnly || entry.saved) && `${entry.expression} ${entry.result.text}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="workspace-panel history-workspace">
    <div className="section-toolbar"><div className="search-field"><Search size={17} /><input aria-label="البحث في العمليات" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث عن تعبير أو نتيجة..." /></div>{!props.savedOnly && <button className="text-button danger-text" onClick={props.onClear} disabled={!props.history.some((item) => !item.saved)}><Trash2 size={16} /> مسح السجل</button>}</div>
    {entries.length ? <div className="full-history-list">{entries.map((entry) => <HistoryRow key={entry.id} entry={entry} {...props} />)}</div> : <div className="large-empty">{props.savedOnly ? <Bookmark size={40} /> : <History size={40} />}<h3>{search ? 'لا توجد نتائج مطابقة' : props.savedOnly ? 'مكان للمسائل التي تستحق العودة' : 'كل حلّ سيجد مكانه هنا'}</h3><p>{search ? 'جرّب البحث برقم مختلف أو جزء من التعبير.' : props.savedOnly ? 'احفظ أي عملية من الآلة الحاسبة لتجدها هنا لاحقًا.' : 'ابدأ بحساب مسألة، وسنحتفظ بها تلقائيًا على جهازك.'}</p><button className="primary-button" onClick={() => props.onRestore('', 'deg')}>الانتقال إلى الآلة الحاسبة <ChevronLeft size={16} /></button></div>}
  </section>;
}