'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { ScoredCounty } from '@/lib/data/types';
import { formatCurrency, formatPercent, formatPopulation } from '@/lib/format';

interface CountyDetailProps {
  county: ScoredCounty | null;
  onClose: () => void;
}

const FIT_BADGE_STYLE: Record<string, string> = {
  'Strong Match': 'bg-primary/15 text-primary border-primary/30',
  'Good Fit': 'bg-warning/15 text-warning border-warning/30',
  'Consider': 'bg-muted/15 text-muted border-muted/30',
  'Poor Fit': 'bg-danger/10 text-danger/80 border-danger/20',
};

function DimBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? '#00d4ff' : value >= 40 ? '#fbbf24' : '#ef4444';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-text">{label}</span>
        <span className="text-muted">{value}/100</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function KeyStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted">{label}</div>
      <div className="text-text font-semibold mt-0.5">{value}</div>
    </div>
  );
}

export default function CountyDetail({ county, onClose }: CountyDetailProps) {
  return (
    <AnimatePresence>
      {county && (
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed bottom-0 left-0 right-0 z-20 h-[40vh] rounded-t-2xl border-t border-white/10 bg-white/[0.05] backdrop-blur-md shadow-glow flex"
        >
          {/* Left: identity & headline score */}
          <div className="p-6 w-[280px] shrink-0 border-r border-white/10 flex flex-col justify-between">
            <div>
              <div className="text-text text-xl font-bold leading-tight">
                {county.name}, {county.state}
              </div>
              <span
                className={`inline-block mt-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  FIT_BADGE_STYLE[county.fitLabel] ?? FIT_BADGE_STYLE.Consider
                }`}
              >
                {county.fitLabel}
              </span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted">
                Opportunity Score
              </div>
              <div
                className="text-primary font-bold text-7xl leading-none mt-2"
                style={{ textShadow: '0 0 30px rgba(0,212,255,0.5)' }}
              >
                {county.matchScore}
              </div>
              <div className="text-muted text-xs mt-2">
                10-yr projection: <span className="text-text">{county.tenYearProjection}</span>
              </div>
            </div>
          </div>

          {/* Center: dimension bars */}
          <div className="flex-1 p-6 space-y-3 min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted">
              Dimension Scores
            </div>
            <DimBar label="Income Growth" value={county.incomeGrowthScore} />
            <DimBar label="Economic Mobility" value={county.mobilityScore} />
            <DimBar label="Housing Affordability" value={county.housingScore} />
            <DimBar label="Employment Growth" value={county.employmentScore} />
            <DimBar label="Cost of Living" value={county.costOfLivingScore} />
          </div>

          {/* Right: key stats + why */}
          <div className="w-[320px] shrink-0 border-l border-white/10 p-6 flex flex-col">
            <div className="text-[10px] uppercase tracking-widest text-muted mb-3">
              Key Stats
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <KeyStat
                label="Median Income"
                value={formatCurrency(county.medianIncome, { compact: true })}
              />
              <KeyStat
                label="Median Home"
                value={formatCurrency(county.medianHomePrice, { compact: true })}
              />
              <KeyStat label="Unemployment" value={formatPercent(county.unemploymentRate)} />
              <KeyStat label="Population" value={formatPopulation(county.population)} />
              <KeyStat
                label="Income/Home"
                value={(county.medianIncome / county.medianHomePrice).toFixed(2)}
              />
            </div>

            <div className="mt-4 flex-1 overflow-y-auto">
              <div className="text-[10px] uppercase tracking-widest text-muted mb-2">
                Why this place?
              </div>
              <p className="text-text text-sm leading-relaxed">{county.whyDescription}</p>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-white/10 text-muted hover:text-text hover:border-white/20 transition-colors"
              >
                + Add to Compare
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs rounded-lg border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
