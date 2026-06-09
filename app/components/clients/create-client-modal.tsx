import { CustomSelect } from "../ui/custom-select";
import { RivnDatePicker } from "../ui/rivn-date-picker";

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
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-[#020611]/75 p-3 backdrop-blur-md sm:items-center sm:p-4">
      <div className="rivn-card flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)]">
        <div className="shrink-0 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[#43ffc2]">
                Новый клиент
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
                Добавить клиента
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rivn-button w-full px-4 py-2 text-sm text-white/70 sm:w-auto"
            >
              Закрыть
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6">
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Название клиента"
              className="rivn-field"
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
              buttonClassName="rivn-field h-[48px] shadow-none"
            />

            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="Модель оплаты"
              className="rivn-field"
            />

            <CustomSelect
              value={status}
              onChange={(value) =>
                setStatus(value as "active" | "paused" | "problem" | "completed")
              }
              options={statusOptions}
              buttonClassName="rivn-field h-[48px] shadow-none"
            />

            <RivnDatePicker
              value={nextInvoice}
              onChange={setNextInvoice}
              placeholder="День оплаты"
            />

            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Потенциальный доход"
              className="rivn-field"
            />

            <input
              value={profit}
              onChange={(event) => setProfit(event.target.value)}
              placeholder="Потенциальная прибыль"
              className="rivn-field md:col-span-2"
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-white/10 bg-[#07111f]/70 p-4 backdrop-blur-xl sm:px-6">
          <div className="grid gap-3 sm:flex sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rivn-button px-4 py-3 text-sm text-white/80"
            >
              Отмена
            </button>

            <button
              type="button"
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
              className="rivn-button rivn-button-primary px-4 py-3 text-sm font-semibold"
            >
              Создать клиента
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
