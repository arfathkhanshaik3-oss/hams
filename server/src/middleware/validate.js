// validate(schema, "body" | "query" | "params") - replaces req[source] with the
// parsed (trimmed, coerced, defaulted) value or forwards a ZodError.
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) return next(result.error);
  req[source] = result.data;
  return next();
};
