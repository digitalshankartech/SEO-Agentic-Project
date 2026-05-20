import { Router } from 'express';
import authRouter from '../services/auth/routes.js';
import projectRouter from '../services/project/routes.js';
import crawlRouter from '../services/crawl/routes.js';
import keywordRouter from '../services/keyword/routes.js';
import serpRouter from '../services/serp/routes.js';
import backlinkRouter from '../services/backlink/routes.js';
import contentRouter from '../services/content/routes.js';
import agentRouter from '../services/agent/routes.js';
import reportRouter from '../services/report/routes.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/projects', projectRouter);
router.use('/crawl', crawlRouter);
router.use('/keywords', keywordRouter);
router.use('/serp', serpRouter);
router.use('/backlinks', backlinkRouter);
router.use('/content', contentRouter);
router.use('/agent', agentRouter);
router.use('/reports', reportRouter);

export default router;
