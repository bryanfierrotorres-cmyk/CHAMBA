export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Timeout after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export const withTimeout = <T>(promise: PromiseLike<T>, ms: number): Promise<T> =>
  Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new TimeoutError(ms)), ms);
    }),
  ]);
