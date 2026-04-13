type ExpenseCategory =
  | "marketing"
  | "contractor"
  | "service"
  | "tax"
  | "other";

interface EditExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: {
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

export function EditExpenseModal({
  isOpen,
  onClose,
  onSave,
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
}: EditExpenseModalProps) {
  if (!isOpen) return null;

  const isDisabled = !canManageExpenses || isSubmitting;
  const isValid = Boolean(title.trim());

  async function handleSave() {
    if (!canManageExpenses) return;
    if (isSubmitting) return;
    if (!title.trim()) return;

    await onSave({
      title: title.trim(),
      category,
      amount,
      date,
      client,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_50px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-white/50">Редактирование</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              Изменить расход
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Закрыть
          </button>
        </div>

        {!canManageExpenses ? (
          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            У вас нет прав на редактирование расходов. Доступен только просмотр.
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название расхода"
            disabled={isDisabled}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 disabled:cursor-not-allowed disabled:opacity-50"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            disabled={isDisabled}
            className="rounded-2xl border border-white/10 bg-[#0F1524] px-4 py-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="marketing">Маркетинг</option>
            <option value="contractor">Подрядчик</option>
            <option value="service">Услуги</option>
            <option value="tax">Налоги</option>
            <option value="other">Другое</option>
          </select>

          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Сумма"
            disabled={isDisabled}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 disabled:cursor-not-allowed disabled:opacity-50"
          />

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={isDisabled}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />

          <select
            value={client}
            onChange={(e) => setClient(e.target.value)}
            disabled={isDisabled}
            className="md:col-span-2 w-full rounded-2xl border border-white/10 bg-[#0B0F1A] px-4 py-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Выбери клиента</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.clientName || c.title || "Без названия"}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80 transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            Отмена
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isDisabled || !isValid}
            className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)] transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Сохранение..." : "Сохранить изменения"}
          </button>
        </div>
      </div>
    </div>
  );
}