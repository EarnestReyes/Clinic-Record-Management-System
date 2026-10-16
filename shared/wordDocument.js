import { wordChartPart, wordChartDrawing } from './wordCharts.js';
const encode = value => new TextEncoder().encode(value);
const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const run = value => String(value ?? '').split(/\r?\n/).map((line, i) => `${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${xml(line)}</w:t>`).join('');
const paragraph = (text, style = 'Normal', align = '') => `<w:p><w:pPr><w:pStyle w:val="${style}"/>${align ? `<w:jc w:val="${align}"/>` : ''}</w:pPr><w:r>${run(text)}</w:r></w:p>`;

// Standards-compliant ZIP with stored entries; no browser or native dependency.
function zip(entries) {
  const parts = [], directory = []; let offset = 0;
  const crc = bytes => { let value = 0xffffffff; for (const byte of bytes) { value ^= byte; for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (0xedb88320 & -(value & 1)); } return (value ^ 0xffffffff) >>> 0; };
  const header = length => { const bytes = new Uint8Array(length); return { bytes, view: new DataView(bytes.buffer) }; };
  for (const [name, content] of Object.entries(entries)) {
    const filename = encode(name), data = encode(content), checksum = crc(data);
    const local = header(30); local.view.setUint32(0, 0x04034b50, true); local.view.setUint16(4, 20, true);
    local.view.setUint16(6, 0x800, true); local.view.setUint16(12, 33, true);
    local.view.setUint32(14, checksum, true); local.view.setUint32(18, data.length, true); local.view.setUint32(22, data.length, true); local.view.setUint16(26, filename.length, true);
    const central = header(46); central.view.setUint32(0, 0x02014b50, true); central.view.setUint16(4, 20, true); central.view.setUint16(6, 20, true);
    central.view.setUint16(8, 0x800, true); central.view.setUint16(14, 33, true); central.view.setUint32(16, checksum, true);
    central.view.setUint32(20, data.length, true); central.view.setUint32(24, data.length, true); central.view.setUint16(28, filename.length, true); central.view.setUint32(42, offset, true);
    parts.push(local.bytes, filename, data); directory.push(central.bytes, filename); offset += 30 + filename.length + data.length;
  }
  const directoryLength = directory.reduce((n, part) => n + part.length, 0), end = header(22);
  end.view.setUint32(0, 0x06054b50, true); end.view.setUint16(8, directory.length / 2, true); end.view.setUint16(10, directory.length / 2, true);
  end.view.setUint32(12, directoryLength, true); end.view.setUint32(16, offset, true);
  const output = new Uint8Array(offset + directoryLength + 22); let position = 0;
  for (const part of [...parts, ...directory, end.bytes]) { output.set(part, position); position += part.length; }
  return output;
}

export const wordMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export function wordDocument({ title, clinic = {}, subtitle = '', columns = [], rows = [], sections = [], analytics, recordCount = columns.length ? rows.length : 1, generatedAt = new Date() }) {
  const landscape = columns.length > 5, width = landscape ? 15038 : 10106;
  const weights = columns.map(column => column.width || 1), total = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map(weight => Math.floor(width * weight / total));
  const cell = (text, index, heading = false, alternate = false) => {
    const numeric = typeof text === 'number';
    const align = columns[index].align || (!heading && numeric ? 'right' : 'left');
    return `<w:tc><w:tcPr><w:tcW w:w="${widths[index]}" w:type="dxa"/><w:shd w:fill="${heading ? 'E9F2F1' : alternate ? 'F5F8F8' : 'FFFFFF'}"/><w:vAlign w:val="center"/></w:tcPr>${paragraph(text == null || text === '' ? '\u2014' : text, heading ? 'TableHeading' : 'TableText', align)}</w:tc>`;
  };
  const table = columns.length ? `<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="dxa"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(side => `<w:${side} w:val="single" w:sz="4" w:color="D9E2E5"/>`).join('')}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid><w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>${columns.map((column, i) => cell(column.label, i, true)).join('')}</w:tr>${rows.map((row, rowIndex) => {
    // Very tall rows must be able to continue on the next page.
    const compact = columns.every(column => String(row[column.key] ?? '').length < 800 && String(row[column.key] ?? '').split('\n').length < 12);
    return `<w:tr>${compact ? '<w:trPr><w:cantSplit/></w:trPr>' : ''}${columns.map((column, i) => cell(row[column.key], i, false, rowIndex % 2 === 1)).join('')}</w:tr>`;
  }).join('')}</w:tbl>` : '';
  const generated = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(generatedAt);
  const charts = analytics?.charts || [];
  const analysis = analytics ? paragraph('Executive summary', 'Heading1')
    + paragraph(analytics.summary.map(metric => `${metric.label}: ${metric.value}`).join('  |  '))
    + (analytics.notes || []).map(note => paragraph(note, 'Meta')).join('')
    + (analytics.empty ? paragraph('No records in the selected reporting period. No charts are generated.') : charts.map((chart, index) => paragraph(chart.title, 'Heading1') + wordChartDrawing(chart, index, width) + paragraph(chart.note, 'Meta')).join(''))
    + paragraph('Detailed records', 'Heading1') : '';
  const body = paragraph(clinic.clinic || 'Clinic', 'Clinic') + paragraph('Record Management System', 'Meta')
    + ([clinic.address, clinic.phone, clinic.email].some(Boolean) ? paragraph([clinic.address, clinic.phone, clinic.email].filter(Boolean).join(' | '), 'Meta') : '')
    + paragraph(title, 'Title') + paragraph(`Generated: ${generated}  |  Timezone: Asia/Manila  |  Total Records: ${recordCount}`, 'Meta')
    + (subtitle ? paragraph(subtitle, 'Meta') : '')
    + analysis + table + (columns.length && !rows.length ? paragraph('No records match the selected filters.') : '')
    + sections.map(([label, value]) => paragraph(label, 'Heading1') + paragraph(value == null || value === '' ? 'Not recorded' : value)).join('')
    + `<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="${landscape ? 16838 : 11906}" w:h="${landscape ? 11906 : 16838}"${landscape ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900" w:header="360" w:footer="360"/></w:sectPr>`;
  const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const chartTypes = charts.map((_, index) => `<Override PartName="/word/charts/chart${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`).join('');
  const chartRelationships = charts.map((_, index) => `<Relationship Id="chart${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="charts/chart${index + 1}.xml"/>`).join('');
  return zip({
    ...Object.fromEntries(charts.map((chart, index) => [`word/charts/chart${index + 1}.xml`, wordChartPart(chart)])),
    '[Content_Types].xml': declaration + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' + chartTypes + '</Types>',
    '_rels/.rels': declaration + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': declaration + `<w:document xmlns:w="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:background w:color="FFFFFF"/><w:body>${body}</w:body></w:document>`,
    'word/_rels/document.xml.rels': declaration + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' + chartRelationships + '</Relationships>',
    'word/styles.xml': declaration + `<w:styles xmlns:w="${ns}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="243447"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>${[['Normal',22],['Clinic',28],['Title',32],['Heading1',23],['Meta',18],['TableText',20],['TableHeading',20],['Footer',16]].map(([id,size]) => `<w:style w:type="paragraph" w:styleId="${id}"${id === 'Normal' ? ' w:default="1"' : ''}><w:name w:val="${id}"/><w:pPr>${['Title','Heading1','Clinic'].includes(id) ? '<w:keepNext/>' : ''}${id === 'Title' ? '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="6" w:color="A6C8C4"/></w:pBdr>' : ''}<w:spacing w:before="${['Title','Heading1'].includes(id) ? 160 : 0}" w:after="${id.startsWith('Table') || id === 'Footer' ? 40 : 100}"/></w:pPr><w:rPr><w:sz w:val="${size}"/>${['Title','Heading1','Clinic','TableHeading'].includes(id) ? '<w:b/>' : ''}<w:color w:val="${['Clinic','Heading1'].includes(id) ? '176B61' : id === 'Meta' || id === 'Footer' ? '526170' : '243447'}"/></w:rPr></w:style>`).join('')}</w:styles>`,
    'word/footer1.xml': declaration + `<w:ftr xmlns:w="${ns}">${paragraph('Generated by Careline Record Management System | ' + generated + ' | Asia/Manila', 'Footer')}<w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr><w:r><w:t xml:space="preserve">Confidential \u2014 Authorized Personnel Only  |  Page </w:t></w:r><w:fldSimple w:instr="PAGE"><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:t xml:space="preserve"> of </w:t></w:r><w:fldSimple w:instr="NUMPAGES"><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`
  });
}
