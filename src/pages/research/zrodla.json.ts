import india from '../../../research/india.json';
import west from '../../../research/west.json';
import visual from '../../../research/visual-audit.json';
export const prerender = true;
export function GET() {
  return new Response(JSON.stringify({checkedDate:'2026-10-03',methodology:'Celowy przegląd jakościowy 50 witryn, źródła pierwotne i odrębny ogląd zrzutów w przeglądarce; deklaracje przekazu nie są niezależnie uwierzytelnione.',sites:[...india,...west],visualAudit:visual},null,2),{headers:{'Content-Type':'application/json; charset=utf-8'}});
}
