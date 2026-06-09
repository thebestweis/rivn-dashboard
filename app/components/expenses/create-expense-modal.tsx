import { CustomSelect } from "../ui/custom-select";
import { RivnDatePicker } from "../ui/rivn-date-picker";

type ExpenseCategory =
  | "marketing"
  | "contractor"
  | "service"
  | "tax"
  | "other";

interface CreateExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (expense: {
    title: string;
    category: ExpenseCategory;
    amount: string;
    date: string;
    client: string;
  }) => void | Promise<void>;
  title: string;
  setTitle: (value: string) => void;
  category: ExpenseCategory;
  setCategory: (value: ExpenseCategory) => void;
  amount: string;
  setAmount: (value: string) => void;
  date: string;
  setDate: (value: string) => void;
  client: string;
  setClient: (value: string) => void;
  clients: Array<{
    id: string;
    name?: string;
    clientName?: string;
    title?: string;
  }>;
  canManageExpenses?: boolean;
  isSubmitting?: boolean;
}

const categoryOptions: Array<{ value: ExpenseCategory; label: string }> = [
  { value: "marketing", label: "Маркетинг" },
  { value: "contractor", label: "Подрядчик" },
  { value: "service", label: "Услуги" },
  { value: "tax", label: "Налоги" },
  { value: "other", label: "Другое" },
];

export function CreateExpenseModal({
  isOpen,
  onClose,
  onCreate,
  title,
  setTitle,
  category,
  setCategory,
  amount,
  setAmount,
  date,
  setDate,
  client,
  setClient,
  clients,
  canManageExpenses = false,
  isSubmitting = false,
}: CreateExpenseModalProps) {
  if (!isOpen) return null;

  const isDisabled = !canManageExpenses || isSubmitting;
  const isValid = Boolean(title.trim());
  const clientOptions = [
    { value: "", label: "Выбери клиента" },
    ...clients.map((item) => ({
      value: item.id,
      label: item.name || item.clientName || item.title || "Без названия",
    })),
  ];

  async function handleCreate() {
    if (!canManageExpenses) return;
    if (isSubmitting) return;
    if (!title.trim()) return;

    await onCreate({
      title: title.trim(),
      category,
      amount,
      date,
      client,
    });
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-[#020611]/75 p-3 backdrop-blur-md sm:items-center sm:p-4">
      <div className="rivn-card flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)]">
        <div className="shrink-0 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[#43ffc2]">
                Новый расход
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
                Добавить расход
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rivn-button w-full px-4 py-2 text-sm text-white/70 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              Закрыть
            </button>
          </div>

          {!canManageExpenses ? (
            <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              У вас нет прав на создание расходов. Доступен только просмотр.
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6">
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Название расхода"
              disabled={isDisabled}
              className="rivn-field disabled:cursor-not-allowed disabled:opacity-50"
            />

            <CustomSelect
              value={category}
              onChange={(value) => setCategory(value as ExpenseCategory)}
              options={categoryOptions}
              disabled={isDisabled}
              buttonClassName="rivn-field h-[48px] shadow-none"
            />

            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Сумма"
              disabled={isDisabled}
              className="rivn-field disabled:cursor-not-allowed disabled:opacity-50"
            />

            <RivnDatePicker
              value={date}
              onChange={setDate}
              disabled={isDisabled}
              placeholder="Дата расхода"
            />

            <CustomSelect
              value={client}
              onChange={setClient}
              options={clientOptions}
              disabled={isDisabled}
              buttonClassName="rivn-field h-[48px] shadow-none"
              className="md:col-span-2"
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-white/10 bg-[#07111f]/70 p-4 backdrop-blur-xl sm:px-6">
          <div className="grid gap-3 sm:flex sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rivn-button px-4 py-3 text-sm text-white/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Отмена
            </button>

            <button
              type="button"
              onClick={handleCreate}
              disabled={isDisabled || !isValid}
              className="rivn-button rivn-button-primary px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Создание..." : "Создать расход"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
