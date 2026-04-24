type TelegramGetFileResponse = {
  ok: boolean;
  result?: {
    file_path?: string;
  };
  description?: string;
};

export async function getTelegramFileUrl(botToken: string, fileId: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`, {
    method: "GET",
    cache: "no-store",
  });

  const data = (await response.json()) as TelegramGetFileResponse;

  if (!response.ok || !data.ok || !data.result?.file_path) {
    throw new Error(data.description || "Не удалось получить файл из Telegram");
  }

  return `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
}