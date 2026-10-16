/**
 * controllers/csv.controller.js
 * Importación masiva de anuncios vía CSV desde el panel.
 */
'use strict';

const { importCsv } = require('../services/csv.service');
const { invalidatePublicCache } = require('../middlewares/cache');

async function importar(req, res, next) {
  try {
    if (!req.file) return res.status(422).json({ ok: false, error: 'Adjunta un archivo CSV.' });
    const report = await importCsv(req.file.buffer, { defaultEstado: req.body.estado || 'activo' });
    await invalidatePublicCache();
    return res.json({
      ok: true,
      message: `Importación finalizada: ${report.inserted} de ${report.total} filas.`,
      report,
    });
  } catch (e) { next(e); }
}

module.exports = { importar };
