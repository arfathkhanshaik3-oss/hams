// Lets us use async/await in route handlers without try/catch in each one.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
