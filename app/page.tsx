'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import SearchPanel from '@/components/SearchPanel';
import ResultsSidebar from '@/components/ResultsSidebar';
import CountyDetail from '@/components/CountyDetail';
import { COUNTIES } from '@/lib/data/counties';
import { DEFAULT_PROFILE, scoreCounties } from '@/lib/scoringEngine';
import type { ScoredCounty, UserProfile } from '@/lib/data/types';

// MapLibre depends on `window`; load only on the client.
const MapView = dynamic(() => import('@/components/Map'), { ssr: false });

export default function HomePage() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [selected, setSelected] = useState<ScoredCounty | null>(null);
  const [focusFips, setFocusFips] = useState<string | null>(null);

  const scored = useMemo(() => scoreCounties(COUNTIES, profile), [profile]);

  const handleSubmit = (next: UserProfile) => {
    setProfile(next);
    setResultsOpen(true);
  };

  const handleSelectFromList = (c: ScoredCounty) => {
    setSelected(c);
    setFocusFips(c.fips);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-bg">
      <MapView
        scoredCounties={scored}
        onCountyClick={(c) => setSelected(c)}
        focusFips={focusFips}
      />

      <SearchPanel profile={profile} onSubmit={handleSubmit} />

      <ResultsSidebar
        open={resultsOpen}
        onClose={() => setResultsOpen(false)}
        profile={profile}
        counties={scored}
        onCountySelect={handleSelectFromList}
      />

      <CountyDetail county={selected} onClose={() => setSelected(null)} />

      {/* Bottom-left nav */}
      <nav className="fixed bottom-4 left-4 z-10 flex gap-2 text-xs">
        <a
          href="/about/"
          className="px-3 py-1.5 rounded-md border border-white/10 bg-white/[0.04] backdrop-blur-md text-muted hover:text-text transition-colors"
        >
          About
        </a>
        <a
          href="/methodology/"
          className="px-3 py-1.5 rounded-md border border-white/10 bg-white/[0.04] backdrop-blur-md text-muted hover:text-text transition-colors"
        >
          Methodology
        </a>
      </nav>
    </main>
  );
}
