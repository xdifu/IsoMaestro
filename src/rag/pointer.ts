export function encodePointer(collection: string, doc: string, frag: string, hash: string) {
  return `ev://${encodeURIComponent(collection)}/${encodeURIComponent(doc)}#${encodeURIComponent(frag)}?v=${encodeURIComponent(hash)}`;
}
export function parsePointer(id: string) {
  if (!id.startsWith("ev://")) throw new Error("Bad pointer");
  const noProto = id.slice(5);
  const [path, query] = noProto.split("?");
  const [col, rest] = path.split("/");
  const [doc, fragRaw] = rest.split("#");
  const frag = fragRaw ?? "";
  const params = new URLSearchParams(query ?? "");
  const v = params.get("v") ?? "";
  return { collection: decodeURIComponent(col), doc: decodeURIComponent(doc), frag: decodeURIComponent(frag), version: v };
}
