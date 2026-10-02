import { PositionGroup } from './PositionGroup.js';
import { Sector } from './Sector.js';

export class Portfolio extends PositionGroup {
  constructor(positions) {
    super(positions);
    this.sectors = groupBySector(positions);
  }

  // Accepts anything with an `investment`: a position or a whole sector.
  weightOf(item) {
    return this.investment === 0 ? 0 : (item.investment / this.investment) * 100;
  }
}

function groupBySector(positions) {
  const bySector = new Map();
  for (const position of positions) {
    const name = position.holding.sector;
    if (!bySector.has(name)) bySector.set(name, []);
    bySector.get(name).push(position);
  }

  return [...bySector]
    .map(([name, members]) => new Sector(name, members.sort(byLargestInvestment)))
    .sort((a, b) => b.investment - a.investment);
}

function byLargestInvestment(a, b) {
  return b.investment - a.investment;
}
