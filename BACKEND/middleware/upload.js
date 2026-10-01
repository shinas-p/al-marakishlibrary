const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const uploadDirs = {
  covers: './uploads/covers',
  ebooks: './uploads/ebooks',
  users: './uploads/users',
  student_photos: './uploads/student_photos',
  branding: './uploads/branding',
  payment_proofs: './uploads/payment_proofs'
};

Object.values(uploadDirs).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Storage configuration for cover images
const coverStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirs.covers);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}_cover${ext}`;
    cb(null, filename);
  }
});

// Storage configuration for ebooks
const ebookStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirs.ebooks);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}_ebook${ext}`;
    cb(null, filename);
  }
});

// Storage configuration for user photos
const userPhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirs.users);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}_user${ext}`;
    cb(null, filename);
  }
});

// Storage configuration for student photos
const studentPhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirs.student_photos);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}_student${ext}`;
    cb(null, filename);
  }
});

// Storage configuration for payment proofs
const paymentProofStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirs.payment_proofs);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}_proof${ext}`;
    cb(null, filename);
  }
});

// Storage configuration for branding assets (logo, qr codes)
const brandingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirs.branding);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const key = req.body.key || 'asset';
    const filename = `${key}_${Date.now()}${ext}`;
    cb(null, filename);
  }
});

// File filter for images
const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp, svg)'));
};

// File filter for ebooks
const ebookFilter = (req, file, cb) => {
  const allowedTypes = /pdf|epub|mobi|txt/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype.includes('pdf') ||
    file.mimetype.includes('epub') ||
    file.mimetype.includes('text');

  if (extname || mimetype) {
    return cb(null, true);
  }
  cb(new Error('Only ebook files are allowed (pdf, epub, mobi, txt)'));
};

// Upload middleware instances
const uploadBranding = multer({
  storage: brandingStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: imageFilter
});
const uploadCover = multer({
  storage: coverStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: imageFilter
});

const uploadEbook = multer({
  storage: ebookStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: ebookFilter
});

const uploadUserPhoto = multer({
  storage: userPhotoStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: imageFilter
});

const uploadStudentPhoto = multer({
  storage: studentPhotoStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: imageFilter
});

const uploadPaymentProof = multer({
  storage: paymentProofStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: imageFilter
});

const uploadBookFiles = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (file.fieldname === 'cover_image') {
        cb(null, uploadDirs.covers);
      } else if (file.fieldname === 'ebook') {
        cb(null, uploadDirs.ebooks);
      } else {
        cb(null, uploadDirs.covers);
      }
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const prefix = file.fieldname === 'cover_image' ? 'cover' : 'ebook';
      const filename = `${Date.now()}_${prefix}${ext}`;
      cb(null, filename);
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max for ebooks
  }
}).fields([
  { name: 'cover_image', maxCount: 1 },
  { name: 'ebook', maxCount: 1 }
]);

module.exports = {
  uploadCover: uploadCover.single('cover_image'),
  uploadEbook: uploadEbook.single('ebook'),
  uploadBookFiles,
  uploadUserPhoto: uploadUserPhoto.single('profile_photo'),
  uploadStudentPhoto: uploadStudentPhoto.single('profile_photo'),
  uploadBranding: uploadBranding.single('image'),
  uploadPaymentProof: uploadPaymentProof.single('payment_proof'),
  uploadMultiple: multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const fieldname = file.fieldname;
        const dir = uploadDirs[fieldname] || uploadDirs.covers;
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `${Date.now()}_${file.fieldname}${ext}`;
        cb(null, filename);
      }
    }),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
  })
};
