import india from '../../../research/india.json';
import west from '../../../research/west.json';
import visualAudit from '../../../research/visual-audit.json';
export const prerender = true;
export function GET() {
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"','""')}"`;
  const headers = ['ID','Nazwa','URL','Region','Kraj','Typ','Przekaz — deklaracja autora','Działy','Treść','Układ — analiza struktury','Wygląd — ogląd w przeglądarce','URL oglądu wizualnego','Ograniczenia oglądu','Natężenie sprzedaży','Wniosek dla Ilony','Ograniczenia treści','Źródła','Metoda','Data'];
  const rows = [...india,...west].map(e=>{const v=visualAudit.find(v=>v.id===e.id);return [e.id,e.name,e.url,e.region,e.country,e.type,e.traditionEvidence,e.sections.join(' | '),e.contentPL,e.designPL,v?.designPL,v?.url,v?.limitations,e.commercialLevel,e.takeawayPL,e.cautionPL,e.pagesReviewed.join(' | '),`${e.evidenceMethod} Osobno: ogląd pierwszego ekranu 1440 × 1000 px.`,e.checkedDate];});
  const csv = '\uFEFF' + [headers,...rows].map(row=>row.map(escape).join(';')).join('\r\n');
  return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8'}});
}
