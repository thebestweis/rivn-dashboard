export function getBillingErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "UNKNOWN_ERROR";

  switch (message) {
    case "BILLING_READ_ONLY":
      return "Подписка неактивна. Доступен только режим просмотра.";
    case "BILLING_TEAM_REQUIRED":
      return "Эта функция доступна только на тарифе Team и выше.";
    case "BILLING_AI_REQUIRED":
      return "Эта функция доступна только на тарифе Strategy.";
    case "WORKSPACE_NOT_FOUND":
      return "Рабочее пространство не найдено.";
    case "MEMBERSHIP_NOT_FOUND":
      return "У вас нет доступа к рабочему пространству.";
    default:
      return "Не удалось выполнить действие.";
  }
}