import answerHandler from '../../server/call/answer.js';
import eventHandler from '../../server/call/event.js';
import finishHandler from '../../server/call/finish.js';
import outboundHandler from '../../server/call/outbound.js';
import pccAgentsHandler from '../../server/call/pcc-agents.js';
import recordingHandler from '../../server/call/recording.js';
import tokenHandler from '../../server/call/token.js';

type VercelRequest = {
  query?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

const handlers: Record<string, (req: any, res: any) => Promise<unknown>> = {
  answer: answerHandler,
  event: eventHandler,
  finish: finishHandler,
  outbound: outboundHandler,
  'pcc-agents': pccAgentsHandler,
  recording: recordingHandler,
  token: tokenHandler,
};

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = first(req.query?.action) || '';
  const routeHandler = handlers[action];
  if (!routeHandler) return res.status(404).json({ error: 'Call endpoint not found' });
  return routeHandler(req, res);
}
