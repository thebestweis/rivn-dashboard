export type AppNotificationKind =
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "marketing";

export type AppNotification = {
  id: string;
  workspace_id: string | null;
  recipient_user_id: string;
  title: string;
  body: string;
  kind: AppNotificationKind;
  link_url: string | null;
  source: string;
  created_at: string;
  read_at: string | null;
};

export function getFriendlyNotificationError(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("not found") || message.includes("does not exist")) {
      return "Центр уведомлений ещё не подготовлен в базе данных. Выполни SQL-миграцию из docs/notifications-center.sql.";
    }

    if (message.includes("auth") || message.includes("jwt")) {
      return "Сессия закончилась. Войди заново, чтобы увидеть уведомления.";
    }
  }

  return "Не удалось загрузить уведомления. Попробуй обновить страницу.";
}
