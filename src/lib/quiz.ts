// A quiz question is usable only if it has text and at least two filled-in
// options with a valid correct answer. The admin form used to save a blank
// first question by default, which crashed the quiz screen.
export function validQuiz(item: any): any[] {
  const quiz = Array.isArray(item?.quiz) ? item.quiz : [];
  return quiz.filter((q: any) => {
    const qText = q?.question && (q.question.uz || q.question.ru || q.question.en || q.question['uz-cyrl']);
    const opts = Array.isArray(q?.options) ? q.options : [];
    const filled = opts.filter((o: any) => o && (o.uz || o.ru || o.en || o['uz-cyrl'])).length;
    const ci = q?.correctOptionIndex;
    const correctFilled = typeof ci === 'number' && opts[ci] && (opts[ci].uz || opts[ci].ru || opts[ci].en || opts[ci]['uz-cyrl']);
    return qText && filled >= 2 && correctFilled;
  });
}

