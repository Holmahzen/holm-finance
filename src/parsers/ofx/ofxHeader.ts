export type OfxHeader = Record<string, string>;

export function parseOfxHeader(content: string): {
  header: OfxHeader;
  body: string;
} {
  const ofxTagIndex = content.indexOf("<OFX>");
  const headerText = ofxTagIndex >= 0 ? content.slice(0, ofxTagIndex) : "";
  const body = ofxTagIndex >= 0 ? content.slice(ofxTagIndex) : content;

  const header: OfxHeader = {};
  for (const line of headerText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    header[key] = value;
  }

  return { header, body };
}
