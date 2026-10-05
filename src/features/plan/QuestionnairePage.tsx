import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, Apple, Bone, ChevronLeft, ChevronRight, Dumbbell, Flame, Home, Leaf, Milk, Mountain, ShieldCheck,
  Sparkles, Trophy, Wallet, Weight, Zap, createLucideIcon
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useDirection } from '@/hooks/useDirection';
import { useSettings } from '@/store/settings';
import { db } from '@/lib/db';
import type { Injury } from '@/types/profile';
import { OptionCard } from './components/OptionCard';
import { NumberField } from './components/NumberField';
import { profileSchema, STEP_SCHEMAS, type ProfileForm } from './lib/schema';
import { saveProfileAndGenerate, weekOrder } from './lib/usePlan';

const DEFAULTS: ProfileForm = {
  gender: 'male', age: 25, heightCm: 172, weightKg: 75, goal: 'fitness', level: 'beginner', sessionMinutes: 60,
  trainingDays: [0, 2, 4], equipment: 'gym', injuries: [], diet: 'normal'
};
const TOTAL = 5;

const Mars = createLucideIcon('Mars', [
  ['path', { d: 'M16 3h5v5' }],
  ['path', { d: 'm21 3-6.75 6.75' }],
  ['circle', { cx: '10', cy: '14', r: '6' }]
]);
const Venus = createLucideIcon('Venus', [
  ['path', { d: 'M12 15v7' }],
  ['path', { d: 'M9 19h6' }],
  ['circle', { cx: '12', cy: '9', r: '6' }]
]);

export function QuestionnairePage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const dir = useDirection();
  const lang = useSettings((s) => s.lang);
  const setOnboarded = useSettings((s) => s.setOnboarded);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ProfileForm>(DEFAULTS);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // تعديل الملف: نعبّي القيم الحالية
  useEffect(() => {
    void db.profile.get('me').then((p) => {
      const parsed = p ? profileSchema.safeParse(p) : null; // zod يشيل الحقول الزايدة (id, updatedAt)
      if (parsed?.success) setForm(parsed.data);
    });
  }, []);

  const set = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) => {
    setError(null);
    setForm((f) => ({ ...f, [k]: v }));
  };

  const next = async () => {
    const res = STEP_SCHEMAS[step].safeParse(form);
    if (!res.success) {
      setError(step === 3 ? t('q.errDays') : t('q.errInvalid'));
      return;
    }
    if (step < TOTAL - 1) return setStep(step + 1);
    setSaving(true);
    await saveProfileAndGenerate(form);
    setOnboarded(true);
    nav('/plan-ready', { replace: true });
  };

  const Back = lang === 'ar' ? ChevronRight : ChevronLeft;
  const toggleDay = (d: number) =>
    set('trainingDays', form.trainingDays.includes(d) ? form.trainingDays.filter((x) => x !== d) : [...form.trainingDays, d]);
  const toggleInjury = (i: Injury) =>
    set('injuries', form.injuries.includes(i) ? form.injuries.filter((x) => x !== i) : [...form.injuries, i]);

  const steps = [
    // 1) البيانات الأساسية
    <div key="b" className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {(['male', 'female'] as const).map((g) => (
          <OptionCard key={g} compact selected={form.gender === g} onClick={() => set('gender', g)} title={t(`q.${g}`)} icon={g === 'male' ? Mars : Venus} color={g === 'male' ? '#7DB4D6' : '#E59AB8'} />
        ))}
      </div>
      <NumberField label={t('q.age')} unit={t('q.years')} value={form.age} min={14} max={80} onChange={(v) => set('age', v)} />
      <NumberField label={t('q.height')} unit="cm" value={form.heightCm} min={130} max={230} onChange={(v) => set('heightCm', v)} />
      <NumberField label={t('q.weight')} unit="kg" value={form.weightKg} min={35} max={250} step={0.5} onChange={(v) => set('weightKg', v)} />
    </div>,
    // 2) الهدف
    <div key="g" className="flex flex-col gap-3">
      {([
        ['cut', Flame, '#E0823F'], ['bulk', Dumbbell, '#D4AF6A'], ['fitness', Activity, '#7DB4D6'], ['strength', Trophy, '#A9B98A']
      ] as const).map(([g, Icon, c]) => (
        <OptionCard key={g} selected={form.goal === g} onClick={() => set('goal', g)} title={t(`goals.${g}`)} description={t(`goals.${g}D`)} icon={Icon} color={c} />
      ))}
    </div>,
    // 3) الخبرة والمدة
    <div key="l" className="flex flex-col gap-3">
      {([['beginner', Sparkles], ['novice', Zap], ['intermediate', Mountain]] as const).map(([l, Icon]) => (
        <OptionCard key={l} selected={form.level === l} onClick={() => set('level', l)} title={t(`levels.${l}`)} description={t(`levels.${l}D`)} icon={Icon} />
      ))}
      <p className="mt-3 font-bold">{t('q.session')}</p>
      <div className="grid grid-cols-4 gap-2">
        {([45, 60, 75, 90] as const).map((m) => (
          <button key={m} type="button" onClick={() => set('sessionMinutes', m)}
            className={cn('h-14 rounded-2xl border-2 font-extrabold transition', form.sessionMinutes === m ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-surface')}>
            {m}<span className="text-xs font-bold"> {t('q.min')}</span>
          </button>
        ))}
      </div>
    </div>,
    // 4) الأيام والمعدات
    <div key="d" className="flex flex-col gap-3">
      <p className="font-bold">{t('q.whichDays')} <span className="text-primary">({form.trainingDays.length})</span></p>
      <div className="grid grid-cols-7 gap-1.5">
        {weekOrder(lang).map((d) => {
          const on = form.trainingDays.includes(d);
          return (
            <motion.button key={d} type="button" whileTap={{ scale: 0.9 }} onClick={() => toggleDay(d)} aria-pressed={on}
              className={cn('flex h-16 flex-col items-center justify-center rounded-2xl border-2 text-xs font-bold transition', on ? 'border-primary bg-grad-primary text-ink shadow-glow' : 'border-border bg-surface text-muted')}>
              {t(`weekdaysShort.${d}`)}
            </motion.button>
          );
        })}
      </div>
      <p className="text-xs text-muted">{t('q.daysHint')}</p>
      <p className="mt-3 font-bold">{t('q.equipment')}</p>
      {([['gym', Dumbbell, '#D4AF6A'], ['dumbbells', Weight, '#E0823F'], ['home', Home, '#7DB4D6']] as const).map(([e, Icon, c]) => (
        <OptionCard key={e} compact selected={form.equipment === e} onClick={() => set('equipment', e)} title={t(`access.${e}`)} description={t(`access.${e}D`)} icon={Icon} color={c} />
      ))}
    </div>,
    // 5) الصحة والأكل
    <div key="h" className="flex flex-col gap-3">
      <p className="font-bold">{t('q.injuries')}</p>
      <OptionCard compact selected={form.injuries.length === 0} onClick={() => set('injuries', [])} title={t('injuries.none')} icon={ShieldCheck} />
      {(['knee', 'back', 'shoulder'] as const).map((i) => (
        <OptionCard key={i} compact selected={form.injuries.includes(i)} onClick={() => toggleInjury(i)} title={t(`injuries.${i}`)} icon={Bone} color="#E5484D" />
      ))}
      <p className="mt-3 font-bold">{t('q.diet')}</p>
      <div className="grid grid-cols-2 gap-2">
        {([['normal', Apple], ['vegetarian', Leaf], ['lowBudget', Wallet], ['lactoseFree', Milk]] as const).map(([d, Icon]) => (
          <OptionCard key={d} compact selected={form.diet === d} onClick={() => set('diet', d)} title={t(`diets.${d}`)} icon={Icon} />
        ))}
      </div>
      {form.injuries.length > 0 && <p className="rounded-2xl bg-danger/10 p-3 text-sm text-danger">{t('q.injuryWarn')}</p>}
    </div>
  ];

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-6 pt-4">
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={() => (step ? setStep(step - 1) : nav(-1))} className="grid h-10 w-10 place-items-center rounded-xl bg-elevated" aria-label="back">
          <Back size={20} />
        </button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-elevated">
          <motion.div className="h-full rounded-full bg-grad-energy" animate={{ width: `${((step + 1) / TOTAL) * 100}%` }} />
        </div>
        <span className="text-sm font-bold text-muted">{step + 1}/{TOTAL}</span>
      </div>

      <h1 className="text-2xl font-extrabold">{t(`q.t${step}`)}</h1>
      <p className="mb-5 text-sm text-muted">{t(`q.d${step}`)}</p>

      <div className="relative flex-1">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 40 * dir }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 * dir }} transition={{ duration: 0.25 }}>
            {steps[step]}
          </motion.div>
        </AnimatePresence>
      </div>

      {error && <p className="mt-3 text-center text-sm font-bold text-danger">{error}</p>}
      <Button size="lg" fullWidth className="mt-4" loading={saving} onClick={next}>
        {step === TOTAL - 1 ? t('q.build') : t('onboarding.next')}
      </Button>
    </div>
  );
}
