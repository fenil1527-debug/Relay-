import { ZodError } from 'zod';

/**
 * Factory: creates validation middleware from a Zod schema.
 * Validates req.body by default; pass 'query' or 'params' to validate those instead.
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const data = schema.parse(req[source]);
      req[source] = data; // replace with parsed/coerced data
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: err.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(err);
    }
  };
}
