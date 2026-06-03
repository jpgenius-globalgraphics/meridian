import Link from 'next/link';

export const metadata = {
  title: 'About — Meridian',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-bg text-text px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-primary text-sm hover:underline">
          ← Back to map
        </Link>
        <h1 className="text-4xl font-bold mt-6 mb-4">About Meridian</h1>
        <p className="text-muted mb-6 leading-relaxed">
          Meridian is a personalized economic opportunity map of the United States. It is
          designed to help young people answer a simple but enormously consequential question:
          <em> where should I move to actually build wealth?</em>
        </p>
        <p className="text-muted mb-6 leading-relaxed">
          Most maps treat all visitors the same. Meridian doesn&apos;t. The map you see is shaped
          by your age, career field, salary goal, risk tolerance, and whether you want to own
          a home or work remotely. Two different people will see two very different versions
          of the same country.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">Data sources</h2>
        <p className="text-muted mb-4 leading-relaxed">
          The current build ships with curated estimates for 50 representative US counties so
          that the experience is fast and self-contained. Future versions will integrate:
        </p>
        <ul className="text-muted space-y-2 list-disc pl-6">
          <li>
            <span className="text-text font-medium">Opportunity Atlas</span> — Raj Chetty&apos;s
            granular economic mobility data by census tract.
          </li>
          <li>
            <span className="text-text font-medium">American Community Survey (ACS)</span> —
            US Census income, housing, education, and employment statistics.
          </li>
          <li>
            <span className="text-text font-medium">Bureau of Labor Statistics (BLS)</span> —
            employment growth, unemployment, and wage projections.
          </li>
          <li>
            <span className="text-text font-medium">Zillow / Redfin</span> — current housing
            price and rent indices.
          </li>
        </ul>

        <h2 className="text-2xl font-bold mt-10 mb-3">Why this exists</h2>
        <p className="text-muted leading-relaxed">
          Career advice for 20-somethings is plentiful. Geography advice is not. And
          geography compounds: a 22-year-old who chooses the right metro can end up with
          dramatically more wealth at 32 than one who doesn&apos;t — even with the same
          career and the same effort. Meridian is an attempt to make that tradeoff legible.
        </p>
      </div>
    </main>
  );
}
