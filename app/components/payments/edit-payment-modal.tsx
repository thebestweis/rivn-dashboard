interface ClientItem {
  id: string;
  name?: string;
  clientName?: string;
  title?: string;
}

interface EditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payment: {
    client: string;
    project: string;
    paidAt: string;
    amount: string;
    source: string;
    documentUrl: string;
  }) => void;
  client: string;
  setClient: (value: string) => void;
  project: string;
  setProject: (value: string) => void;
  paidAt: string;
  setPaidAt: (value: string) => void;
  amount: string;
  setAmount: (value: string) => void;
  source: string;
  setSource: (value: string) => void;
  clients: ClientItem[];
  mode: "planned" | "fact";
  documentUrl: string;
  setDocumentUrl: (value: string) => void;
}

function getClientDisplayName(client: ClientItem) {
  return client.name || client.clientName || client.title || "Без названия";
}

export function EditPaymentModal({
  isOpen,
  onClose,
  onSave,
  client,
  setClient,
  project,
  setProject,
  paidAt,
  setPaidAt,
  amount,
  setAmount,
  source,
  setSource,
  clients,
  mode,
  documentUrl,
  setDocumentUrl,
}: EditPaymentModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_50px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-white/50">Редактирование</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              {mode === "planned" ? "Изменить счёт" : "Изменить оплату"}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 hover:text-white"
          >
            Закрыть
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <select
            value={client}
            onChange={(e) => setClient(e.target.value)}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">Выбери клиента</option>
            {clients.map((item) => (
              <option key={item.id} value={item.id}>
                {getClientDisplayName(item)}
              </option>
            ))}
          </select>

          <input
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder="Проект / период"
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
          />

          <input
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            placeholder={mode === "planned" ? "Срок оплаты" : "Дата оплаты"}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
          />

          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Сумма"
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
          />

          <textarea
  value={source}
  onChange={(e) => setSource(e.target.value)}
  placeholder="Комментарий"
/>
          <input
  value={documentUrl}
  onChange={(e) => setDocumentUrl(e.target.value)}
  placeholder="Ссылка на документ"
/>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80"
          >
            Отмена
          </button>

          <button
            onClick={() => {
              if (!client.trim()) return;

              onSave({
  client,
  project,
  paidAt,
  amount,
  source,
  documentUrl,
});
            }}
            className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)]"
          >
            Сохранить изменения
          </button>
        </div>
      </div>
    </div>
  );
}