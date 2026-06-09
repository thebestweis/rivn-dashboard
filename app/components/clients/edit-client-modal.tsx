import { CustomSelect } from "../ui/custom-select";
import { RivnDatePicker } from "../ui/rivn-date-picker";

interface EmployeeItem {
  id: string;
  name: string;
  role: string;
  isActive?: boolean;
}

interface EditClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (client: {
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
  employees?: EmployeeItem[];
}

const CLIENT_STATUS_LABELS = {
  active: "Активный",
  paused: "На паузе",
  problem: "Проблемный",
  completed: "Завершён",
};

export function EditClientModal({
  isOpen,
  onClose,
  onSave,
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
  employees = [],
}: EditClientModalProps) {
  if (!isOpen) return null;

  const availableEmployees = employees.filter(
    (employee) => employee.isActive !== false || employee.id === ownerId
  );
  const ownerOptions = [
    { value: "", label: "Ответственный сотрудник" },
    ...availableEmployees.map((employee) => ({
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#030914]/70 p-3 backdrop-blur-xl sm:items-center sm:p-4">
      <div className="rivn-panel max-h-[92vh] w-full max-w-2xl overflow-y-auto p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm text-white/50">Редактирование</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Изменить клиента
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
            className="rivn-field"
          />

          <CustomSelect
            value={ownerId}
            onChange={(nextOwnerId) => {
              const selectedEmployee = availableEmployees.find(
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
            className="rivn-field"
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

          <RivnDatePicker
            value={nextInvoice}
            onChange={setNextInvoice}
            placeholder="День оплаты"
          />

          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Потенциальный доход"
            className="rivn-field"
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

              const selectedEmployee = availableEmployees.find(
                (employee) => employee.id === ownerId
              );

              onSave({
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
            className="rivn-button-primary rounded-2xl px-4 py-3 text-sm"
          >
            Сохранить изменения
          </button>
        </div>
      </div>
    </div>
  );
}
