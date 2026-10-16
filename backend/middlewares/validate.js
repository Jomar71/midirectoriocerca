/**
 * middlewares/validate.js
 * Envuelve express-validator y devuelve errores en formato JSON uniforme.
 */
'use strict';

const { validationResult } = require('express-validator');

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      ok: false,
      error: 'Datos inválidos.',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  return next();
}

module.exports = { handleValidation };
