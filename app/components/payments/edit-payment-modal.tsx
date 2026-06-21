import { CustomSelect } from "../ui/custom-select";
import { RivnDatePicker } from "../ui/rivn-date-picker";

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

interface EditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payment: {
    clientId: string;
    projectId: string;
    paidAt: string;
    amount: string;
    source: string;
    documentUrl: string;
    isRecurring: boolean;
  }) => void | Promise<void>;
  isSubmitting?: boolean;
  canManage?: boolean;
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
  clients: ClientItem[];
  projects: ProjectItem[];
  mode: "planned" | "fact";
  documentUrl: string;
  setDocumentUrl: (value: string) => void;
  isRecurring: boolean;
  setIsRecurring: (value: boolean) => void;
}

function getClientDisplayName(client: ClientItem) {
  return client.name || client.clientName || client.title || "Без названия";
}

export function EditPaymentModal({
  isOpen,
  onClose,
  onSave,
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
  clients,
  projects,
  mode,
  documentUrl,
  setDocumentUrl,
  isRecurring,
  setIsRecurring,
}: EditPaymentModalProps) {
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

  async function handleSave() {
    if (!canManage) return;
    if (isSubmitting) return;
    if (!clientId.trim() || !projectId.trim() || !paidAt.trim() || !amount.trim()) {
      return;
    }

    await onSave({
      clientId,
      projectId,
      paidAt,
      amount,
      source,
      documentUrl,
      isRecurring,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#020611]/75 p-3 backdrop-blur-md sm:items-center sm:p-4">
      <div className="rivn-card max-h-[92vh] w-full max-w-2xl overflow-y-auto p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <button
            type="button"
            aria-pressed={isRecurring}
            disabled={isDisabled}
            onClick={() => setIsRecurring(!isRecurring)}
            className={`order-2 inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 text-xs font-semibold text-white/72 transition sm:ml-auto ${
              isDisabled
                ? "cursor-not-allowed opacity-50"
                : isRecurring
                  ? "border-[#00f5a8]/55 bg-[#00f5a8]/14 text-white shadow-[0_12px_36px_rgba(0,245,168,0.16)]"
                  : "hover:border-[#00f5a8]/35 hover:bg-white/[0.07] hover:text-white"
            }`}
          >
            <span
              className={`grid h-4 w-4 place-items-center rounded-[6px] border text-[10px] leading-none transition ${
                isRecurring
                  ? "border-[#00f5a8] bg-[#00f5a8] text-white"
                  : "border-white/24 bg-white/[0.04] text-transparent"
              }`}
            >
              {isRecurring ? "✓" : ""}
            </span>
            <span>Повторяющийся платёж</span>
          </button>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#43ffc2]">Редактирование</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
              {mode === "planned" ? "Изменить счёт" : "Изменить оплату"}
            </h2>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              if (!isSubmitting) onClose();
            }}
            className="rivn-button order-3 w-full px-4 py-2 text-sm text-white/70 disabled:cursor-not-allowed disabled:text-white/35 sm:w-auto"
          >
            Закрыть
          </button>
        </div>

        {!canManage ? (
          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            У тебя нет прав на редактирование платежей. Доступен только просмотр.
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
            buttonClassName="rivn-field h-[48px] text-white shadow-none"
            dropdownClassName="border-white/10 bg-[#0b1424] shadow-[0_20px_70px_rgba(0,0,0,0.55)]"
          />

          <CustomSelect
            value={projectId}
            onChange={setProjectId}
            disabled={!clientId || isDisabled}
            options={projectOptions}
            placeholder={clientId ? "Выбери проект" : "Сначала выбери клиента"}
            buttonClassName="rivn-field h-[48px] text-white shadow-none"
            dropdownClassName="border-white/10 bg-[#0b1424] shadow-[0_20px_70px_rgba(0,0,0,0.55)]"
          />

          <RivnDatePicker
            value={paidAt}
            disabled={isDisabled}
            onChange={setPaidAt}
            placeholder={mode === "planned" ? "Срок оплаты" : "Дата оплаты"}
          />

          <input
            value={amount}
            disabled={isDisabled}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Сумма"
            className="rivn-field disabled:cursor-not-allowed disabled:opacity-50"
          />

          <textarea
            value={source}
            disabled={isDisabled}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Комментарий"
            rows={4}
            className="rivn-field rivn-textarea disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2"
          />

          <input
            value={documentUrl}
            disabled={isDisabled}
            onChange={(e) => setDocumentUrl(e.target.value)}
            placeholder="Ссылка на документ"
            className="rivn-field disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2"
          />
        </div>

        <div className="mt-6 grid gap-3 sm:flex sm:items-center sm:justify-end">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              if (!isSubmitting) onClose();
            }}
            className="rivn-button px-4 py-3 text-sm text-white/80 disabled:cursor-not-allowed disabled:text-white/35"
          >
            Отмена
          </button>

          <button
            type="button"
            disabled={isSubmitDisabled}
            onClick={handleSave}
            className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
              isSubmitDisabled
                ? "cursor-not-allowed bg-white/[0.04] text-white/35"
                : "rivn-button-primary"
            }`}
          >
            {isSubmitting ? "Сохранение..." : "Сохранить изменения"}
          </button>
        </div>
      </div>
    </div>
  );
}
