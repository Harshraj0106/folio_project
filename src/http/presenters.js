import { roundTo } from '../domain/numbers.js';

export function presentHolding(holding) {
  return {
    id: holding.id,
    name: holding.name,
    symbol: holding.symbol,
    exchange: holding.exchange,
    sector: holding.sector,
    purchasePrice: holding.purchasePrice,
    quantity: holding.quantity,
  };
}

export function presentPortfolio(portfolio, asOf) {
  return {
    asOf: asOf.toISOString(),
    marketOpen: portfolio.isMarketOpen,
    summary: presentTotals(portfolio),
    sectors: portfolio.sectors.map((sector) => ({
      name: sector.name,
      weight: roundTo(portfolio.weightOf(sector)),
      ...presentTotals(sector),
      positions: sector.positions.map((position) => presentPosition(position, portfolio)),
    })),
  };
}

function presentTotals(group) {
  return {
    investment: roundTo(group.investment),
    presentValue: roundTo(group.presentValue),
    gainLoss: roundTo(group.gainLoss),
    gainLossPercent: roundTo(group.gainLossPercent),
    unpricedCount: group.unpricedCount,
    staleCount: group.staleCount,
  };
}

function presentPosition(position, portfolio) {
  const { fundamentals } = position;
  return {
    ...presentHolding(position.holding),
    investment: roundTo(position.investment),
    weight: roundTo(portfolio.weightOf(position)),
    cmp: roundTo(position.cmp),
    cmpStale: position.isPriced && position.quote.stale,
    presentValue: roundTo(position.presentValue),
    gainLoss: roundTo(position.gainLoss),
    gainLossPercent: roundTo(position.gainLossPercent),
    fundamentals: fundamentals && {
      peRatio: roundTo(fundamentals.peRatio),
      earningsPerShare: roundTo(fundamentals.earningsPerShare),
      earningsPeriod: fundamentals.earningsPeriod,
      source: fundamentals.source,
    },
  };
}
