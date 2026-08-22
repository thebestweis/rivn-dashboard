export async function GET() {
  return Response.json({
    ok: true,
    skipped: true,
    message: "Scheduled Avito retry is disabled; reports are sent only at 09:00 MSK",
  });
}
