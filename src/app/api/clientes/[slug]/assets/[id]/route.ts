import { deleteClientAsset, getClientAsset } from "@/lib/db/operations"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { id } = await params

  try {
    // Verify asset exists
    const asset = await getClientAsset(id)
    if (!asset) {
      return Response.json({ error: "Asset nao encontrado" }, { status: 404 })
    }

    await deleteClientAsset(id)
    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return Response.json({ error: message }, { status: 500 })
  }
}
