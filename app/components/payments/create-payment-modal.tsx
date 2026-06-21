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
    isRecurring: boolean;
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
  isRecurring: boolean;
  setIsRecurring: (value: boolean) => void;
  clients: ClientItem[];
  projects: ProjectItem[];
  mode: "invoice" | "payment";
  setMode: (value: "invoice" | "payment") => void;
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
  isRecurring,
  setIsRecurring,
  clients,
  projects,
  mode,
  setMode,
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
      isRecurring,
    });
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-[#020611]/75 p-3 backdrop-blur-md sm:items-center sm:p-4">
      <div className="rivn-card flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)]">
        <div className="shrink-0 p-4 sm:p-6">
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
              <div className="text-xs uppercase tracking-[0.2em] text-[#43ffc2]">
                {mode === "payment" ? "Проведённый платёж" : "Запланированный платёж"}
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
                Добавить оплату
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
              У тебя нет прав на создание платежей. Доступен только просмотр.
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6">
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            <button
              type="button"
              disabled={isDisabled}
              onClick={() => setMode(mode === "payment" ? "invoice" : "payment")}
              className={`flex items-center justify-between rounded-[22px] border px-4 py-3 text-left transition duration-300 active:scale-[0.99] md:col-span-2 ${
                mode === "payment"
                  ? "border-[#00f5a8]/35 bg-[#00f5a8]/12 text-white shadow-[0_18px_45px_rgba(0,245,168,0.12)]"
                  : "border-white/10 bg-white/[0.045] text-white/72 hover:border-white/16 hover:bg-white/[0.065]"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <span>
                <span className="block text-sm font-semibold">
                  Платёж уже проведён
                </span>
                <span className="mt-1 block text-xs text-white/45">
                  Если выключено, платёж будет создан как запланированный.
                </span>
              </span>
              <span
                className={`relative h-7 w-12 rounded-full transition ${
                  mode === "payment" ? "bg-[#00f5a8]" : "bg-white/12"
                }`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-lg transition ${
                    mode === "payment" ? "left-6" : "left-1"
                  }`}
                />
              </span>
            </button>

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
            />

            <CustomSelect
              value={projectId}
              onChange={setProjectId}
              disabled={!clientId || isDisabled}
              options={projectOptions}
              placeholder={clientId ? "Выбери проект" : "Сначала выбери клиента"}
              buttonClassName="rivn-field h-[48px] text-white shadow-none"
            />

            <RivnDatePicker
              value={paidAt}
              disabled={isDisabled}
              onChange={setPaidAt}
              placeholder={mode === "invoice" ? "Срок оплаты" : "Дата оплаты"}
            />

            <input
              value={amount}
              disabled={isDisabled}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Сумма"
              className="rivn-field disabled:cursor-not-allowed disabled:opacity-50"
            />

            <textarea
              value={source}
              disabled={isDisabled}
              onChange={(event) => setSource(event.target.value)}
              placeholder="Комментарий"
              rows={4}
              className="rivn-field rivn-textarea disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2"
            />

            <input
              value={documentUrl}
              disabled={isDisabled}
              onChange={(event) => setDocumentUrl(event.target.value)}
              placeholder="Ссылка на документ"
              className="rivn-field disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2"
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-white/10 bg-[#07111f]/70 p-4 backdrop-blur-xl sm:px-6">
          <div className="grid gap-3 sm:flex sm:items-center sm:justify-end">
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
              onClick={handleCreate}
              className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                isSubmitDisabled
                  ? "cursor-not-allowed bg-white/[0.04] text-white/35"
                  : "rivn-button-primary"
              }`}
            >
              {isSubmitting
                ? "Создание..."
                : mode === "payment"
                  ? "Создать проведённый платёж"
                  : "Создать плановый платёж"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
