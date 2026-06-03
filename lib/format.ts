export function formatCurrency(n: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1000)}k`;
    return `$${n}`;
  }
  return `$${n.toLocaleString('en-US')}`;
}

export function formatPopulation(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}k`;
  return n.toString();
}

export function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`;
}
