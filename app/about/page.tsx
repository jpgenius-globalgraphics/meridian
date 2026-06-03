import Link from 'next/link';

export const metadata = {
  title: 'About — Altus Index',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-bg text-text px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-primary text-sm hover:underline">
          ← Back to map
        </Link>
        <h1 className="text-4xl font-bold mt-6 mb-4">About Altus Index</h1>
        <p className="text-muted mb-6 leading-relaxed">
          Altus Index is a personalized economic opportunity map of the United States. It
          is designed to help young people answer a simple but enormously consequential
          question: <em>where should I move to build wealth?</em>
        </p>
        <p className="text-muted mb-6 leading-relaxed">
          Most maps treat all visitors the same. Altus Index doesn&apos;t. The map you see
          is shaped by your age, career field, salary goal, risk tolerance, and whether you
          want to own a home or work remotely. Two different people will see two very
          different versions of the same country.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">Data sources</h2>
        <p className="text-muted mb-4 leading-relaxed">
          When the data pipeline (<code className="text-text">scripts/</code>) is run, county
          scores are built from the following authoritative sources:
        </p>
        <ul className="text-muted space-y-2 list-disc pl-6">
          <li>
            <span className="text-text font-medium">US Census Bureau — ACS 5-year</span> —
            median household income, median home value, median rent, educational attainment,
            poverty rate, population, and median age.
          </li>
          <li>
            <span className="text-text font-medium">Bureau of Labor Statistics (BLS)</span> —
            county unemployment rates and metro employment levels (LAUCN series).
          </li>
          <li>
            <span className="text-text font-medium">Opportunity Atlas</span> — Raj Chetty et
            al.&apos;s tract-level economic mobility data, aggregated to the county level.
          </li>
        </ul>
        <p className="text-muted mt-4 leading-relaxed">
          The repo ships with curated estimates for ~50 representative counties so the app
          works out of the box. Counties whose data is sourced from the pipeline are tagged
          <em> Real data</em>; the seed set is tagged <em>Estimated</em>.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">Why this exists</h2>
        <p className="text-muted leading-relaxed">
          Career advice for 20-somethings is plentiful. Geography advice is not. And
          geography compounds: a 22-year-old who chooses the right metro can end up with
          dramatically more wealth at 32 than one who doesn&apos;t — even with the same
          career and the same effort. Altus Index is an attempt to make that tradeoff
          legible.
        </p>
      </div>
    </main>
  );
}
