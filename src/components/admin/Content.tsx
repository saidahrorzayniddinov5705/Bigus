import React, { useEffect, useState } from 'react';
import { PlusCircle, Pencil, Trash2, Newspaper, Video, HelpCircle, X } from 'lucide-react';
import { api } from '../../lib/api';
import { extractYoutubeId } from '../../lib/utils';
import { Card, Btn, Field, inputCls, Empty, Modal, errText, fmtDate } from './ui';
import { cn } from '../../lib/utils';

const LANGS = [['uz', "O'zbek"], ['uz-cyrl', 'Ўзбек'], ['ru', 'Русский'], ['en', 'English']] as const;
type L = typeof LANGS[number][0];
const emptyI18n = () => ({ uz: '', 'uz-cyrl': '', ru: '', en: '' });
const emptyQuestion = () => ({ question: emptyI18n(), options: [emptyI18n(), emptyI18n(), emptyI18n(), emptyI18n()], correctOptionIndex: 0 });

function LangTabs({ lang, setLang }: { lang: L; setLang: (l: L) => void }) {
  return (
    <div className="flex gap-1 bg-white/5 p-1 rounded-full w-fit max-w-full overflow-x-auto">
      {LANGS.map(([id, label]) => (
        <button key={id} type="button" onClick={() => setLang(id)} className={cn('shrink-0 px-3 py-1 rounded-full text-xs font-bold', lang === id ? 'bg-cyan-400/15 text-cyan-300' : 'text-zinc-400')}>
          {label}{id === 'uz' ? ' *' : ''}
        </button>
      ))}
    </div>
  );
}

function QuizEditor({ quiz, setQuiz, lang }: { quiz: any[]; setQuiz: (q: any[]) => void; lang: L }) {
  const upd = (i: number, fn: (q: any) => void) => { const c = JSON.parse(JSON.stringify(quiz)); fn(c[i]); setQuiz(c); };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-black text-white flex items-center gap-2 text-sm"><HelpCircle className="w-4 h-4 text-cyan-400" /> Test savollari ({quiz.length})</h4>
        <Btn variant="ghost" type="button" onClick={() => setQuiz([...quiz, emptyQuestion()])}><PlusCircle className="w-4 h-4" /> Savol</Btn>
      </div>
      {quiz.length === 0 && <p className="text-xs text-zinc-500">Test ixtiyoriy. Bo'sh savollar saqlanmaydi.</p>}
      {quiz.map((q, i) => (
        <div key={i} className="p-4 rounded-2xl bg-black/20 border border-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 shrink-0 rounded-lg bg-cyan-500/20 text-cyan-300 font-black text-sm flex items-center justify-center">{i + 1}</span>
            <input className={inputCls} value={q.question[lang] || ''} onChange={e => upd(i, x => { x.question[lang] = e.target.value; })} placeholder={`Savol (${lang})`} />
            <button type="button" onClick={() => setQuiz(quiz.filter((_, j) => j !== i))} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg" aria-label="O'chirish"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {q.options.map((o: any, oi: number) => (
              <label key={oi} className={cn('flex items-center gap-2 p-2 rounded-xl border', q.correctOptionIndex === oi ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-white/5')}>
                <input type="radio" name={`correct-${i}`} checked={q.correctOptionIndex === oi} onChange={() => upd(i, x => { x.correctOptionIndex = oi; })} title="To'g'ri javob" />
                <input className="flex-1 bg-transparent outline-none text-sm text-white placeholder-zinc-600" value={o[lang] || ''} onChange={e => upd(i, x => { x.options[oi][lang] = e.target.value; })} placeholder={`${oi + 1}-variant`} />
              </label>
            ))}
          </div>
          <p className="text-[11px] text-zinc-500">Yashil — to'g'ri javob. Kamida 2 ta variant to'ldirilishi kerak.</p>
        </div>
      ))}
    </div>
  );
}

function ContentForm({ kind, initial, onClose, onSaved }: { kind: 'news' | 'videos'; initial?: any; onClose: () => void; onSaved: () => void }) {
  const [lang, setLang] = useState<L>('uz');
  const [title, setTitle] = useState<any>(() => ({ ...emptyI18n(), ...(initial?.title || {}) }));
  const [body, setBody] = useState<any>(() => ({ ...emptyI18n(), ...((kind === 'news' ? initial?.content : initial?.description) || {}) }));
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || '');
  const [category, setCategory] = useState(initial?.category || 'general');
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl || '');
  const [quiz, setQuiz] = useState<any[]>(() => (initial?.quiz || []).map((q: any) => ({ ...emptyQuestion(), ...q, question: { ...emptyI18n(), ...q.question }, options: [0, 1, 2, 3].map(k => ({ ...emptyI18n(), ...(q.options?.[k] || {}) })) })));
  const [busy, setBusy] = useState(false);
  const vid = extractYoutubeId(videoUrl) || (videoUrl.match(/shorts\/([a-zA-Z0-9_-]{11})/)?.[1] ?? null);

  const save = async () => {
    setBusy(true);
    try {
      const payload = kind === 'news' ? { title, content: body, imageUrl, category, quiz } : { title, description: body, videoUrl, quiz };
      if (initial) await api(`/api/admin/${kind}/${initial.id}`, { method: 'PUT', body: payload });
      else await api(`/api/admin/${kind}`, { body: payload });
      onSaved(); onClose();
    } catch (e) { alert(errText(e)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <LangTabs lang={lang} setLang={setLang} />
      <Field label={`Sarlavha (${lang})`}><input className={inputCls} value={title[lang]} onChange={e => setTitle({ ...title, [lang]: e.target.value })} /></Field>
      <Field label={kind === 'news' ? `Matn (${lang})` : `Tavsif (${lang})`} hint={lang !== 'uz' ? "Bo'sh qoldirilsa o'zbekcha matn ko'rsatiladi" : undefined}>
        <textarea className={inputCls} rows={kind === 'news' ? 8 : 3} value={body[lang]} onChange={e => setBody({ ...body, [lang]: e.target.value })} />
      </Field>
      {kind === 'news' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Rasm havolasi (https://...)"><input className={inputCls} value={imageUrl} onChange={e => setImageUrl(e.target.value)} /></Field>
          <Field label="Turi">
            <select className={inputCls} value={category} onChange={e => setCategory(e.target.value)}>
              <option value="general">Yangilik</option><option value="article">Maqola</option><option value="announcement">E'lon</option>
            </select>
          </Field>
          {imageUrl.startsWith('https://') && <img src={imageUrl} alt="" className="sm:col-span-2 w-full max-h-48 object-cover rounded-2xl border border-white/10" />}
        </div>
      ) : (
        <>
          <Field label="YouTube havolasi" hint="Masalan: https://www.youtube.com/watch?v=..."><input className={inputCls} value={videoUrl} onChange={e => setVideoUrl(e.target.value)} /></Field>
          {vid ? <iframe className="w-full aspect-video rounded-2xl border border-white/10" src={`https://www.youtube.com/embed/${vid}`} title="preview" allowFullScreen /> : videoUrl && <p className="text-xs text-red-400 font-bold">Havoladan YouTube video topilmadi.</p>}
        </>
      )}
      <QuizEditor quiz={quiz} setQuiz={setQuiz} lang={lang} />
      <div className="flex gap-3 pt-2">
        <Btn variant="ghost" className="flex-1" onClick={onClose}>Bekor qilish</Btn>
        <Btn className="flex-[2]" disabled={busy || !title.uz.trim()} onClick={save}>{initial ? 'Saqlash' : "E'lon qilish"}</Btn>
      </div>
    </div>
  );
}

export default function ContentManager({ kind }: { kind: 'news' | 'videos' }) {
  const [items, setItems] = useState<any[] | null>(null);
  const [editing, setEditing] = useState<null | { item?: any }>(null);
  const load = () => api<any[]>(`/api/${kind}`).then(setItems).catch(() => setItems([]));
  useEffect(() => { setItems(null); load(); }, [kind]);

  const del = async (item: any) => {
    if (!confirm(`"${item.title?.uz}" — o'chirasizmi?`)) return;
    try { await api(`/api/admin/${kind}/${item.id}`, { method: 'DELETE' }); load(); } catch (e) { alert(errText(e)); }
  };

  const Icon = kind === 'news' ? Newspaper : Video;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-400 font-bold">{items ? `${items.length} ta` : ''}</p>
        <Btn onClick={() => setEditing({})}><PlusCircle className="w-4 h-4" /> {kind === 'news' ? "Yangilik qo'shish" : "Video qo'shish"}</Btn>
      </div>
      {items === null ? <Empty>Yuklanmoqda...</Empty> : items.length === 0 ? <Card><Empty>Hali hech narsa qo'shilmagan</Empty></Card> : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {items.map(it => (
            <Card key={it.id} className="!p-0 overflow-hidden flex flex-col">
              {kind === 'news'
                ? (it.imageUrl ? <img src={it.imageUrl} alt="" className="w-full h-40 object-cover" /> : <div className="h-40 bg-white/5 flex items-center justify-center"><Icon className="w-8 h-8 text-zinc-600" /></div>)
                : <img src={`https://i.ytimg.com/vi/${it.videoId}/hqdefault.jpg`} alt="" className="w-full h-40 object-cover" />}
              <div className="p-5 flex-1 flex flex-col">
                <h4 className="font-black text-white break-words">{it.title?.uz}</h4>
                <p className="text-sm text-zinc-400 line-clamp-2 mt-1 break-words">{kind === 'news' ? it.content?.uz : it.description?.uz}</p>
                <p className="text-[11px] text-zinc-500 mt-3">{fmtDate(it.createdAt)} · test: {it.quiz?.length || 0} savol</p>
                <div className="flex gap-2 mt-4">
                  <Btn variant="ghost" className="flex-1" onClick={() => setEditing({ item: it })}><Pencil className="w-4 h-4" /> Tahrirlash</Btn>
                  <Btn variant="danger" onClick={() => del(it)} aria-label="O'chirish"><Trash2 className="w-4 h-4" /></Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && (
        <Modal wide title={editing.item ? 'Tahrirlash' : kind === 'news' ? 'Yangi yangilik' : 'Yangi video dars'} onClose={() => setEditing(null)}>
          <ContentForm kind={kind} initial={editing.item} onClose={() => setEditing(null)} onSaved={load} />
        </Modal>
      )}
    </div>
  );
}
