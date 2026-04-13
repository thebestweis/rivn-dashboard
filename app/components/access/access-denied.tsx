"use client";

type AccessDeniedProps = {
  title?: string;
  description?: string;
};

export function AccessDenied({
  title = "Доступ ограничен",
  description = "У тебя нет прав для просмотра этого раздела. Обратись к владельцу кабинета или администратору.",
}: AccessDeniedProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-8 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="text-sm text-white/50">Доступ</div>
      <h2 className="mt-1 text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
        {description}
      </p>
    </div>
  );
}