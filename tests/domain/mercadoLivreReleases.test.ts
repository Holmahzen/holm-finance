import { describe, it, expect } from "vitest";
import {
  classifySale,
  computeReleaseSchedule,
  computeScheduleFromDays,
  estimateReleaseDate,
  RELEASE_DELAY_DAYS,
  type SaleForRelease,
} from "@/domain/mercadoLivreReleases";

const TODAY = new Date(Date.UTC(2026, 8, 4));

function utc(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function sale(overrides: Partial<SaleForRelease> = {}): SaleForRelease {
  return { status: "Entregue", netRevenue: 100, deliveredAt: utc(2026, 9, 1), ...overrides };
}

describe("estimateReleaseDate", () => {
  it("soma o prazo padrão à data de entrega", () => {
    expect(estimateReleaseDate(utc(2026, 8, 31))).toEqual(utc(2026, 9, 2));
  });

  it("descarta a hora da entrega", () => {
    const withTime = new Date(Date.UTC(2026, 7, 31, 23, 47));
    expect(estimateReleaseDate(withTime)).toEqual(utc(2026, 9, 2));
  });
});

describe("classifySale", () => {
  it("marca como liberada a venda entregue há mais que o prazo", () => {
    const result = classifySale(sale({ deliveredAt: utc(2026, 8, 20) }), TODAY);
    expect(result.outcome).toBe("released");
    expect(result.releaseDate).toEqual(utc(2026, 8, 22));
  });

  it("marca como agendada a venda entregue ainda dentro do prazo", () => {
    const result = classifySale(sale({ deliveredAt: utc(2026, 9, 4) }), TODAY);
    expect(result.outcome).toBe("scheduled");
    expect(result.releaseDate).toEqual(utc(2026, 9, 6));
  });

  it("trata o repasse de hoje como agendado, não como já liberado", () => {
    // Entrega em 2/9 + 2 dias = repasse em 4/9, que é hoje: o dinheiro ainda
    // não está no saldo das contas, então não pode contar como liberado.
    const result = classifySale(sale({ deliveredAt: utc(2026, 9, 2) }), TODAY);
    expect(result.outcome).toBe("scheduled");
    expect(result.releaseDate).toEqual(TODAY);
  });

  it("deixa sem data a venda que ainda não foi entregue", () => {
    const result = classifySale(sale({ status: "A caminho", deliveredAt: null }), TODAY);
    expect(result.outcome).toBe("awaiting-delivery");
    expect(result.releaseDate).toBeNull();
  });

  it("separa devolução e mediação em aberto como valor em risco", () => {
    for (const status of [
      "Devolução em preparação",
      "Devolução a caminho",
      "Mediação com devolução habilitada",
      "Reclamação encerrada com reembolso para o comprador",
      "Troca pronta para retirada pelo comprador",
    ]) {
      expect(classifySale(sale({ status, deliveredAt: null }), TODAY).outcome).toBe("at-risk");
    }
  });

  it("não conta como risco a mediação decidida a favor do vendedor", () => {
    for (const status of [
      "Mediação finalizada. Te demos o dinheiro.",
      "Liberamos o dinheiro da venda para você e reembolsamos o comprador",
    ]) {
      expect(classifySale(sale({ status, deliveredAt: null }), TODAY).outcome).toBe("released");
    }
  });

  it("ignora venda cancelada e venda zerada", () => {
    expect(classifySale(sale({ status: "Cancelada pelo comprador" }), TODAY).outcome).toBe(
      "no-cash",
    );
    expect(classifySale(sale({ status: "Pacote cancelado pelo Mercado Livre" }), TODAY).outcome).toBe(
      "no-cash",
    );
    expect(classifySale(sale({ netRevenue: 0 }), TODAY).outcome).toBe("no-cash");
  });
});

describe("computeReleaseSchedule", () => {
  it("agrupa por dia de repasse e acumula em ordem", () => {
    const schedule = computeReleaseSchedule(
      [
        sale({ netRevenue: 100, deliveredAt: utc(2026, 8, 30) }),
        sale({ netRevenue: 50, deliveredAt: utc(2026, 8, 30) }),
        sale({ netRevenue: 25, deliveredAt: utc(2026, 9, 3) }),
      ],
      TODAY,
    );

    expect(schedule.days).toHaveLength(2);
    expect(schedule.days[0]).toMatchObject({ count: 2, amount: 150, cumulative: 150, released: true });
    expect(schedule.days[1]).toMatchObject({ count: 1, amount: 25, cumulative: 175, released: false });
  });

  it("soma cada desfecho no total certo", () => {
    const schedule = computeReleaseSchedule(
      [
        sale({ netRevenue: 100, deliveredAt: utc(2026, 8, 20) }),
        sale({ netRevenue: 40, deliveredAt: utc(2026, 9, 4) }),
        sale({ netRevenue: 30, status: "A caminho", deliveredAt: null }),
        sale({ netRevenue: 20, status: "Devolução em revisão", deliveredAt: null }),
        sale({ netRevenue: 0, status: "Cancelada pelo comprador", deliveredAt: null }),
      ],
      TODAY,
    );

    expect(schedule.releasedTotal).toBe(100);
    expect(schedule.scheduledTotal).toBe(40);
    expect(schedule.awaitingDelivery).toEqual({ count: 1, amount: 30 });
    expect(schedule.atRisk).toEqual({ count: 1, amount: 20 });
    expect(schedule.noCashCount).toBe(1);
    expect(schedule.total).toBe(190);
  });

  it("monta os quatro baldes só com dinheiro que ainda não caiu", () => {
    const schedule = computeReleaseSchedule(
      [
        // Já liberada: está no saldo da conta, não pode entrar nos baldes.
        sale({ netRevenue: 999, deliveredAt: utc(2026, 8, 1) }),
        sale({ netRevenue: 10, deliveredAt: utc(2026, 9, 2) }), // libera hoje
        sale({ netRevenue: 20, deliveredAt: utc(2026, 9, 3) }), // libera amanhã
        sale({ netRevenue: 30, deliveredAt: utc(2026, 9, 9) }), // libera em 7 dias
        sale({ netRevenue: 40, deliveredAt: utc(2026, 9, 20) }), // libera depois
        sale({ netRevenue: 50, status: "A caminho", deliveredAt: null }),
      ],
      TODAY,
    );

    expect(schedule.buckets).toEqual({ today: 10, tomorrow: 20, within7d: 30, after7d: 90 });
  });

  it("não conta o repasse de hoje como liberado e como balde ao mesmo tempo", () => {
    const schedule = computeReleaseSchedule(
      [sale({ netRevenue: 80, deliveredAt: utc(2026, 9, 2) })],
      TODAY,
    );

    expect(schedule.releasedTotal).toBe(0);
    expect(schedule.scheduledTotal).toBe(80);
    expect(schedule.buckets.today).toBe(80);
  });

  it("devolve baldes zerados quando não há venda", () => {
    const schedule = computeReleaseSchedule([], TODAY);
    expect(schedule.days).toEqual([]);
    expect(schedule.total).toBe(0);
    expect(schedule.buckets).toEqual({ today: 0, tomorrow: 0, within7d: 0, after7d: 0 });
  });

  it("usa o prazo de liberação informado no lugar do padrão", () => {
    const schedule = computeReleaseSchedule(
      [sale({ deliveredAt: utc(2026, 9, 3) })],
      TODAY,
      RELEASE_DELAY_DAYS + 3,
    );

    expect(schedule.days[0].date).toEqual(utc(2026, 9, 8));
  });
});

describe("computeScheduleFromDays", () => {
  // O hub entrega dias já agregados, com a data REAL do repasse vinda do
  // Mercado Pago. A divisão liberado/agendado e os quatro baldes continuam
  // sendo decididos aqui, com o "hoje" de quem está olhando a tela.
  const semExtras = {
    awaitingDelivery: { count: 0, amount: 0 },
    atRisk: { count: 0, amount: 0 },
  };

  it("separa liberado de agendado pelo dia de hoje", () => {
    const schedule = computeScheduleFromDays(
      [
        { date: utc(2026, 9, 1), count: 10, amount: 500 },
        { date: utc(2026, 9, 4), count: 5, amount: 200 },
        { date: utc(2026, 9, 9), count: 3, amount: 100 },
      ],
      TODAY,
      semExtras,
    );

    expect(schedule.releasedTotal).toBe(500);
    // o repasse de hoje ainda não caiu: conta como agendado
    expect(schedule.scheduledTotal).toBe(300);
    expect(schedule.days.map((d) => d.released)).toEqual([true, false, false]);
  });

  it("acumula na ordem das datas, mesmo recebendo fora de ordem", () => {
    const schedule = computeScheduleFromDays(
      [
        { date: utc(2026, 9, 9), count: 1, amount: 100 },
        { date: utc(2026, 9, 1), count: 1, amount: 500 },
        { date: utc(2026, 9, 4), count: 1, amount: 200 },
      ],
      TODAY,
      semExtras,
    );

    expect(schedule.days.map((d) => d.cumulative)).toEqual([500, 700, 800]);
  });

  it("monta os quatro baldes só com o que ainda não caiu", () => {
    const schedule = computeScheduleFromDays(
      [
        { date: utc(2026, 8, 20), count: 1, amount: 9999 }, // já liberado
        { date: utc(2026, 9, 4), count: 1, amount: 10 }, // hoje
        { date: utc(2026, 9, 5), count: 1, amount: 20 }, // amanhã
        { date: utc(2026, 9, 11), count: 1, amount: 30 }, // dentro de 7 dias
        { date: utc(2026, 9, 30), count: 1, amount: 40 }, // depois
      ],
      TODAY,
      { awaitingDelivery: { count: 2, amount: 50 }, atRisk: { count: 1, amount: 7 } },
    );

    expect(schedule.buckets).toEqual({ today: 10, tomorrow: 20, within7d: 30, after7d: 90 });
  });

  it("mantém mediação fora dos baldes mas dentro do total", () => {
    const schedule = computeScheduleFromDays(
      [{ date: utc(2026, 9, 5), count: 1, amount: 100 }],
      TODAY,
      { awaitingDelivery: { count: 0, amount: 0 }, atRisk: { count: 3, amount: 25 } },
    );

    expect(schedule.atRisk).toEqual({ count: 3, amount: 25 });
    expect(schedule.total).toBe(125);
    expect(Object.values(schedule.buckets).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("devolve calendário vazio sem estourar", () => {
    const schedule = computeScheduleFromDays([], TODAY, semExtras);
    expect(schedule.days).toEqual([]);
    expect(schedule.total).toBe(0);
    expect(schedule.buckets).toEqual({ today: 0, tomorrow: 0, within7d: 0, after7d: 0 });
  });
});
