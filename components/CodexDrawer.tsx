
import React, { useState, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, BookOpen, CheckCircle2, XCircle, Gift, Lightbulb } from 'lucide-react';
import { TrialCodex, QuizQuestion } from '../hooks/useResonanceState';

interface CodexDrawerProps {
  codex: TrialCodex;
  trialId: string;
  trialTitle: string;
  onClose: () => void;
  onQuizPassed?: (trialId: string, score: number, total: number) => void;
  onSectionViewed?: (sectionId: string) => void;
  onBonusUnlock?: (trackName: string) => void;
}

const CodexDrawer: React.FC<CodexDrawerProps> = ({
  codex,
  trialId,
  trialTitle,
  onClose,
  onQuizPassed,
  onSectionViewed,
  onBonusUnlock,
}) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [passed, setPassed] = useState(false);

  // Mark section as viewed on mount
  useEffect(() => {
    onSectionViewed?.(`codex-${trialId}`);
  }, [trialId, onSectionViewed]);

  const handleSelect = useCallback((questionIdx: number, optionIdx: number) => {
    if (submitted) return;
    setSelectedAnswers(prev => ({ ...prev, [questionIdx]: optionIdx }));
  }, [submitted]);

  const handleSubmit = useCallback(() => {
    const allAnswered = codex.quiz.every((_, i) => selectedAnswers[i] !== undefined);
    if (!allAnswered) return;

    const score = codex.quiz.filter(
      (q, i) => selectedAnswers[i] === q.correctAnswerIndex
    ).length;
    const total = codex.quiz.length;
    const correct = score === total;
    setPassed(correct);
    setSubmitted(true);

    // Persist score
    onQuizPassed?.(trialId, score, total);

    if (correct && codex.bonusTrack && onBonusUnlock) {
      onBonusUnlock(codex.bonusTrack);
    }
  }, [codex, trialId, selectedAnswers, onQuizPassed, onBonusUnlock]);

  const handleRetry = useCallback(() => {
    setSelectedAnswers({});
    setSubmitted(false);
    setPassed(false);
  }, []);

  const allAnswered = codex.quiz.every((_, i) => selectedAnswers[i] !== undefined);

  return (
    <div className="fixed inset-y-0 right-0 z-[200] w-[38%] max-w-[600px] min-w-[380px] flex flex-col animate-in slide-in-from-right duration-300">
      {/* Backdrop — click to close */}
      <div
        className="fixed inset-0 bg-black/50 z-[-1]"
        onClick={onClose}
      />

      <div className="h-full flex flex-col bg-[#0a0a12] border-l border-purple-500/20 shadow-[-20px_0_80px_rgba(88,28,135,0.15)]">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 shrink-0">
              <BookOpen className="w-5 h-5 text-purple-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black uppercase tracking-wider text-white truncate">
                Guruswami Codex
              </h3>
              <p className="text-[10px] font-mono text-purple-400/60 uppercase tracking-[0.2em] truncate">
                {trialTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all shrink-0"
          >
            <X className="w-4 h-4 text-white/40" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Markdown content area */}
          <div className="px-8 py-8">
            <div className="prose-codex">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {codex.markdownContent}
              </ReactMarkdown>
            </div>
          </div>

          {/* Quiz section */}
          {codex.quiz.length > 0 && (
            <div className="px-8 pb-8">
              <div className="border-t border-white/5 pt-8">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-400/50 mb-6 flex items-center gap-2">
                  <span className="w-4 h-px bg-purple-500/30" />
                  Knowledge Check
                </h4>

                <div className="space-y-6">
                  {codex.quiz.map((q: QuizQuestion, qi: number) => (
                    <QuizQuestionCard
                      key={qi}
                      question={q}
                      questionIndex={qi}
                      selectedAnswer={selectedAnswers[qi]}
                      onSelect={handleSelect}
                      submitted={submitted}
                    />
                  ))}
                </div>

                {/* Submit / Result */}
                <div className="mt-8">
                  {!submitted ? (
                    <button
                      onClick={handleSubmit}
                      disabled={!allAnswered}
                      className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        allAnswered
                          ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                          : 'bg-white/5 text-white/20 cursor-not-allowed'
                      }`}
                    >
                      Check Answers
                    </button>
                  ) : passed ? (
                    <PassResult
                      hint={codex.hintOnPass}
                      bonusTrack={codex.bonusTrack}
                    />
                  ) : (
                    <FailResult onRetry={handleRetry} />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Quiz Question Card ──────────────────────────────────────────────

const QuizQuestionCard: React.FC<{
  question: QuizQuestion;
  questionIndex: number;
  selectedAnswer: number | undefined;
  onSelect: (qi: number, oi: number) => void;
  submitted: boolean;
}> = ({ question, questionIndex, selectedAnswer, onSelect, submitted }) => (
  <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
    <p className="text-xs text-white/80 font-bold mb-4 leading-relaxed">
      {questionIndex + 1}. {question.question}
    </p>
    <div className="space-y-2">
      {question.options.map((opt, oi) => {
        const isSelected = selectedAnswer === oi;
        const isCorrect = oi === question.correctAnswerIndex;
        let optionStyle = 'border-white/5 hover:border-white/15 hover:bg-white/[0.03]';

        if (submitted) {
          if (isCorrect) {
            optionStyle = 'border-emerald-500/30 bg-emerald-500/10';
          } else if (isSelected && !isCorrect) {
            optionStyle = 'border-red-500/30 bg-red-500/10';
          } else {
            optionStyle = 'border-white/5 opacity-40';
          }
        } else if (isSelected) {
          optionStyle = 'border-purple-500/40 bg-purple-500/10';
        }

        return (
          <button
            key={oi}
            onClick={() => onSelect(questionIndex, oi)}
            disabled={submitted}
            className={`w-full text-left px-4 py-3 rounded-xl border text-[11px] font-mono transition-all flex items-center gap-3 ${optionStyle}`}
          >
            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
              isSelected
                ? submitted
                  ? isCorrect ? 'border-emerald-400' : 'border-red-400'
                  : 'border-purple-400'
                : 'border-white/20'
            }`}>
              {submitted && isCorrect && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
              {submitted && isSelected && !isCorrect && (
                <XCircle className="w-3.5 h-3.5 text-red-400" />
              )}
              {!submitted && isSelected && (
                <div className="w-2 h-2 rounded-full bg-purple-400" />
              )}
            </span>
            <span className={`${
              submitted && isCorrect ? 'text-emerald-400' :
              submitted && isSelected && !isCorrect ? 'text-red-400/60' :
              'text-white/50'
            }`}>
              {opt}
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

// ── Pass Result ─────────────────────────────────────────────────────

const PassResult: React.FC<{
  hint: string;
  bonusTrack: string | null;
}> = ({ hint, bonusTrack }) => (
  <div className="space-y-4">
    <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
      <div className="flex items-center gap-3 mb-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        <span className="text-xs font-black uppercase tracking-widest text-emerald-400">
          Knowledge Confirmed
        </span>
      </div>
      <div className="flex items-start gap-3 mt-4">
        <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-xs text-white/60 leading-relaxed italic">
          {hint}
        </p>
      </div>
    </div>

    {bonusTrack && (
      <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center gap-3">
        <Gift className="w-5 h-5 text-purple-400" />
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">
            Bonus Track Unlocked
          </p>
          <p className="text-xs text-white/40 font-mono mt-0.5">
            {bonusTrack}
          </p>
        </div>
      </div>
    )}
  </div>
);

// ── Fail Result ─────────────────────────────────────────────────────

const FailResult: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <XCircle className="w-5 h-5 text-red-400" />
        <span className="text-xs font-black uppercase tracking-widest text-red-400">
          Not Quite
        </span>
      </div>
      <button
        onClick={onRetry}
        className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-white/50 rounded-lg transition-all"
      >
        Try Again
      </button>
    </div>
    <p className="text-xs text-white/40 mt-3 leading-relaxed">
      Re-read the documentation above and try the quiz again. The hint will be revealed when all answers are correct.
    </p>
  </div>
);

export default CodexDrawer;
