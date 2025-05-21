const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

transporter.verify(function(error, success) {
    if (error) {
        console.log('이메일 서버 연결 오류:', error);
    } else {
        console.log('이메일 서버 연결 성공');
    }
});

module.exports = transporter; 