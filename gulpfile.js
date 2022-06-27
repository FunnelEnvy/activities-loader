const { src, dest, parallel, series, watch } = require('gulp');
const clean = require('gulp-clean');
// const concat = require('gulp-concat');
const rename = require('gulp-rename');
const minify = require('gulp-minify');
const wrap = require('gulp-wrap-file');
const babel = require('gulp-babel');
// const typescript = require('gulp-tsc');

// const tsProject = typescript.createProject('tsconfig.json');

const fileWrap = (content, file) => {
	return `
		(function() {
			try {
				const feProjectId = '${file.modName}';
				// @ts-ignore
				window.feReusableFnB2B.sendTrackEvent(feProjectId);
				${content}
			} catch(err) {
				// @ts-ignore
				window.feReusableFnB2B.sendErrorEvent();
			}
		}())
	`;
}

// Clean assets
const clear = () => {
	return src('./dist/*', {
		read: false,
	})
		.pipe(clean());
};

const ts = () => {
	return src('./src/activities/**/*.ts', './src/activities/**/*.js')
		// .pipe(concat('index.ts'))
		.pipe(rename(path => {
			path.basename = 'fe_activities_' + path.dirname;
			path.dirname = '';
			path.extname = '.ts';
		}))
		.pipe(wrap({
			wrapper: function(content, file) {
				return fileWrap(content, file);
			},
		}))
		// .pipe(typescript())
		.pipe(babel({
			presets: [
				'@babel/env',
				'@babel/typescript',
			],
		}))
		.pipe(minify({
			ext: {
				src: '.js',
				min: '.min.js',
			},
		}))
		.pipe(dest('./dist'));
};

const css = () => {
	return src();
};

exports.default = series(clear, parallel(ts /* , css */));
