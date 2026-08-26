import { FileText, Image as ImageIcon, Paperclip } from 'lucide-react';

export interface AttachmentView {
  id: string;
  filename: string;
  contentType: string;
  size: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function iconFor(contentType: string) {
  if (contentType.startsWith('image/')) return ImageIcon;
  if (contentType === 'application/pdf' || contentType.startsWith('text/')) return FileText;
  return Paperclip;
}

export function AttachmentList({
  attachments,
  hrefFor,
}: {
  attachments: AttachmentView[];
  hrefFor: (attachment: AttachmentView) => string;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Paperclip className="size-3.5" />
        {attachments.length} {attachments.length === 1 ? 'attachment' : 'attachments'}
      </h3>
      <ul className="flex flex-wrap gap-2">
        {attachments.map((attachment) => {
          const Icon = iconFor(attachment.contentType);
          return (
            <li key={attachment.id}>
              <a
                href={hrefFor(attachment)}
                download={attachment.filename}
                rel="noopener noreferrer"
                className="surface surface-interactive flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm focus-visible:ring-ring/60 focus-visible:ring-[3px] focus-visible:outline-none"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="max-w-56 truncate">{attachment.filename}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatBytes(attachment.size)}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
