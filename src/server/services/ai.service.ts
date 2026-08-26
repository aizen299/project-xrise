import { getTicketDetail } from './ticket.service';
import { completeChat, isAiEnabled } from '../ai/provider';
import { AppError } from '../errors';
import type { AuthUser } from '../auth/guards';

const SYSTEM_PROMPT = [
  'You are a support agent at XRise drafting a reply to a customer.',
  'Write only the reply body. No subject line, no salutation placeholders like [Name], no sign-off block.',
  'Be specific to the ticket. Acknowledge the problem, state what happens next, and ask for exactly what you still need.',
  'Never invent facts, refund amounts, timelines, or account details that are not in the ticket history.',
  'If the ticket lacks the information needed to resolve it, ask a focused question instead of guessing.',
  'Keep it under 140 words. Plain, warm, professional. No marketing language.',
].join(' ');

function buildTranscript(detail: Awaited<ReturnType<typeof getTicketDetail>>): string {
  const lines = [
    `Subject: ${detail.subject}`,
    `Priority: ${detail.priority}`,
    `Status: ${detail.status}`,
    `Customer: ${detail.customerName}`,
    '',
    `Original message: ${detail.body}`,
    '',
    'History:',
  ];

  for (const event of detail.events) {
    if (event.type === 'replied') {
      lines.push(`- ${event.actorName} replied: ${String(event.payload.body ?? '')}`);
    } else if (event.type === 'status_changed') {
      lines.push(
        `- ${event.actorName} changed status ${String(event.payload.from ?? '')} -> ${String(event.payload.to ?? '')}`,
      );
    }
  }

  return lines.join('\n');
}

export async function draftReply(ticketId: string, user: AuthUser): Promise<string> {
  if (!isAiEnabled()) {
    throw new AppError(
      'CONFLICT',
      'AI drafting is not configured on this deployment. Set LLM_API_KEY to enable it.',
    );
  }

  const detail = await getTicketDetail(ticketId, user);

  try {
    return await completeChat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildTranscript(detail) },
    ]);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('INTERNAL', 'The drafting service is unavailable. Write the reply manually.');
  }
}
