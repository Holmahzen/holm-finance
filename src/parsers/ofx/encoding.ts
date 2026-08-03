import iconv from "iconv-lite";

const CHARSET_TO_ENCODING: Record<string, string> = {
  "1252": "windows-1252",
  USASCII: "ascii",
  "8859-1": "iso-8859-1",
  UTF8: "utf-8",
  NONE: "utf-8",
};

export function decodeOfxBuffer(buffer: Buffer): string {
  const headerText = buffer.subarray(0, 512).toString("ascii");
  const charsetMatch = headerText.match(/CHARSET:(\S+)/i);
  const charset = charsetMatch?.[1] ?? "1252";
  const encoding = CHARSET_TO_ENCODING[charset] ?? "windows-1252";
  return iconv.decode(buffer, encoding);
}
