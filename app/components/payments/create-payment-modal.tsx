import { CustomSelect } from "../ui/custom-select";

interface ClientItem {
  id: string;
  name?: string;
  clientName?: string;
  title?: string;
}

interface ProjectItem {
  id: string;
  name: string;
  client_id: string;
}

interface CreatePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payment: {
    clientId: string;
    projectId: string;
    paidAt: string;
    amount: string;
    source: string;
    documentUrl: string;
  }) => void | Promise<void>;
  clientId: string;
  setClientId: (value: string) => void;
  projectId: string;
  setProjectId: (value: string) => void;
  paidAt: string;
  setPaidAt: (value: string) => void;
  amount: string;
  setAmount: (value: string) => void;
  source: string;
  setSource: (value: string) => void;
  documentUrl: string;
  setDocumentUrl: (value: string) => void;
  clients: ClientItem[];
  projects: ProjectItem[];
  mode: "invoice" | "payment";
  isSubmitting?: boolean;
  canManage?: boolean;
}

function getClientDisplayName(client: ClientItem) {
  return client.name || client.clientName || client.title || "Без названия";
}

export function CreatePaymentModal({
  isOpen,
  onClose,
  onCreate,
  isSubmitting = false,
  canManage = false,
  clientId,
  setClientId,
  projectId,
  setProjectId,
  paidAt,
  setPaidAt,
  amount,
  setAmount,
  source,
  setSource,
  documentUrl,
  setDocumentUrl,
  clients,
  projects,
  mode,
}: CreatePaymentModalProps) {
  if (!isOpen) return null;

  const filteredProjects = projects.filter(
    (project) => project.client_id === clientId
  );
  const clientOptions = clients.map((client) => ({
    value: client.id,
    label: getClientDisplayName(client),
  }));
  const projectOptions = filteredProjects.map((project) => ({
    value: project.id,
    label: project.name,
  }));

  const isDisabled = isSubmitting || !canManage;
  const isSubmitDisabled =
    isDisabled ||
    !clientId.trim() ||
    !projectId.trim() ||
    !paidAt.trim() ||
    !amount.trim();

  async function handleCreate() {
    if (!canManage) return;
    if (isSubmitting) return;
    if (!clientId.trim() || !projectId.trim() || !paidAt.trim() || !amount.trim()) {
      return;
    }

    await onCreate({
      clientId,
      projectId,
      paidAt,
      amount,
      source,
      documentUrl,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#121826] p-4 shadow-[0_10px_50px_rgba(0,0,0,0.45)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm text-white/50">
              {mode === "invoice" ? "Новый счёт" : "Новая оплата"}
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {mode === "invoice" ? "Выставить счёт" : "Добавить оплату"}
            </h2>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              if (!isSubmitting) onClose();
            }}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:text-white disabled:cursor-not-allowed disabled:text-white/35 sm:w-auto"
          >
            Закрыть
          </button>
        </div>

        {!canManage ? (
          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            У тебя нет прав на создание платежей. Доступен только просмотр.
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:gap-4 md:grid-cols-2">
          <CustomSelect
            value={clientId}
            disabled={isDisabled}
            onChange={(value) => {
              setClientId(value);
              setProjectId("");
            }}
            options={clientOptions}
            placeholder="Выбери клиента"
            buttonClassName="h-[46px] border-white/10 bg-white/[0.04] text-white shadow-none hover:bg-white/[0.06]"
            dropdownClassName="border-white/10 bg-[#121826] shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
          />

          <CustomSelect
            value={projectId}
            onChange={setProjectId}
            disabled={!clientId || isDisabled}
            options={projectOptions}
            placeholder={clientId ? "Выбери проект" : "Сначала выбери клиента"}
            buttonClassName="h-[46px] border-white/10 bg-white/[0.04] text-white shadow-none hover:bg-white/[0.06]"
            dropdownClassName="border-white/10 bg-[#121826] shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
          />

          <input
            type="date"
            value={paidAt}
            disabled={isDisabled}
            onChange={(e) => setPaidAt(e.target.value)}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />

          <input
            value={amount}
            disabled={isDisabled}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Сумма"
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 disabled:cursor-not-allowed disabled:opacity-50"
          />

          <textarea
            value={source}
            disabled={isDisabled}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Комментарий"
            rows={4}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2"
          />

          <input
            value={documentUrl}
            disabled={isDisabled}
            onChange={(e) => setDocumentUrl(e.target.value)}
            placeholder="Ссылка на документ"
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2"
          />
        </div>

        <div className="mt-6 grid gap-3 sm:flex sm:items-center sm:justify-end">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              if (!isSubmitting) onClose();
            }}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80 disabled:cursor-not-allowed disabled:text-white/35"
          >
            Отмена
          </button>

          <button
            type="button"
            disabled={isSubmitDisabled}
            onClick={handleCreate}
            className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
              isSubmitDisabled
                ? "cursor-not-allowed bg-white/[0.04] text-white/35"
                : "bg-emerald-400/15 text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)] hover:bg-emerald-400/20"
            }`}
          >
            {isSubmitting
              ? "Создание..."
              : mode === "invoice"
                ? "Создать счёт"
                : "Создать оплату"}
          </button>
        </div>
      </div>
    </div>
  );
}
