'use client';

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ScoredCounty, UserProfile } from '@/lib/data/types';
import { formatCurrency, formatPercent } from '@/lib/format';

interface ResultsSidebarProps {
  open: boolean;
  onClose: () => void;
  profile: UserProfile;
  counties: ScoredCounty[];
  onCountySelect: (county: ScoredCounty) => void;
}

const FIT_BADGE_STYLE: Record<string, string> = {
  'Strong Match': 'bg-primary/15 text-primary border-primary/30',
  'Good Fit': 'bg-warning/15 text-warning border-warning/30',
  'Consider': 'bg-muted/15 text-muted border-muted/30',
  'Poor Fit': 'bg-danger/10 text-danger/80 border-danger/20',
};

const CountyCard = memo(function CountyCard({
  county,
  rank,
  onClick,
}: {
  county: ScoredCounty;
  rank: number;
  onClick: () => void;
}) {
  const b = county.weightedBreakdown;
  const segments = [
    { color: '#00d4ff', pct: county.incomeGrowthScore * b.income },
    { color: '#7c3aed', pct: county.mobilityScore * b.mobility },
    { color: '#fbbf24', pct: county.housingScore * b.housing },
    { color: '#22c55e', pct: county.employmentScore * b.employment },
    { color: '#f97316', pct: county.costOfLivingScore * b.col },
  ];
  const segTotal = segments.reduce((s, x) => s + x.pct, 0) || 1;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:shadow-glow transition-all p-4"
    >
      <div className="flex items-start gap-3">
        <div className="text-primary font-bold text-2xl leading-none w-8 shrink-0">
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-bold text-text leading-tight">
                {county.name}, {county.state}
              </div>
              <span
                className={`inline-block mt-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  FIT_BADGE_STYLE[county.fitLabel] ?? FIT_BADGE_STYLE.Consider
                }`}
              >
                {county.fitLabel}
              </span>
            </div>
            <div className="text-right">
              <div className="text-primary text-2xl font-bold leading-none">
                {county.matchScore}
              </div>
              <div className="text-muted text-[10px] mt-0.5">score</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3 text-xs">
            <Stat label="Med. Income" value={formatCurrency(county.medianIncome, { compact: true })} />
            <Stat label="Home Price" value={formatCurrency(county.medianHomePrice, { compact: true })} />
            <Stat label="Job Growth" value={`${county.employmentScore}/100`} />
            <Stat label="10yr Proj." value={county.tenYearProjection} />
          </div>

          <div className="flex h-1.5 mt-3 rounded-full overflow-hidden bg-white/5">
            {segments.map((s, i) => (
              <div
                key={i}
                style={{ width: `${(s.pct / segTotal) * 100}%`, backgroundColor: s.color }}
              />
            ))}
          </div>
        </div>
      </div>
    </button>
  );
});

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="text-text font-medium">{value}</span>
    </div>
  );
}

export default function ResultsSidebar({
  open,
  onClose,
  profile,
  counties,
  onCountySelect,
}: ResultsSidebarProps) {
  const top = counties.slice(0, 10);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="fixed top-24 right-4 bottom-4 w-[380px] z-20 rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-md shadow-glow flex flex-col"
        >
          <div className="flex items-start justify-between p-5 border-b border-white/10">
            <div>
              <h2 className="text-text font-bold text-lg">Top Places for You</h2>
              <p className="text-muted text-xs mt-1">
                {profile.career} · age {profile.age} · {profile.salaryGoal} ·{' '}
                {profile.riskTolerance} risk
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-muted hover:text-text text-xl leading-none -mt-1"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 scroll-smooth">
            {top.map((c, i) => (
              <CountyCard
                key={c.fips}
                county={c}
                rank={i + 1}
                onClick={() => onCountySelect(c)}
              />
            ))}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
