const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');

const s3 = new AWS.S3({
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_ACCESS_KEY_ID,
});

async function UploadAllFiles() {
	console.log('upload all');
	fs.readdir(path.join(__dirname, "dist"), (err, files) =>{
		files.forEach(file => {
			const params = {
				Bucket: process.env.AWS_S3_BUCKET,
				File: file.name,
				Body: file,
			};
			s3.upload(params, function(err, data) {
				if (err) {
					throw err;
				}
				console.log(`File uploaded successfully. ${data.Location}`);
			});
		});
	});
}

async function UploadProdFiles() {
	console.log('upload prod');
	fs.readdir(path.join(__dirname, "dist"), (err, files) =>{
		files.forEach(file => {
			if (file.name.endsWith('.min.js')) {
				const params = {
					Bucket: process.env.AWS_S3_BUCKET,
					File: file.name,
					Body: file,
				};
				s3.upload(params, function(err, data) {
					if (err) {
						throw err;
					}
					console.log(`File uploaded successfully. ${data.Location}`);
				});
			}
		});
	});
}

async function UploadDevFiles() {
	console.log('upload dev');
	fs.readdir(path.join(__dirname, "dist"), (err, files) =>{
		files.forEach(file => {
			if (file.name.endsWith('.min.js')) return
			const params = {
				Bucket: process.env.AWS_S3_BUCKET,
				File: file.name,
				Body: file,
			};
			s3.upload(params, function(err, data) {
				if (err) {
					throw err;
				}
				console.log(`File uploaded successfully. ${data.Location}`);
			});
		});
	});
}

module.exports = {
	UploadAllFiles,
	UploadDevFiles,
	UploadProdFiles,
};
