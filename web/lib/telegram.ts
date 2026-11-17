type TelegramResult = {
  ok: boolean;
  error?: string;
};

export async function sendTelegramMessage(
  message: string,
): Promise<TelegramResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error(
      "Telegram notification skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured.",
    );
    return { ok: false, error: "Telegram environment variables are missing." };
  }

  const text = message.trim();
  if (!text) {
    return { ok: false, error: "Telegram message cannot be empty." };
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      },
    );

    const result: { ok?: boolean; description?: string } =
      await response.json().catch(() => ({}));

    if (!response.ok || result.ok !== true) {
      const reason = result.description ?? `HTTP ${response.status}`;
      console.error("Telegram API request failed:", reason);
      return { ok: false, error: reason };
    }

    return { ok: true };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown network error";
    console.error("Unable to send Telegram notification:", reason);
    return { ok: false, error: reason };
  }
}
