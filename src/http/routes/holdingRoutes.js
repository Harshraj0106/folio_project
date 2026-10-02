import { Router } from 'express';
import { presentHolding } from '../presenters.js';
import { holdingChanges, holdingParams, newHolding, newHoldings } from '../schemas.js';

export function createHoldingRoutes({ holdingRepository }) {
  const router = Router();

  router.post('/', async (req, res) => {
    const holding = await holdingRepository.create(req.user, newHolding.parse(req.body));
    res.status(201).json(presentHolding(holding));
  });

  router.post('/bulk', async (req, res) => {
    const holdings = await holdingRepository.createMany(req.user, newHoldings.parse(req.body));
    res.status(201).json({ created: holdings.length });
  });

  router.patch('/:id', async (req, res) => {
    const { id } = holdingParams.parse(req.params);
    const holding = await holdingRepository.update(req.user, id, holdingChanges.parse(req.body));
    res.json(presentHolding(holding));
  });

  router.delete('/:id', async (req, res) => {
    const { id } = holdingParams.parse(req.params);
    await holdingRepository.remove(req.user, id);
    res.status(204).end();
  });

  return router;
}
