interface EmployeeItem {
  id: string;
  name: string;
  role: string;
  isActive?: boolean;
}

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (client: {
    name: string;
    status: "active" | "paused" | "problem" | "completed";
    owner: string;
    ownerId?: string | null;
    model: string;
    nextInvoice: string;
    amount: string;
    profit: string;
  }) => void;
  name: string;
  setName: (value: string) => void;
  owner: string;
  setOwner: (value: string) => void;
  ownerId: string;
  setOwnerId: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  status: "active" | "paused" | "problem" | "completed";
  setStatus: (value: "active" | "paused" | "problem" | "completed") => void;
  nextInvoice: string;
  setNextInvoice: (value: string) => void;
  amount: string;
  setAmount: (value: string) => void;
  profit: string;
  setProfit: (value: string) => void;
  employees: EmployeeItem[];
}

const CLIENT_STATUS_LABELS = {
  active: "Активный",
  paused: "На паузе",
  problem: "Проблемный",
  completed: "Завершён",
};

export function CreateClientModal({
  isOpen,
  onClose,
  onCreate,
  name,
  setName,
  owner,
  setOwner,
  ownerId,
  setOwnerId,
  model,
  setModel,
  status,
  setStatus,
  nextInvoice,
  setNextInvoice,
  amount,
  setAmount,
  profit,
  setProfit,
  employees,
}: CreateClientModalProps) {
  if (!isOpen) return null;

  const activeEmployees = employees.filter((employee) => employee.isActive !== false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_50px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-white/50">Новый клиент</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              Добавить клиента
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название клиента"
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
          />

          <select
            value={ownerId}
            onChange={(e) => {
              const nextOwnerId = e.target.value;
              const selectedEmployee = activeEmployees.find(
                (employee) => employee.id === nextOwnerId
              );

              setOwnerId(nextOwnerId);
              setOwner(selectedEmployee?.name ?? "");
            }}
            className="rounded-2xl border border-white/10 bg-[#0F1524] px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">Ответственный сотрудник</option>
            {activeEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} — {employee.role}
              </option>
            ))}
          </select>

          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Модель оплаты"
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
          />

          <select
            value={status}
            onChange={(e) =>
              setStatus(
                e.target.value as "active" | "paused" | "problem" | "completed"
              )
            }
            className="rounded-2xl border border-white/10 bg-[#0F1524] px-4 py-3 text-sm text-white outline-none"
          >
            <option value="active">{CLIENT_STATUS_LABELS.active}</option>
            <option value="paused">{CLIENT_STATUS_LABELS.paused}</option>
            <option value="problem">{CLIENT_STATUS_LABELS.problem}</option>
            <option value="completed">{CLIENT_STATUS_LABELS.completed}</option>
          </select>

          <input
            value={nextInvoice}
            onChange={(e) => setNextInvoice(e.target.value)}
            placeholder="Следующий счёт"
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
          />

          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Сумма"
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
          />

          <input
            value={profit}
            onChange={(e) => setProfit(e.target.value)}
            placeholder="Прибыль"
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
              if (!name.trim()) return;

              const selectedEmployee = activeEmployees.find(
                (employee) => employee.id === ownerId
              );

              onCreate({
                name,
                status,
                owner: selectedEmployee?.name ?? owner,
                ownerId: ownerId || null,
                model,
                nextInvoice,
                amount,
                profit,
              });
            }}
            className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)]"
          >
            Создать клиента
          </button>
        </div>
      </div>
    </div>
  );
}