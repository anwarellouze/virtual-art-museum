const mongoose = require('mongoose');

const ArtworkSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  artist: { type: String, trim: true },
  year: { type: String, trim: true },
  description: { type: String, trim: true },
  imageUrl: { type: String, trim: true }, // e.g. '/uploads/filename.jpg'
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  favoritesCount: { type: Number, default: 0 }
});

module.exports = mongoose.model('Artwork', ArtworkSchema);
