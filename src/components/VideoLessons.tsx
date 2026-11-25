/**
 * Video lessons. The list shows lightweight thumbnails (the YouTube player is
 * only loaded when a lesson is opened), and each lesson opens in its own view
 * with the player, description and a step-by-step quiz.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Play, CheckCircle2, XCircle, Video, Coins, ListChecks, RotateCcw, ChevronRight, Trophy } from 'lucide-react';
import { api, poll } from '../lib/api';
import { extractYoutubeId } from '../lib/utils';
import { validQuiz } from '../lib/quiz';
import { REWARD_LIMITS } from '../lib/shop';
import { useLanguage } from '../contexts/LanguageContext';

type Props = {
  t: any;
  completedVideoIds: string[];
  onSubmitQuiz: (videoId: string, answers: number[]) => Promise<{ passed: boolean, reward: number }>;
};

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const ytId = (l: any) => l?.videoId || extractYoutubeId(l?.videoUrl) || extractYoutubeId(l?.iframeCode);

// YouTube thumbnail with a tidy fallback when the video has no picture
// (e.g. it was deleted or made private on YouTube).
function Thumb({ id, size = 'hq', className = '' }: { id: string | null, size?: 'hq' | 'mq', className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [id]);
  if (!id || failed) {
    return (
      <div className={`w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center ${className}`}>
        <Video className="w-1/4 h-1/4 max-w-12 text-white/30" />
      </div>
    );
  }
  return (
    <img
      src={`https://i.ytimg.com/vi/${id}/${size}default.jpg`}
      alt=""
      loading="lazy"
      className={`w-full h-full object-cover ${className}`}
      // YouTube serves a 120×90 grey placeholder for missing videos
      onLoad={e => { if ((e.target as HTMLImageElement).naturalWidth <= 120) setFailed(true); }}
      onError={() => setFailed(true)}
    />
  );
}

export default function VideoLessons({ t, completedVideoIds, onSubmitQuiz }: Props) {
  const { language } = useLanguage();
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const L = (o: any) => (!o ? '' : typeof o === 'string' ? o : o[language] || o.uz || '');

  useEffect(() => {
    const load = () => api<any[]>('/api/videos')
      .then(v => setLessons(Array.isArray(v) ? v : []))
      .catch(e => console.error('Videos load error:', e))
      .finally(() => setLoading(false));
    load();
    return poll(load, 60_000);
  }, []);

  const isDone = (l: any) => completedVideoIds.includes(l.id);
  const doneCount = lessons.filter(isDone).length;
  const next = lessons.find(l => !isDone(l) && validQuiz(l).length > 0) || null;
  const open = lessons.find(l => l.id === openId) || null;
  const desc = (l: any) => { const d = L(l.description); return d && d !== L(l.title) ? d : ''; };

  return (
    <div className="flex-1 flex flex-col space-y-5">
      {/* Course header */}
      <section className="glass-panel rounded-3xl p-5 md:p-7">
        <div className="flex flex-col lg:flex-row lg:items-end gap-5 lg:gap-8">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-400">{t('healthSchool')}</p>
            <h3 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mt-1">{t('videoLessons')}</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm md:text-[15px] mt-1.5 max-w-xl">{t('videosDesc')}</p>
          </div>
          {lessons.length > 0 && (
            <dl className="grid grid-cols-3 gap-2 lg:w-[380px] shrink-0">
              {[
                [t('statLessons'), String(lessons.length)],
                [t('statDone'), `${doneCount}/${lessons.length}`],
                [t('statEarned'), `${doneCount * REWARD_LIMITS.videoQuiz}`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] px-3 py-2.5">
                  <dt className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 truncate">{k}</dt>
                  <dd className="text-lg font-black text-zinc-900 dark:text-white tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {lessons.length > 0 && (
          <div className="mt-5 h-1.5 rounded-full bg-zinc-200 dark:bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${(doneCount / lessons.length) * 100}%` }} />
          </div>
        )}
      </section>

      {loading ? (
        <div className="glass-panel rounded-3xl p-5 space-y-4 animate-pulse">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex gap-4"><div className="w-32 aspect-video rounded-xl bg-zinc-200 dark:bg-white/5" /><div className="flex-1 space-y-2 py-2"><div className="h-4 w-2/3 rounded bg-zinc-200 dark:bg-white/10" /><div className="h-3 w-1/3 rounded bg-zinc-200 dark:bg-white/10" /></div></div>
          ))}
        </div>
      ) : lessons.length === 0 ? (
        <div className="glass-panel rounded-3xl flex flex-col items-center justify-center py-20 gap-3 text-zinc-400 dark:text-zinc-500">
          <Video className="w-10 h-10 opacity-40" />
          <p className="font-bold">{t('noVideosYet')}</p>
        </div>
      ) : (
        <>
          {/* Up next */}
          {next && (
            <button onClick={() => setOpenId(next.id)} className="glass-panel rounded-3xl overflow-hidden text-left group grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] hover:shadow-xl transition-shadow">
              <div className="relative aspect-video bg-zinc-900 overflow-hidden">
                <Thumb id={ytId(next)} className="group-hover:scale-[1.03] transition-transform duration-500" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-lg"><Play className="w-6 h-6 text-zinc-900 fill-current ml-0.5" /></span>
                </span>
              </div>
              <div className="p-5 md:p-7 flex flex-col justify-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{t('upNext')} · {t('lessonN').replace('{n}', String(lessons.indexOf(next) + 1))}</p>
                <h4 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white leading-snug mt-2 break-words">{L(next.title)}</h4>
                {desc(next) && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 line-clamp-2">{desc(next)}</p>}
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400 font-medium mt-3">
                  {t('quizQuestions').replace('{n}', String(validQuiz(next).length))} · <span className="text-zinc-800 dark:text-zinc-200 font-bold">+{REWARD_LIMITS.videoQuiz} H-Coin</span>
                </p>
                <span className="mt-5 self-start inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-sm">
                  <Play className="w-4 h-4 fill-current" />{t('startLesson')}
                </span>
              </div>
            </button>
          )}

          {/* All lessons */}
          <section className="glass-panel rounded-3xl p-2 md:p-3">
            <h4 className="px-3 pt-3 pb-2 text-sm font-bold text-zinc-500 dark:text-zinc-400">{t('allLessons')}</h4>
            <ol>
              {lessons.map((lesson, idx) => {
                const done = isDone(lesson);
                const qn = validQuiz(lesson).length;
                return (
                  <li key={lesson.id}>
                    <button onClick={() => setOpenId(lesson.id)} className="w-full flex items-center gap-3 md:gap-4 p-2.5 md:p-3 rounded-2xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-left transition-colors">
                      <span className="hidden sm:flex w-7 shrink-0 justify-center text-sm font-bold text-zinc-400 tabular-nums">{String(idx + 1).padStart(2, '0')}</span>
                      <span className="relative w-28 md:w-40 aspect-video shrink-0 rounded-xl overflow-hidden bg-zinc-900">
                        <Thumb id={ytId(lesson)} size="mq" />
                        {done && <span className="absolute inset-0 bg-black/45 flex items-center justify-center"><CheckCircle2 className="w-7 h-7 text-white" /></span>}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-bold text-[15px] md:text-base text-zinc-900 dark:text-white leading-snug line-clamp-2 break-words">{L(lesson.title)}</span>
                        {desc(lesson) && <span className="hidden md:block text-sm text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">{desc(lesson)}</span>}
                        <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1">
                          {qn > 0 ? t('quizQuestions').replace('{n}', String(qn)) : t('noQuizForVideo')}
                        </span>
                      </span>
                      <span className="shrink-0 flex items-center gap-1">
                        {done
                          ? <span className="text-xs font-bold text-green-700 dark:text-green-400">{t('completed')}</span>
                          : qn > 0 ? <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">+{REWARD_LIMITS.videoQuiz}</span> : null}
                        <ChevronRight className="w-4 h-4 text-zinc-400" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      )}

      <AnimatePresence>
        {open && (
          <LessonView
            lesson={open}
            index={lessons.indexOf(open)}
            lessons={lessons}
            completedVideoIds={completedVideoIds}
            t={t}
            L={L}
            onSubmitQuiz={onSubmitQuiz}
            onOpen={setOpenId}
            onClose={() => setOpenId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

type QuizPhase = { step: 'intro' } | { step: 'question', i: number, answers: number[], picked: number | null } | { step: 'sending' } | { step: 'result', passed: boolean, reward: number, correct: number, total: number } | { step: 'error' };

function LessonView({ lesson, index, lessons, completedVideoIds, t, L, onSubmitQuiz, onOpen, onClose }: {
  lesson: any, index: number, lessons: any[], completedVideoIds: string[], t: any, L: (o: any) => string,
  onSubmitQuiz: Props['onSubmitQuiz'], onOpen: (id: string) => void, onClose: () => void,
}) {
  const id = ytId(lesson);
  const quiz = useMemo(() => validQuiz(lesson), [lesson]);
  const done = completedVideoIds.includes(lesson.id);
  const [phase, setPhase] = useState<QuizPhase>({ step: 'intro' });
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const quizRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => { setPhase({ step: 'intro' }); scrollRef.current?.scrollTo({ top: 0 }); }, [lesson.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const start = () => {
    setPhase({ step: 'question', i: 0, answers: [], picked: null });
    setTimeout(() => quizRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const pick = (oi: number) => {
    if (phase.step !== 'question' || phase.picked !== null) return;
    setPhase({ ...phase, picked: oi });
  };

  const next = async () => {
    if (phase.step !== 'question' || phase.picked === null) return;
    const answers = [...phase.answers, phase.picked];
    if (phase.i + 1 < quiz.length) { setPhase({ step: 'question', i: phase.i + 1, answers, picked: null }); return; }
    setPhase({ step: 'sending' });
    try {
      const r = await onSubmitQuiz(lesson.id, answers);
      const correct = quiz.filter((q: any, i: number) => answers[i] === q.correctOptionIndex).length;
      setPhase({ step: 'result', passed: r.passed, reward: r.reward, correct, total: quiz.length });
    } catch {
      setPhase({ step: 'error' });
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch md:items-center justify-center md:p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="relative w-full md:max-w-6xl h-full md:h-auto md:max-h-[94vh] bg-white dark:bg-[#12151C] md:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        role="dialog" aria-modal="true" aria-label={L(lesson.title)}
      >
        <div className="shrink-0 flex items-center gap-2 px-3 md:px-5 h-14 border-b border-black/5 dark:border-white/10">
          <button onClick={onClose} className="flex items-center gap-1.5 h-10 pl-2 pr-3 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-100 font-bold text-sm" aria-label={t('back')}>
            <ArrowLeft className="w-5 h-5" /><span>{t('backShort')}</span>
          </button>
          <span className="flex-1 text-center text-xs font-bold text-zinc-500 dark:text-zinc-400">{t('lessonN').replace('{n}', String(index + 1))} / {lessons.length}</span>
          <span className="w-[88px]" />
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start" data-lenis-prevent>
          <div className="min-w-0">
          <div className="bg-black aspect-video w-full">
            {id ? (
              <iframe
                key={id}
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`}
                title={L(lesson.title)}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Video className="w-12 h-12 text-zinc-600" /></div>
            )}
          </div>

          <div className="px-5 md:px-8 py-6 md:py-8">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-[22px] md:text-[28px] leading-tight font-black tracking-tight text-zinc-900 dark:text-white break-words">{L(lesson.title)}</h1>
              {done && <span className="shrink-0 mt-1 px-3 py-1 rounded-full bg-green-500/15 text-green-700 dark:text-green-400 text-xs font-black flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />{t('completed')}</span>}
            </div>
            {L(lesson.description) && L(lesson.description) !== L(lesson.title) && (
              <p className="mt-3 text-[16px] leading-relaxed text-zinc-600 dark:text-zinc-300 whitespace-pre-line break-words">{L(lesson.description)}</p>
            )}
            {id && <p className="mt-3 text-xs font-semibold text-zinc-400">{t('videoNotPlaying')} <a className="text-blue-600 dark:text-blue-400 underline" href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer">YouTube</a></p>}

            {/* Quiz */}
            <div ref={quizRef} className="scroll-mt-4">
            {quiz.length > 0 && (
              <section className="mt-8 rounded-2xl border border-black/10 dark:border-white/10 bg-zinc-50/70 dark:bg-white/[0.03] p-5 md:p-7">
                {phase.step === 'intro' && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <h2 className="text-lg md:text-xl font-black text-zinc-900 dark:text-white">{t('lessonQuiz')}</h2>
                      <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mt-1">
                        {done ? t('quizAlreadyDone') : t('lessonQuizHint').replace('{n}', String(quiz.length)).replace('{amount}', String(REWARD_LIMITS.videoQuiz))}
                      </p>
                    </div>
                    {!done && (
                      <button onClick={start} className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25">
                        <Play className="w-4 h-4 fill-current" />{t('completeQuiz')}
                      </button>
                    )}
                  </div>
                )}

                {phase.step === 'question' && (() => {
                  const q = quiz[phase.i];
                  const answered = phase.picked !== null;
                  return (
                    <div>
                      <div className="flex items-center gap-1.5 mb-4">
                        {quiz.map((_: any, k: number) => (
                          <span key={k} className={`h-1.5 flex-1 rounded-full ${k < phase.i ? 'bg-blue-600' : k === phase.i ? 'bg-blue-400' : 'bg-zinc-200 dark:bg-white/10'}`} />
                        ))}
                      </div>
                      <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">{t('questionOf').replace('{n}', String(phase.i + 1)).replace('{total}', String(quiz.length))}</p>
                      <h3 className="text-[18px] md:text-[20px] font-black text-zinc-900 dark:text-white mb-4 leading-snug">{L(q.question)}</h3>
                      <div className="space-y-2.5">
                        {q.options.map((opt: any, oi: number) => {
                          if (!L(opt)) return null;
                          const isCorrect = oi === q.correctOptionIndex;
                          const isPicked = oi === phase.picked;
                          const cls = !answered
                            ? 'border-black/5 dark:border-white/10 bg-white dark:bg-white/5 hover:border-blue-400 text-zinc-800 dark:text-zinc-100'
                            : isCorrect ? 'border-green-500 bg-green-500/10 text-green-800 dark:text-green-300'
                            : isPicked ? 'border-red-500 bg-red-500/10 text-red-800 dark:text-red-300'
                            : 'border-black/5 dark:border-white/10 bg-white dark:bg-white/5 text-zinc-400 opacity-60';
                          return (
                            <button key={oi} type="button" disabled={answered} onClick={() => pick(oi)}
                              className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all ${cls}`}>
                              <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-black ${answered && isCorrect ? 'bg-green-500 text-white' : answered && isPicked ? 'bg-red-500 text-white' : 'bg-zinc-100 dark:bg-white/10 text-zinc-500 dark:text-zinc-300'}`}>
                                {answered && isCorrect ? <CheckCircle2 className="w-5 h-5" /> : answered && isPicked ? <XCircle className="w-5 h-5" /> : LETTERS[oi]}
                              </span>
                              <span className="font-semibold text-[15px]">{L(opt)}</span>
                            </button>
                          );
                        })}
                      </div>
                      {answered && (
                        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                          <p className={`flex-1 text-sm font-black ${phase.picked === q.correctOptionIndex ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {phase.picked === q.correctOptionIndex ? t('answerCorrect') : t('answerWrong')}
                          </p>
                          <button onClick={next} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-1.5">
                            {phase.i + 1 < quiz.length ? t('nextQuestion') : t('finishQuiz')}<ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {phase.step === 'sending' && (
                  <div className="flex items-center justify-center gap-3 py-8 text-zinc-500 font-bold">
                    <span className="w-6 h-6 border-[3px] border-zinc-200 border-t-blue-600 rounded-full animate-spin" />{t('loading')}...
                  </div>
                )}

                {phase.step === 'result' && (
                  <div className="text-center py-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${phase.passed ? 'bg-green-500/15 text-green-600' : 'bg-red-500/10 text-red-500'}`}>
                      {phase.passed ? <Trophy className="w-8 h-8" /> : <RotateCcw className="w-8 h-8" />}
                    </div>
                    <h3 className={`text-xl font-black mb-1 ${phase.passed ? 'text-green-700 dark:text-green-400' : 'text-zinc-900 dark:text-white'}`}>
                      {phase.passed ? t('congratulations') : t('almostThere')}
                    </h3>
                    <p className="text-zinc-600 dark:text-zinc-300 font-semibold">{t('quizResultLine').replace('{total}', String(phase.total)).replace('{correct}', String(phase.correct))}</p>
                    {phase.passed && phase.reward > 0 && <p className="mt-2 text-amber-600 dark:text-amber-400 font-black text-lg">+{phase.reward} H-Coin</p>}
                    {!phase.passed && <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 font-medium">{t('videoQuizFailed')}</p>}
                    {!phase.passed && (
                      <button onClick={start} className="mt-5 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm inline-flex items-center gap-2">
                        <RotateCcw className="w-4 h-4" />{t('retry')}
                      </button>
                    )}
                  </div>
                )}

                {phase.step === 'error' && (
                  <div className="text-center py-6">
                    <p className="text-red-600 font-bold mb-4">{t('errorOccurred')}</p>
                    <button onClick={start} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm">{t('retry')}</button>
                  </div>
                )}
              </section>
            )}
            </div>

          </div>
          </div>

          {/* Course contents */}
          <aside className="border-t lg:border-t-0 lg:border-l border-black/5 dark:border-white/10 lg:sticky lg:top-0">
            <div className="px-5 pt-5 pb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-black text-zinc-900 dark:text-white">{t('courseContents')}</h2>
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{lessons.filter(l => completedVideoIds.includes(l.id)).length}/{lessons.length}</span>
            </div>
            <ol className="px-2 pb-4">
              {lessons.map((o, k) => {
                const cur = o.id === lesson.id;
                const odone = completedVideoIds.includes(o.id);
                return (
                  <li key={o.id}>
                    <button onClick={() => onOpen(o.id)} aria-current={cur ? 'true' : undefined}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors ${cur ? 'bg-blue-600/10' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'}`}>
                      <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${odone ? 'bg-green-600 text-white' : cur ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-white/10 text-zinc-600 dark:text-zinc-300'}`}>
                        {odone ? <CheckCircle2 className="w-4 h-4" /> : k + 1}
                      </span>
                      <span className="relative w-20 aspect-video shrink-0 rounded-lg overflow-hidden bg-zinc-900"><Thumb id={ytId(o)} size="mq" /></span>
                      <span className={`flex-1 min-w-0 text-[13px] leading-snug line-clamp-2 ${cur ? 'font-bold text-zinc-900 dark:text-white' : 'font-semibold text-zinc-700 dark:text-zinc-300'}`}>{L(o.title)}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>
        </div>
      </motion.div>
    </div>
  );
}
