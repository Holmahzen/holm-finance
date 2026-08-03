import { prisma } from "@/lib/prisma";

export const breakEvenSettingsRepository = {
  findFirst() {
    return prisma.breakEvenSettings.findFirst();
  },

  create() {
    return prisma.breakEvenSettings.create({ data: {} });
  },

  update(id: string, marginAlertThreshold: string | number) {
    return prisma.breakEvenSettings.update({ where: { id }, data: { marginAlertThreshold } });
  },
};
