import { dreService } from "@/services/dreService";
import {
  computeTrailingMonths,
  computeSimplesNacionalStatus,
  SIMPLES_NACIONAL_CEILING,
  SIMPLES_NACIONAL_SUBLIMIT,
} from "@/domain/simplesNacional";

export const simplesNacionalService = {
  async getReport() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const months = computeTrailingMonths(year, month, 12);
    const monthlyRevenues = await Promise.all(
      months.map(async ({ year: y, month: m }) => {
        const dre = await dreService.getDRE(y, m);
        return { year: y, month: m, revenue: dre.receitaBruta.total };
      }),
    );

    const status = computeSimplesNacionalStatus(monthlyRevenues, year, month);

    return {
      period: { year, month },
      ceiling: SIMPLES_NACIONAL_CEILING,
      sublimit: SIMPLES_NACIONAL_SUBLIMIT,
      monthlyRevenues,
      ...status,
    };
  },
};
