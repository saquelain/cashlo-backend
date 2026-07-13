export const errorHandler = (err, req, res, next) => {
  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Always log server-side, regardless of environment — this is what
  // actually needs to happen in production, not just in dev.
  console.error('❌ Error:', err);

  res.status(status).json({
    success: false,
    message,
    // Stack only ever goes to the CLIENT in development — that part stays gated.
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};