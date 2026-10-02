import { Router } from 'express';
import { presentPortfolio } from '../presenters.js';

export function createPortfolioRoutes({ portfolioService }) {
  const router = Router();

  router.get('/', async (req, res) => {
    const portfolio = await portfolioService.valuate(req.user);
    res.json(presentPortfolio(portfolio, new Date()));
  });

  return router;
}
