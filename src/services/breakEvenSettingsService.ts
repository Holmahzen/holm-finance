import { breakEvenSettingsRepository } from "@/repositories/breakEvenSettingsRepository";

export const breakEvenSettingsService = {
  async get() {
    const existing = await breakEvenSettingsRepository.findFirst();
    if (existing) return existing;
    return breakEvenSettingsRepository.create();
  },

  async update(marginAlertThreshold: string | number) {
    const settings = await this.get();
    return breakEvenSettingsRepository.update(settings.id, marginAlertThreshold);
  },
};
