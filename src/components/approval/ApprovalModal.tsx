import type { ApprovalRequest } from '../../../shared/types/ipc'

export function ApprovalModal({
  request,
  onRespond
}: {
  request: ApprovalRequest
  onRespond: (approved: boolean) => void
}) {
  const isWhatsApp = request.toolName === 'whatsapp_send_message'
  const message = isWhatsApp ? String(request.args.message ?? '') : null
  const contact = isWhatsApp ? String(request.args.contactName ?? '') : null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="max-w-lg w-full rounded-xl border border-[#28CFFF]/20 bg-[#0a1219] p-5 shadow-2xl">
        <h3 className="text-sm tracking-wide text-[#8BDFFF]">
          {isWhatsApp ? 'Confirm WhatsApp message' : 'Approval required'}
        </h3>
        {isWhatsApp ? (
          <div className="mt-3 space-y-2 text-sm">
            <p className="text-slate-400">Send to <span className="text-slate-200">{contact}</span>?</p>
            <p className="text-slate-200 leading-relaxed border border-white/[0.06] rounded-lg px-3 py-2 bg-black/30">
              {message}
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-300 mt-2">{request.summary}</p>
            <p className="text-xs text-slate-500 mt-2">Risk: {request.risk}</p>
          </>
        )}
        <div className="mt-5 flex gap-2 justify-end">
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white"
            onClick={() => onRespond(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-sm bg-[#28CFFF] text-slate-950 font-medium hover:bg-[#8BDFFF]"
            onClick={() => onRespond(true)}
          >
            {isWhatsApp ? 'Send' : 'Allow'}
          </button>
        </div>
      </div>
    </div>
  )
}
