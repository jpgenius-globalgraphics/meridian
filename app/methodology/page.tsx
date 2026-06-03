import Link from 'next/link';

export const metadata = {
  title: 'Methodology — Altus Index',
};

export default function MethodologyPage() {
  return (
    <main className="min-h-screen bg-bg text-text px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-primary text-sm hover:underline">
          ← Back to map
        </Link>
        <h1 className="text-4xl font-bold mt-6 mb-4">Methodology</h1>
        <p className="text-muted mb-6 leading-relaxed">
          Every county is scored on five dimensions and then combined into a single
          opportunity score (0–100) using weights tailored to <em>you</em>.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">The five dimensions</h2>
        <ul className="text-muted space-y-2 list-disc pl-6">
          <li>
            <span className="text-text font-medium">Income Growth</span> — how fast local
            wages have been climbing relative to inflation.
          </li>
          <li>
            <span className="text-text font-medium">Economic Mobility</span> — historical
            probability of moving up the income ladder if you start here.
          </li>
          <li>
            <span className="text-text font-medium">Housing Affordability</span> — median
            income relative to median home price.
          </li>
          <li>
            <span className="text-text font-medium">Employment Growth</span> — job creation
            rate, unemployment, and breadth of industries hiring.
          </li>
          <li>
            <span className="text-text font-medium">Cost of Living</span> — non-housing
            expenses (groceries, transit, services, taxes).
          </li>
        </ul>

        <h2 className="text-2xl font-bold mt-10 mb-3">Base weights by career</h2>
        <p className="text-muted mb-4">
          Different fields reward different geographies. A few starting weights:
        </p>
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.04] text-muted">
              <tr>
                <th className="text-left px-3 py-2">Career</th>
                <th className="text-right px-3 py-2">Inc.</th>
                <th className="text-right px-3 py-2">Mob.</th>
                <th className="text-right px-3 py-2">Hous.</th>
                <th className="text-right px-3 py-2">Empl.</th>
                <th className="text-right px-3 py-2">CoL</th>
              </tr>
            </thead>
            <tbody className="text-text">
              <tr className="border-t border-white/10">
                <td className="px-3 py-2">Finance &amp; IB</td>
                <td className="text-right px-3 py-2">0.35</td>
                <td className="text-right px-3 py-2">0.25</td>
                <td className="text-right px-3 py-2">0.15</td>
                <td className="text-right px-3 py-2">0.15</td>
                <td className="text-right px-3 py-2">0.10</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-3 py-2">Technology</td>
                <td className="text-right px-3 py-2">0.25</td>
                <td className="text-right px-3 py-2">0.20</td>
                <td className="text-right px-3 py-2">0.15</td>
                <td className="text-right px-3 py-2">0.30</td>
                <td className="text-right px-3 py-2">0.10</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-3 py-2">Healthcare</td>
                <td className="text-right px-3 py-2">0.20</td>
                <td className="text-right px-3 py-2">0.25</td>
                <td className="text-right px-3 py-2">0.20</td>
                <td className="text-right px-3 py-2">0.25</td>
                <td className="text-right px-3 py-2">0.10</td>
              </tr>
              <tr className="border-t border-white/10">
                <td className="px-3 py-2">Law</td>
                <td className="text-right px-3 py-2">0.30</td>
                <td className="text-right px-3 py-2">0.25</td>
                <td className="text-right px-3 py-2">0.15</td>
                <td className="text-right px-3 py-2">0.20</td>
                <td className="text-right px-3 py-2">0.10</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="text-2xl font-bold mt-10 mb-3">Personalization</h2>
        <p className="text-muted mb-4 leading-relaxed">
          On top of career, we tilt weights for your specific situation:
        </p>
        <ul className="text-muted space-y-2 list-disc pl-6">
          <li><span className="text-text">Remote work</span>: +0.15 to housing — you can live anywhere, so housing math matters more.</li>
          <li><span className="text-text">Plan to own a home</span>: +0.10 to housing.</li>
          <li><span className="text-text">Age &lt; 25</span>: +0.10 to mobility — early career, you&apos;re still climbing.</li>
          <li><span className="text-text">Age &gt; 40</span>: +0.10 to housing, +0.05 to income — protect what you&apos;ve built.</li>
          <li><span className="text-text">High risk tolerance</span>: +0.10 to income, −0.05 to housing.</li>
          <li><span className="text-text">Low risk tolerance</span>: +0.10 to cost of living, −0.05 to income.</li>
        </ul>
        <p className="text-muted mt-4 leading-relaxed">
          All weights are renormalized to sum to 1.0 after adjustment.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">10-year wealth projection</h2>
        <p className="text-muted leading-relaxed">
          We estimate your expected income (median local income times a career multiplier,
          floored by your salary goal), subtract annual housing costs (~5% of median home
          price) and a cost-of-living adjustment, then compound the resulting savings at 6%
          annually for 10 years. It&apos;s a rough back-of-envelope — not financial advice.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">Fit labels</h2>
        <ul className="text-muted space-y-2 list-disc pl-6">
          <li><span className="text-primary">Strong Match</span> — score ≥ 85</li>
          <li><span className="text-warning">Good Fit</span> — score ≥ 72</li>
          <li><span className="text-muted">Consider</span> — score ≥ 60</li>
          <li><span className="text-danger">Poor Fit</span> — score &lt; 60</li>
        </ul>
      </div>
    </main>
  );
}
