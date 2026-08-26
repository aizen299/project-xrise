import { Card, CardContent } from '@/components/ui/card';
import { SubmitForm } from './submit-form';

export const metadata = { title: 'Submit a ticket · XRise Helpdesk' };

export default function SubmitTicketPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="animate-rise flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          How can we help?
        </h1>
        <p className="text-muted-foreground">
          No account needed. Submit a ticket and we will send you an ID you can use to track it.
        </p>
      </div>

      <Card className="animate-rise surface" style={{ animationDelay: '60ms' }}>
        <CardContent className="pt-6">
          <SubmitForm />
        </CardContent>
      </Card>
    </div>
  );
}
