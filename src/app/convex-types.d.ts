// TypeScript declarations to allow Next.js compilation prior to Convex Cloud binding
declare module "*/_generated/api" {
  export const api: unknown;
}

declare module "*/_generated/server" {
  export const query: (...args: unknown[]) => unknown;
  export const mutation: (...args: unknown[]) => unknown;
  export const action: (...args: unknown[]) => unknown;
}
