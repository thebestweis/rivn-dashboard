import { CustomSelect } from "../ui/custom-select";

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
  const ownerOptions = [
    { value: "", label: "Ответственный пользователь" },
    ...activeEmployees.map((employee) => ({
      value: employee.id,
      label: `${employee.name} - ${employee.role}`,
    })),
  ];
  const statusOptions = [
    { value: "active", label: CLIENT_STATUS_LABELS.active },
    { value: "paused", label: CLIENT_STATUS_LABELS.paused },
    { value: "problem", label: CLIENT_STATUS_LABELS.problem },
    { value: "completed", label: CLIENT_STATUS_LABELS.completed },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#121826] p-4 shadow-[0_10px_50px_rgba(0,0,0,0.45)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm text-white/50">Новый клиент</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Добавить клиента
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 hover:text-white sm:w-auto"
          >
            Закрыть
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:gap-4 md:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название клиента"
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
          />

          <CustomSelect
            value={ownerId}
            onChange={(nextOwnerId) => {
              const selectedEmployee = activeEmployees.find(
                (employee) => employee.id === nextOwnerId
              );

              setOwnerId(nextOwnerId);
              setOwner(selectedEmployee?.name ?? "");
            }}
            options={ownerOptions}
            className="w-full"
            buttonClassName="bg-white/[0.04] dark:bg-white/[0.04]"
          />

          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Модель оплаты"
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
          />

          <CustomSelect
            value={status}
            onChange={(value) =>
              setStatus(value as "active" | "paused" | "problem" | "completed")
            }
            options={statusOptions}
            className="w-full"
            buttonClassName="bg-white/[0.04] dark:bg-white/[0.04]"
          />

          <input
            value={nextInvoice}
            onChange={(e) => setNextInvoice(e.target.value)}
            placeholder="День оплаты"
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
          />

          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Потенциальный доход"
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
          />

          <input
            value={profit}
            onChange={(e) => setProfit(e.target.value)}
            placeholder="Потенциальная прибыль"
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 md:col-span-2"
          />
        </div>

        <div className="mt-6 grid gap-3 sm:flex sm:items-center sm:justify-end">
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
