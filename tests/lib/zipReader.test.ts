import { describe, it, expect } from "vitest";
import { deflateRawSync } from "node:zlib";
import { decodeXml, isZip, readZip } from "@/lib/zipReader";

type ZipFile = { name: string; data: Buffer; deflate?: boolean };

/** Monta um .zip mínimo (sem CRC, que o leitor não confere) para os testes. */
function makeZip(files: ZipFile[]): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const body = f.deflate ? deflateRawSync(f.data) : f.data;
    const method = f.deflate ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(f.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);

    locals.push(local, name, body);
    centrals.push(central, name);
    offset += 30 + name.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, directory, end]));
}

const XML = '<?xml version="1.0" encoding="UTF-8"?><nfeProc><x>CONFECÇÕES</x></nfeProc>';

describe("readZip", () => {
  it("lê entradas comprimidas e sem compressão, pulando pastas", async () => {
    const zip = makeZip([
      { name: "notas/", data: Buffer.alloc(0) },
      { name: "notas/a-nfe.xml", data: Buffer.from(XML), deflate: true },
      { name: "b-nfe.xml", data: Buffer.from("<b/>") },
    ]);
    expect(isZip(zip)).toBe(true);
    const entries = await readZip(zip);
    expect(entries.map((e) => e.name)).toEqual(["notas/a-nfe.xml", "b-nfe.xml"]);
    expect(decodeXml(entries[0].data)).toBe(XML);
  });

  it("abre .zip dentro de .zip", async () => {
    const inner = Buffer.from(makeZip([{ name: "dentro.xml", data: Buffer.from("<c/>"), deflate: true }]));
    const entries = await readZip(makeZip([{ name: "agosto.zip", data: inner }]));
    expect(entries.map((e) => e.name)).toEqual(["dentro.xml"]);
  });

  it("recusa arquivo que não é .zip", async () => {
    await expect(readZip(new Uint8Array(Buffer.from("não sou um zip, só texto")))).rejects.toThrow(".zip válido");
  });
});

describe("decodeXml", () => {
  it("respeita XML gravado em ISO-8859-1", () => {
    const latin = Buffer.from('<?xml version="1.0" encoding="ISO-8859-1"?><x>CONFECÇÕES</x>', "latin1");
    expect(decodeXml(new Uint8Array(latin))).toContain("CONFECÇÕES");
  });
});
