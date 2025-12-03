const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Artwork = require('../models/artwork');
const auth = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const Joi = require('joi');

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const uploadPath = path.join(__dirname, '..', UPLOAD_DIR);
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '-').toLowerCase();
    const unique = Date.now();
    cb(null, `${base}-${unique}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Only images are allowed (jpeg,png,gif)'));
  }
});

// Validation schema
const artworkSchema = Joi.object({
  title: Joi.string().min(2).required(),
  artist: Joi.string().allow('', null),
  year: Joi.string().allow('', null),
  description: Joi.string().allow('', null)
});

// CREATE artwork (protected)
router.post('/', auth, upload.single('image'), validateBody(artworkSchema), async (req, res, next) => {
  try {
    const data = req.body;
    if (req.file) {
      data.imageUrl = `/${UPLOAD_DIR}/${req.file.filename}`;
    }
    data.createdBy = req.user._id;
    const artwork = new Artwork(data);
    await artwork.save();
    res.status(201).json(artwork);
  } catch (err) {
    next(err);
  }
});

// READ all with optional pagination & search
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, q } = req.query;
    const query = {};
    if (q) query.$or = [
      { title: { $regex: q, $options: 'i' } },
      { artist: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } }
    ];
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Artwork.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Artwork.countDocuments(query)
    ]);
    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
});

// READ one
router.get('/:id', async (req, res, next) => {
  try {
    const art = await Artwork.findById(req.params.id).populate('createdBy', 'name email');
    if (!art) return res.status(404).json({ error: 'Artwork not found' });
    res.json(art);
  } catch (err) {
    next(err);
  }
});

// UPDATE (protected, only creator can update)
router.put('/:id', auth, upload.single('image'), validateBody(artworkSchema), async (req, res, next) => {
  try {
    const art = await Artwork.findById(req.params.id);
    if (!art) return res.status(404).json({ error: 'Artwork not found' });
    if (String(art.createdBy) !== String(req.user._id)) return res.status(403).json({ error: 'Forbidden' });

    // If new file uploaded, delete old (optional)
    if (req.file) {
      // delete old file
      if (art.imageUrl) {
        const oldPath = path.join(__dirname, '..', art.imageUrl);
        fs.unlink(oldPath, (e) => {});
      }
      req.body.imageUrl = `/${UPLOAD_DIR}/${req.file.filename}`;
    }

    Object.assign(art, req.body);
    await art.save();
    res.json(art);
  } catch (err) {
    next(err);
  }
});

// DELETE (protected, only creator)
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const art = await Artwork.findById(req.params.id);
    if (!art) return res.status(404).json({ error: 'Artwork not found' });
    if (String(art.createdBy) !== String(req.user._id)) return res.status(403).json({ error: 'Forbidden' });

    // delete image file
    if (art.imageUrl) {
      const imgPath = path.join(__dirname, '..', art.imageUrl);
      fs.unlink(imgPath, (err) => {});
    }

    await art.remove();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
