import { Router } from 'express';
import { registerAskHandler } from './ask.handler';
import { registerHistoryHandlers } from './history.handler';
import { registerFollowupHandler } from './followup.handler';
import { registerFirstTalkHandler } from './firstTalk.handler';
import { registerDailyDiaryHandler } from './dailyDiary.handler';
import { registerAnalyzeMediaHandler } from './analyzeMedia.handler';

const router = Router();

registerAskHandler(router);
registerHistoryHandlers(router);
registerFollowupHandler(router);
registerFirstTalkHandler(router);
registerDailyDiaryHandler(router);
registerAnalyzeMediaHandler(router);

export default router;
