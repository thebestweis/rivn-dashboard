interface EditExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: {
    title: string;
    category: "marketing" | "contractor" | "service" | "tax" | "other";
    amount: string;
    date: string;
    client: string;
  }) => void;
  title: string;
  setTitle: (value: string) => void;
  category: "marketing" | "contractor" | "service" | "tax" | "other";
  setCategory: (
    value: "marketing" | "contractor" | "service" | "tax" | "other"
  ) => void;
  amount: string;
  setAmount: (value: string) => void;
  date: string;
  setDate: (value: string) => void;
  client: string;
  setClient: (value: string) => void;
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
}: EditExpenseModalProps) {
  if (!isOpen) return null;

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
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 hover:text-white"
          >
            Закрыть
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название расхода"
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
          />

          <select
            value={category}
            onChange={(e) =>
              setCategory(
                e.target.value as
                  | "marketing"
                  | "contractor"
                  | "service"
                  | "tax"
                  | "other"
              )
            }
            className="rounded-2xl border border-white/10 bg-[#0F1524] px-4 py-3 text-sm text-white outline-none"
          >
            <option value="marketing">marketing</option>
            <option value="contractor">contractor</option>
            <option value="service">service</option>
            <option value="tax">tax</option>
            <option value="other">other</option>
          </select>

          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Сумма"
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
          />

          <input
  type="date"
  value={date}
  onChange={(e) => setDate(e.target.value)}
  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none"
/>

          <input
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="Клиент / направление"
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 md:col-span-2"
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
              if (!title.trim()) return;

              onSave({
                title,
                category,
                amount,
                date,
                client,
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