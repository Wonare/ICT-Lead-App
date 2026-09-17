'use strict';

/**
 * Centralized error handling.
 * Clients never see stack traces, SQL errors or server internals -
 * only a friendly message. Details are logged server-side.
 */

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: 'The requested resource was not found.'
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Malformed JSON body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid request payload.' });
  }

  // Body too large
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request payload is too large.' });
  }

  console.error(`[ERROR] ${req.method} ${req.originalUrl} ->`, err.message);

  const status = Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const message =
    status === 500
      ? 'Something went wrong on our side. Please try again later.'
      : err.message || 'Request could not be processed.';

  res.status(status).json({ success: false, message });
}

module.exports = { notFoundHandler, errorHandler };
