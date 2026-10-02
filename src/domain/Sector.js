import { PositionGroup } from './PositionGroup.js';

export class Sector extends PositionGroup {
  constructor(name, positions) {
    super(positions);
    this.name = name;
  }
}
