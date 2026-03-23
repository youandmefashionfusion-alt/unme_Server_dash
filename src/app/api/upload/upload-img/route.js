export async function POST() {
  return Response.json(
    {
      success: false,
      message: "Deprecated endpoint. Use /api/upload/upload for direct uploads.",
    },
    { status: 410 }
  );
}
