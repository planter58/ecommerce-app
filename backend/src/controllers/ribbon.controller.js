import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query, withTransaction } from '../config/db.js';
import { isCloudEnabled, uploadBuffer } from '../utils/cloudinary.js';

// Local uploads fallback dir
const uploadsDir = path.join(process.cwd(), 'uploads', 'ribbon');
fs.mkdirSync(uploadsDir, { recursive: true });

// Multer setup for single file under field name 'media'
const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
}).single('media');

function rowToDto(r) {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    cta_label: r.cta_label,
    cta_url: r.cta_url,
    media_url: r.media_url,
    media_type: r.media_type,
    media_poster_url: r.media_poster_url,
    enabled: r.enabled,
    position: r.position,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// Public list (enabled only)
export async function listPublicRibbon(_req, res, next) {
  try {
    const { rows } = await query(
      'SELECT * FROM ribbon_items WHERE enabled = true ORDER BY position ASC, created_at DESC'
    );
    res.json(rows.map(rowToDto));
  } catch (e) { next(e); }
}

// Admin list all
export async function adminList(_req, res, next) {
  try {
    const { rows } = await query('SELECT * FROM ribbon_items ORDER BY position ASC, created_at DESC');
    res.json(rows.map(rowToDto));
  } catch (e) { next(e); }
}

export async function adminCreate(req, res, next) {
  try {
    const { title, body, cta_label, cta_url, media_type, enabled = true } = req.body || {};
    const { rows: posRows } = await query('SELECT COALESCE(MAX(position),0)+1 AS pos FROM ribbon_items');
    const position = posRows[0]?.pos || 1;
    const { rows } = await query(
      `INSERT INTO ribbon_items (title, body, cta_label, cta_url, media_type, enabled, position)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [title || null, body || null, cta_label || null, cta_url || null, media_type || null, enabled, position]
    );
    res.status(201).json(rowToDto(rows[0]));
  } catch (e) { next(e); }
}

export async function adminUpdate(req, res, next) {
  try {
    const { id } = req.params;
    const { title, body, cta_label, cta_url, media_type, media_poster_url, enabled, position } = req.body || {};
    const { rows } = await query(
      `UPDATE ribbon_items SET
        title = COALESCE($2, title),
        body = COALESCE($3, body),
        cta_label = COALESCE($4, cta_label),
        cta_url = COALESCE($5, cta_url),
        media_type = COALESCE($6, media_type),
        media_poster_url = COALESCE($7, media_poster_url),
        enabled = COALESCE($8, enabled),
        position = COALESCE($9, position)
       WHERE id = $1
       RETURNING *`,
      [id, title, body, cta_label, cta_url, media_type, media_poster_url, enabled, position]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rowToDto(rows[0]));
  } catch (e) { next(e); }
}

export async function adminEnable(req, res, next) {
  try {
    const { id } = req.params; const { enabled } = req.body;
    const { rows } = await query('UPDATE ribbon_items SET enabled=$2 WHERE id=$1 RETURNING *', [id, enabled]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rowToDto(rows[0]));
  } catch (e) { next(e); }
}

export async function adminReorder(req, res, next) {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  // items: [{id, position}]
  try {
    await withTransaction(async (client) => {
      for (const it of items) {
        await client.query('UPDATE ribbon_items SET position=$2 WHERE id=$1', [it.id, it.position]);
      }
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
}

export async function adminDelete(req, res, next) {
  try {
    const { id } = req.params;
    await query('DELETE FROM ribbon_items WHERE id=$1', [id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
}

export async function adminUploadMedia(req, res, next) {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No media file' });

    const mime = req.file.mimetype || '';
    let resource_type = 'image';
    if (mime.startsWith('video/')) resource_type = 'video';

    let url;
    if (isCloudEnabled()) {
      const result = await uploadBuffer(req.file.buffer, { folder: 'ecommerce-app/ribbon', resource_type });
      url = result.secure_url;
    } else {
      // fallback to local save
      const ext = path.extname(req.file.originalname) || (resource_type === 'video' ? '.mp4' : '.png');
      const fname = `${id}-${Date.now()}${ext}`;
      const full = path.join(uploadsDir, fname);
      fs.writeFileSync(full, req.file.buffer);
      url = `/uploads/ribbon/${fname}`;
    }

    const media_type = resource_type === 'image' ? (mime.includes('gif') ? 'gif' : 'image') : 'video';
    const { rows } = await query(
      'UPDATE ribbon_items SET media_url=$2, media_type=$3 WHERE id=$1 RETURNING *',
      [id, url, media_type]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rowToDto(rows[0]));
  } catch (e) { next(e); }
}
