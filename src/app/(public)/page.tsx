import { SubmitForm } from './submit-form';

export const metadata = { title: 'Submit a ticket · XRise Helpdesk' };

export default function SubmitTicketPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Submit a support ticket</h1>
        <p className="mt-2 text-sm opacity-70">
          No account needed. You will get a ticket ID to track progress.
        </p>
      </div>
      <SubmitForm />
    </div>
  );
}
