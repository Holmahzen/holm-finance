export class DomainError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(`${entity} com id "${id}" não encontrado.`, 404);
    this.name = "NotFoundError";
  }
}
