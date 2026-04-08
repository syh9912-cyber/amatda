import { Router } from 'express';
import { registerAskHandler } from './ask.handler';
import { registerHistoryHandlers } from './history.handler';
import { registerFollowupHandler } from './followup.handler';
import { registerFirstTalkHandler } from './firstTalk.handler';
import { registerWeeklyReportHandler } from './weeklyReport.handler';
import { registerDailyDiaryHandler } from './dailyDiary.handler';
import { registerParentMentalHandler } from './parentMental.handler';
import { registerFuturePredictHandler } from './futurePredict.handler';
import { registerNowActivityHandler } from './nowActivity.handler';
import { registerAnalyzeMediaHandler } from './analyzeMedia.handler';

const router = Router();

registerAskHandler(router);
registerHistoryHandlers(router);
registerFollowupHandler(router);
registerFirstTalkHandler(router);
registerWeeklyReportHandler(router);
registerDailyDiaryHandler(router);
registerParentMentalHandler(router);
registerFuturePredictHandler(router);
registerNowActivityHandler(router);
registerAnalyzeMediaHandler(router);

export default router;
