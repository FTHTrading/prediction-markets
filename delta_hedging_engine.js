/**
 * DonKAI Quantitative Specification - Delta Hedging Engine
 * Calculates Black-Scholes binary option pricing and analytical deltas.
 */

// Cumulative normal distribution function N(x) approximation
export function cnd(x) {
  const a1 =  0.319381530;
  const a2 = -0.356563782;
  const a3 =  1.781477937;
  const a4 = -1.821255978;
  const a5 =  1.330274429;
  const L = Math.abs(x);
  const K = 1.0 / (1.0 + 0.2316419 * L);
  let w = 1.0 - 1.0 / Math.sqrt(2.0 * Math.PI) * Math.exp(-L * L / 2.0) * (a1 * K + a2 * Math.pow(K, 2) + a3 * Math.pow(K, 3) + a4 * Math.pow(K, 4) + a5 * Math.pow(K, 5));
  if (x < 0) {
    w = 1.0 - w;
  }
  return w;
}

// Standard normal probability density function n(x)
export function nd(x) {
  return (1.0 / Math.sqrt(2.0 * Math.PI)) * Math.exp(-x * x / 2.0);
}

// Calculate Black-Scholes binary option pricing & delta
export function calculateBinaryDelta(S, K, sigma, timeDays, r = 0.0525) {
  if (isNaN(S) || S <= 0 || isNaN(K) || K <= 0 || isNaN(sigma) || sigma <= 0) {
    throw new Error("Invalid pricing parameters: Spot price (S), strike (K), and volatility (sigma) must be strictly positive numbers.");
  }

  const tau = Math.max(0.0001, timeDays / 365.0); // time to maturity in years
  
  const d2 = (Math.log(S / K) + (r - (sigma * sigma) / 2.0) * tau) / (sigma * Math.sqrt(tau));
  
  const price = Math.exp(-r * tau) * cnd(d2);
  const delta = (Math.exp(-r * tau) * nd(d2)) / (S * sigma * Math.sqrt(tau));
  
  return {
    spotPrice: S,
    strikeBarrier: K,
    volatility: sigma,
    timeRemainingYears: tau,
    d2: d2,
    binaryContractPrice: price,
    analyticalDelta: delta
  };
}

// Local testing execution block
export function runDeltaDiagnostic() {
  const assets = {
    dxy: { name: "US Dollar Index (DXY)", spot: 104.5, strike: 105.0, vol: 0.08, days: 30 },
    gold: { name: "Gold Spot Price", spot: 2420.0, strike: 2400.0, vol: 0.15, days: 45 },
    btc: { name: "Bitcoin Spot", spot: 63400.0, strike: 65000.0, vol: 0.45, days: 15 }
  };

  const results = {};
  for (const [key, asset] of Object.entries(assets)) {
    results[key] = {
      assetName: asset.name,
      ...calculateBinaryDelta(asset.spot, asset.strike, asset.vol, asset.days)
    };
  }
  return results;
}
