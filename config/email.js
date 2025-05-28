const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: true
    },
    secure: true
});

transporter.verify(function(error, success) {
    if (error) {
        // ... existing code ...
    } else {
        // ... existing code ...
    }
});

module.exports = transporter; 