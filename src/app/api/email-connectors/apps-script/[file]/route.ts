import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { HttpError, errorResponse } from "@/lib/server/authorization";

const files = { code: { name: "Code.gs", type: "text/plain; charset=utf-8" }, manifest: { name: "appsscript.json", type: "application/json; charset=utf-8" } } as const;
export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  try { const { file } = await params; const selected = files[file as keyof typeof files]; if (!selected) throw new HttpError(404, "Connector file not found"); const content = await readFile(join(process.cwd(), "integrations", "google-apps-script", selected.name), "utf8"); return new Response(content, { headers: { "content-type": selected.type, "content-disposition": `inline; filename="${selected.name}"`, "cache-control": "no-store" } }); } catch (error) { return errorResponse(error); }
}
