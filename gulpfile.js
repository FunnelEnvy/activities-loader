var fs = require('fs');
var path = require('path');
const { task, src, dest, parallel, series, /* watch */ } = require('gulp');
const babel = require('gulp-babel');
const cleanCSS = require('gulp-clean-css');
const css2js = require('gulp-css2js');
const clean = require('gulp-clean');
const concat = require('gulp-concat');
const filter = require('gulp-filter');
const include = require('gulp-include');
const minify = require('gulp-minify');
const rename = require('gulp-rename');
const wrap = require('gulp-wrap-file');

var scriptsPath = 'src/activities';

const fileWrap = (content, file) => {
	return `
		(function() {
			try {
				const feProjectId = '${file.modName.split('/').pop()}';
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

const reusable = () => {
	return src('./src/index.ts')
		.pipe(rename(path => {
			path.basename = 'feReusableFnB2B';
		}))
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

function getFolders(dir) {
	return fs.readdirSync(dir)
		.filter(function(file) {
			return fs.statSync(path.join(dir, file)).isDirectory();
		});
}

task('activities', (cb) => {
	var folders = getFolders(scriptsPath);

	var tasks = folders.map(folder => {
		const filterJS = filter(['**/*.ts', '**/*.js'], { restore: true });
		const filterCSS = filter(['**/*.css'], { restore: true });
		const basePath = path.join(scriptsPath, folder);
		return src([
			basePath + '/*.ts',
			basePath + '/*.js',
			basePath + '/*.css',
		])
			.pipe(filterCSS)
			.pipe(cleanCSS({}))
			.pipe(css2js({
				prefix: "var strMinifiedCss = \"",
        suffix: "\";\n",
			}))
			.pipe(filterCSS.restore)
			.pipe(filterJS)
			.pipe(concat('fe_activities_' + folder + '.ts'))
			.pipe(include())
				.on('error', console.log)
			.pipe(wrap({
				wrapper: function(content, file) {
					return fileWrap(content, file);
				},
			}))
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
			.pipe(filterJS.restore)
			.pipe(dest('./dist'));
	});

	// return parallel(tasks);
	cb();
});
const activities = task('activities');

exports.default = series(clear, parallel(reusable, activities));
