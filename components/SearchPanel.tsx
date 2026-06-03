'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  CareerField,
  DegreeLevel,
  RiskTolerance,
  SalaryGoal,
  UserProfile,
  YesNo,
} from '@/lib/data/types';

interface SearchPanelProps {
  profile: UserProfile;
  onSubmit: (profile: UserProfile) => void;
}

const DEGREES: DegreeLevel[] = ['High School', 'Associate', "Bachelor's", "Master's", 'PhD'];
const CAREERS: CareerField[] = [
  'Finance & IB',
  'Technology',
  'Healthcare',
  'Law',
  'Engineering',
  'Education',
  'Other',
];
const SALARY_GOALS: SalaryGoal[] = ['Under $50k', '$50-80k', '$80-120k', '$120k+'];
const RISK: RiskTolerance[] = ['Low', 'Medium', 'High'];

function Pill<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-white/10 bg-bg p-0.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            value === o
              ? 'bg-primary text-bg font-semibold'
              : 'text-muted hover:text-text'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-[120px]">
      <label className="text-[10px] uppercase tracking-widest text-muted">{label}</label>
      {children}
    </div>
  );
}

export default function SearchPanel({ profile, onSubmit }: SearchPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [ageText, setAgeText] = useState(String(profile.age));

  const commitAge = () => {
    const parsed = parseInt(ageText, 10);
    if (Number.isFinite(parsed)) {
      const bounded = Math.max(18, Math.min(65, parsed));
      setDraft({ ...draft, age: bounded });
      setAgeText(String(bounded));
    } else {
      setAgeText(String(draft.age));
    }
  };

  return (
    <div className="fixed top-4 left-4 right-4 z-30">
      <div className="rounded-lg border border-white/10 bg-bg/95">
        {/* Header row */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-baseline gap-3">
            <div className="font-bold text-text tracking-tight text-lg">Altus Index</div>
            <div className="hidden lg:block text-muted text-xs">
              Find your path to success
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="px-4 py-2 text-sm rounded-md border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
          >
            {expanded ? 'Collapse' : 'Personalize'}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="expanded"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="overflow-hidden border-t border-white/10"
            >
              <div className="px-5 py-4">
                <div className="flex flex-wrap items-end gap-4">
                  <Field label="Age">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={ageText}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9]/g, '');
                        setAgeText(v);
                      }}
                      onBlur={commitAge}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      className="w-20 bg-bg border border-white/10 rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-primary/50"
                    />
                  </Field>
                  <Field label="Degree">
                    <select
                      value={draft.degree}
                      onChange={(e) => setDraft({ ...draft, degree: e.target.value as DegreeLevel })}
                      className="bg-bg border border-white/10 rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-primary/50"
                    >
                      {DEGREES.map((d) => (
                        <option key={d} value={d} className="bg-bg">
                          {d}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Career">
                    <select
                      value={draft.career}
                      onChange={(e) => setDraft({ ...draft, career: e.target.value as CareerField })}
                      className="bg-bg border border-white/10 rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-primary/50"
                    >
                      {CAREERS.map((c) => (
                        <option key={c} value={c} className="bg-bg">
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Salary Goal">
                    <select
                      value={draft.salaryGoal}
                      onChange={(e) =>
                        setDraft({ ...draft, salaryGoal: e.target.value as SalaryGoal })
                      }
                      className="bg-bg border border-white/10 rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-primary/50"
                    >
                      {SALARY_GOALS.map((s) => (
                        <option key={s} value={s} className="bg-bg">
                          {s}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Remote">
                    <Pill<YesNo>
                      options={['Yes', 'No']}
                      value={draft.remoteWork}
                      onChange={(v) => setDraft({ ...draft, remoteWork: v })}
                    />
                  </Field>
                  <Field label="Own Home">
                    <Pill<YesNo>
                      options={['Yes', 'No']}
                      value={draft.ownHome}
                      onChange={(v) => setDraft({ ...draft, ownHome: v })}
                    />
                  </Field>
                  <Field label="Risk">
                    <Pill<RiskTolerance>
                      options={RISK}
                      value={draft.riskTolerance}
                      onChange={(v) => setDraft({ ...draft, riskTolerance: v })}
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={() => {
                      commitAge();
                      onSubmit({ ...draft, age: draft.age });
                    }}
                    className="ml-auto px-5 py-2.5 rounded-md bg-primary text-bg font-semibold text-sm hover:bg-primary/90 transition-colors"
                  >
                    Find My Best Places →
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
