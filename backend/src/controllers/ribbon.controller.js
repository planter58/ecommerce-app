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
    title_mobile: r.title_mobile,
    body: r.body,
    body_mobile: r.body_mobile,
    cta_label: r.cta_label,
    cta_label_mobile: r.cta_label_mobile,
    cta_url: r.cta_url,
    media_url: r.media_url,
    media_type: r.media_type,
    media_poster_url: r.media_poster_url,
    bg_color: r.bg_color,
    background: r.background,
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
    const { title, title_mobile, body, body_mobile, cta_label, cta_label_mobile, cta_url, media_type, bg_color, background, enabled = true } = req.body || {};
    const { rows: posRows } = await query('SELECT COALESCE(MAX(position),0)+1 AS pos FROM ribbon_items');
    const position = posRows[0]?.pos || 1;
    const { rows } = await query(
      `INSERT INTO ribbon_items (title, title_mobile, body, body_mobile, cta_label, cta_label_mobile, cta_url, media_type, bg_color, background, enabled, position)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [title || null, title_mobile || null, body || null, body_mobile || null, cta_label || null, cta_label_mobile || null, cta_url || null, media_type || null, bg_color || null, background || null, enabled, position]
    );
    res.status(201).json(rowToDto(rows[0]));
  } catch (e) { next(e); }
}

export async function adminUpdate(req, res, next) {
  try {
    const { id } = req.params;
    const { title, title_mobile, body, body_mobile, cta_label, cta_label_mobile, cta_url, media_type, media_poster_url, bg_color, background, enabled, position } = req.body || {};
    const { rows } = await query(
      `UPDATE ribbon_items SET
        title = COALESCE($2, title),
        title_mobile = COALESCE($3, title_mobile),
        body = COALESCE($4, body),
        body_mobile = COALESCE($5, body_mobile),
        cta_label = COALESCE($6, cta_label),
        cta_label_mobile = COALESCE($7, cta_label_mobile),
        cta_url = COALESCE($8, cta_url),
        media_type = COALESCE($9, media_type),
        media_poster_url = COALESCE($10, media_poster_url),
        bg_color = COALESCE($11, bg_color),
        background = COALESCE($12, background),
        enabled = COALESCE($13, enabled),
        position = COALESCE($14, position)
       WHERE id = $1
       RETURNING *`,
      [id, title, title_mobile, body, body_mobile, cta_label, cta_label_mobile, cta_url, media_type, media_poster_url, bg_color, background, enabled, position]
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
