/**
 * scripts/seed.js
 * Crea el administrador único (si no existe) y 3 anuncios de ejemplo
 * con sus fotografías. Uso: npm run db:seed
 */
'use strict';

const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const env = require('../config/env');
const adminModel = require('../models/admin.model');
const anuncioModel = require('../models/anuncio.model');
const categoriaModel = require('../models/categoria.model');
const fotoModel = require('../models/foto.model');
const { slugify } = require('../utils/slug');

function addYear(date) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

const ANUNCIOS = [
  {
    razon_social: 'Restaurante Sabor Criollo',
    categoria: 'restaurantes-y-comidas',
    descripcion_50:
      'Auténtica cocina venezolana con los mejores platos criollos: arepas, pabellón, hallacas y asados. Ambiente familiar, servicio a domicilio y eventos corporativos. Más de 15 años deleitando a nuestros clientes con sazón casero, ingredientes frescos y atención de primera calidad en el corazón de la ciudad.',
    direccion: 'Av. Principal de Las Mercedes, Caracas',
    telefono_fijo: '+58 212 555 1234',
    telefono_movil: '+58 414 555 5678',
    email: 'reservas@saborcriollo.com',
    sitio_web: 'https://www.saborcriollo.com',
    facebook: 'https://facebook.com/saborcriollo',
    instagram: 'https://instagram.com/saborcriollo',
    youtube: 'https://youtube.com/@saborcriollo',
    tiktok: 'https://tiktok.com/@saborcriollo',
    ciudad: 'Caracas',
    pais: 'Venezuela',
    latitud: 10.4806,
    longitud: -66.9036,
    palabras_clave: 'restaurante,comida criolla,arepas,venezolano,delivery,eventos,catering,almuerzos,hallacas,asados',
  },
  {
    razon_social: 'Clínica Vida Sana',
    categoria: 'salud-y-bienestar',
    descripcion_50:
      'Centro médico integral con especialistas en medicina general, pediatría, ginecología y laboratorio clínico. Contamos con tecnología de punta y un equipo humano comprometido con tu bienestar. Ofrecemos consultas, exámenes, ecografías y planes de salud preventiva para toda la familia con atención personalizada.',
    direccion: 'Calle 100 #45-30, Bogotá',
    telefono_fijo: '+57 601 555 9000',
    telefono_movil: '+57 320 555 1122',
    email: 'citas@vidassana.co',
    sitio_web: 'https://www.vidassana.co',
    facebook: 'https://facebook.com/clinicavidassana',
    instagram: 'https://instagram.com/clinicavidassana',
    ciudad: 'Bogotá, D.C.',
    pais: 'Colombia',
    latitud: 4.711,
    longitud: -74.0721,
    palabras_clave: 'clínica,salud,medicina general,pediatría,gynecología,laboratorio,ecografía,consultas,bienestar,prevención',
  },
  {
    razon_social: 'TecnoSoluciones C.A.',
    categoria: 'tecnologia-y-servicios',
    descripcion_50:
      'Empresa dedicada al desarrollo de software, soporte técnico y soluciones informáticas para pymes y empresas. Creamos páginas web, aplicaciones móviles, sistemas de facturación y redes. Ofrecemos mantenimiento preventivo, seguridad informática y consultoría tecnológica para impulsar la transformación digital de tu negocio.',
    direccion: 'Av. Insurgentes Sur 1234, Ciudad de México',
    telefono_fijo: '+52 55 5555 7788',
    telefono_movil: '+52 55 1234 5678',
    email: 'contacto@tecnosoluciones.mx',
    sitio_web: 'https://www.tecnosoluciones.mx',
    facebook: 'https://facebook.com/tecnosoluciones',
    instagram: 'https://instagram.com/tecnosoluciones',
    youtube: 'https://youtube.com/@tecnosoluciones',
    ciudad: 'Ciudad de México',
    pais: 'México',
    latitud: 19.4326,
    longitud: -99.1332,
    palabras_clave: 'software,desarrollo web,apps,soporte técnico,redes,facturación,seguridad informática,consultoría,pymes,tecnología',
  },
];

async function ensureAdmin() {
  const existing = await adminModel.findByEmail(env.seed.adminEmail);
  if (existing) {
    console.log(`[seed] El administrador ya existe: ${env.seed.adminEmail}`);
    return existing;
  }
  const hash = await bcrypt.hash(env.seed.adminPassword, 12);
  const admin = await adminModel.create({
    nombre: env.seed.adminName,
    email: env.seed.adminEmail,
    passwordHash: hash,
  });
  console.log(`[seed] Administrador creado: ${admin.email} / ${env.seed.adminPassword}`);
  return admin;
}

async function ensureAnuncios() {
  const cats = await categoriaModel.listSimple();
  const bySlug = new Map(cats.map((c) => [c.slug, c.id]));

  for (const item of ANUNCIOS) {
    const slug = slugify(item.razon_social);
    if (await anuncioModel.slugExists(slug)) {
      console.log(`[seed] El anuncio "${item.razon_social}" ya existe, se omite.`);
      // eslint-disable-next-line no-continue
      continue;
    }
    const inicio = new Date().toISOString().slice(0, 10);
    const id = await anuncioModel.create({
      ...item,
      slug,
      categoria_id: bySlug.get(item.categoria) || null,
      estado: 'activo',
      fecha_inicio: inicio,
      fecha_vencimiento: addYear(inicio),
    });

    // 11 fotografías de ejemplo (URLs remotas de prueba)
    for (let i = 1; i <= 11; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await fotoModel.add(id, `https://picsum.photos/seed/${slug}-${i}/1200/800`, null, i - 1);
    }
    console.log(`[seed] Anuncio creado: ${item.razon_social} (11 fotos).`);
  }
}

(async () => {
  try {
    await ensureAdmin();
    await ensureAnuncios();
    console.log('[seed] Datos de ejemplo cargados correctamente.');
  } catch (e) {
    console.error('[seed] Error:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
