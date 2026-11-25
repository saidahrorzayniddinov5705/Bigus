/**
 * Full article view for a news item: the whole page scrolls together (image,
 * title, text, quiz), with a reading-progress bar and other news at the end.
 * On phones it opens full-screen; on larger screens as a centred sheet.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Calendar, Clock, Share2, CheckCircle2, Activity, Coins, ChevronRight } from 'lucide-react';
import { REWARD_LIMITS } from '../lib/shop';

const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const UZ_CYRL_MONTHS = ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];

export function longDate(value: any, language: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  if (language === 'uz') return `${d.getDate()}-${UZ_MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
  if (language === 'uz-cyrl') return `${d.getDate()}-${UZ_CYRL_MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
  return d.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

type Props = {
  item: any;
  allNews: any[];
  language: string;
  t: any;
  categoryLabel: (cat?: string) => string;
  quiz: any[];
  quizAnswers: { [k: number]: number };
  setQuizAnswers: (v: { [k: number]: number }) => void;
  quizSubmitted: boolean;
  quizResult: { correct: number, total: number, reward: number } | null;
  onSubmitQuiz: () => void | Promise<void>;
  onOpen: (item: any) => void;
  onClose: () => void;
};

export default function NewsReader({
  item, allNews, language, t, categoryLabel, quiz, quizAnswers, setQuizAnswers,
  quizSubmitted, quizResult, onSubmitQuiz, onOpen, onClose,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [shared, setShared] = useState(false);

  const L = (obj: any) => (obj && (obj[language] || obj.uz)) || '';
  const title = L(item.title);
  const content = L(item.content);
  const paragraphs = useMemo(() => content.split(/\n\s*\n/).map((p: string) => p.trim()).filter(Boolean), [content]);
  const minutes = Math.max(1, Math.round(content.split(/\s+/).filter(Boolean).length / 180));
  const others = useMemo(() => allNews.filter(n => n.id !== item.id).slice(0, 3), [allNews, item.id]);
  const answered = Object.keys(quizAnswers).length;

  // Start at the top whenever another article is opened.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setProgress(0);
  }, [item.id]);

  // Close with Escape; stop the page behind from scrolling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 1);
  };

  const share = async () => {
    const text = `${title}\n\n${content.slice(0, 200)}${content.length > 200 ? '…' : ''}\n\n${location.origin}`;
    try {
      if (navigator.share) { await navigator.share({ title, text }); return; }
      await navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch { /* cancelled */ }
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try { await onSubmitQuiz(); } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch md:items-center justify-center md:p-6">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.article
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="relative w-full md:max-w-3xl h-full md:h-auto md:max-h-[92vh] bg-white dark:bg-[#12151C] md:rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Top bar */}
        <div className="relative shrink-0 flex items-center gap-2 px-3 md:px-5 h-14 md:h-16 border-b border-black/5 dark:border-white/10 bg-white/95 dark:bg-[#12151C]/95 backdrop-blur z-10">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 h-10 pl-2 pr-3 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-100 font-bold text-sm transition-colors"
            aria-label={t('back')}
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t('backShort')}</span>
          </button>
          <span className="flex-1" />
          <button
            onClick={share}
            className="flex items-center gap-1.5 h-10 px-3 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-200 font-bold text-sm transition-colors"
          >
            <Share2 className="w-4.5 h-4.5" />
            <span>{shared ? t('linkCopied') : t('share')}</span>
          </button>
          <div className="absolute left-0 bottom-0 h-[3px] bg-gradient-to-r from-blue-600 to-cyan-400 transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
        </div>

        <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain" data-lenis-prevent>
          <div className="px-5 md:px-10 pt-5 md:pt-8 pb-10">
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-[13px] font-semibold text-zinc-500 dark:text-zinc-400">
              <span className="px-3 py-1 rounded-full bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-300 text-[11px] font-black uppercase tracking-widest">
                {categoryLabel(item.category)}
              </span>
              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{longDate(item.createdAt, language)}</span>
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{t('readingTime').replace('{n}', String(minutes))}</span>
            </div>

            <h1 className="text-[26px] leading-[1.2] md:text-[38px] md:leading-[1.15] font-black tracking-tight text-zinc-900 dark:text-white mb-6 break-words">
              {title}
            </h1>

            {item.imageUrl ? (
              <img src={item.imageUrl} alt="" className="w-full aspect-[16/9] object-cover rounded-[20px] md:rounded-[24px] mb-8 bg-zinc-100 dark:bg-white/5" />
            ) : (
              <div className="w-full aspect-[16/9] rounded-[20px] md:rounded-[24px] mb-8 bg-gradient-to-br from-blue-500/10 to-cyan-500/15 flex items-center justify-center">
                <Activity className="w-14 h-14 text-cyan-500/50" />
              </div>
            )}

            <div className="space-y-5 text-[17px] md:text-[18px] leading-[1.75] text-zinc-800 dark:text-zinc-200 break-words">
              {paragraphs.map((p: string, i: number) => (
                <p key={i} className="whitespace-pre-line">{p}</p>
              ))}
            </div>

            {/* Quiz */}
            {quiz.length > 0 && (
              <section className="mt-12 rounded-[28px] border border-blue-500/15 bg-gradient-to-b from-blue-50 to-white dark:from-blue-500/10 dark:to-transparent p-5 md:p-8">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
                  <div>
                    <h2 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white">{t('articleQuiz')}</h2>
                    {!quizSubmitted && <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mt-1">{t('quizAnswered').replace('{a}', String(answered)).replace('{n}', String(quiz.length))}</p>}
                  </div>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 text-xs font-black">
                    <Coins className="w-4 h-4" />{t('quizRewardHint').replace('{n}', String(REWARD_LIMITS.newsQuizPerCorrect))}
                  </span>
                </div>

                {quizSubmitted ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-green-500/15 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                      <CheckCircle2 className="w-9 h-9" />
                    </div>
                    <h3 className="text-lg font-black text-green-700 dark:text-green-400 mb-2">{t('quizAlreadyDone')}</h3>
                    {quizResult && (
                      <p className="text-zinc-600 dark:text-zinc-300 font-semibold">
                        {t('quizResultLine').replace('{total}', String(quizResult.total)).replace('{correct}', String(quizResult.correct))}
                        {quizResult.reward > 0 && <><br /><span className="text-amber-600 dark:text-amber-400 font-black">{t('quizCoinsGiven').replace('{amount}', String(quizResult.reward))}</span></>}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {quiz.map((q: any, i: number) => (
                      <fieldset key={i} className="space-y-3">
                        <legend className="text-[16px] md:text-[17px] font-bold text-zinc-900 dark:text-white mb-3 leading-snug">
                          <span className="text-blue-600 dark:text-blue-400 mr-1">{i + 1}.</span> {L(q.question)}
                        </legend>
                        {q.options.map((opt: any, oi: number) => {
                          const text = L(opt);
                          if (!text) return null;
                          const sel = quizAnswers[i] === oi;
                          return (
                            <button
                              key={oi}
                              type="button"
                              onClick={() => setQuizAnswers({ ...quizAnswers, [i]: oi })}
                              aria-pressed={sel}
                              className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all ${sel
                                ? 'border-blue-500 bg-blue-500/10 text-blue-900 dark:text-blue-100'
                                : 'border-black/5 dark:border-white/10 bg-white dark:bg-white/5 text-zinc-800 dark:text-zinc-200 hover:border-blue-300 dark:hover:border-blue-500/40'}`}
                            >
                              <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-black ${sel ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-white/10 text-zinc-500 dark:text-zinc-300'}`}>
                                {LETTERS[oi] || oi + 1}
                              </span>
                              <span className="font-semibold text-[15px]">{text}</span>
                            </button>
                          );
                        })}
                      </fieldset>
                    ))}
                    <button
                      onClick={submit}
                      disabled={answered < quiz.length || submitting}
                      className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-base shadow-lg shadow-blue-600/25 transition-all disabled:bg-zinc-300 disabled:text-zinc-600 dark:disabled:bg-white/10 dark:disabled:text-zinc-400 disabled:shadow-none"
                    >
                      {answered < quiz.length ? t('quizAnswerAll') : t('finishQuiz')}
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* More news */}
            {others.length > 0 && (
              <section className="mt-12">
                <h2 className="text-lg font-black text-zinc-900 dark:text-white mb-4">{t('moreNews')}</h2>
                <div className="space-y-3">
                  {others.map(n => (
                    <button
                      key={n.id}
                      onClick={() => onOpen(n)}
                      className="w-full flex items-center gap-4 p-3 rounded-2xl bg-zinc-50 dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 text-left transition-colors"
                    >
                      {n.imageUrl
                        ? <img src={n.imageUrl} alt="" className="w-20 h-16 md:w-24 md:h-18 rounded-xl object-cover shrink-0" />
                        : <span className="w-20 h-16 rounded-xl shrink-0 bg-cyan-500/10 flex items-center justify-center"><Activity className="w-6 h-6 text-cyan-500/60" /></span>}
                      <span className="flex-1 min-w-0">
                        <span className="block text-[11px] font-black uppercase tracking-widest text-cyan-700 dark:text-cyan-400 mb-1">{categoryLabel(n.category)}</span>
                        <span className="block font-bold text-zinc-900 dark:text-white leading-snug line-clamp-2">{L(n.title)}</span>
                      </span>
                      <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </motion.article>
    </div>
  );
}
