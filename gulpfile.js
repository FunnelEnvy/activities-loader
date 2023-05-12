var fs = require('fs');
var path = require('path');
const { task, src, dest, parallel, series } = require('gulp');
const babel = require('gulp-babel');
const cleanCSS = require('gulp-clean-css');
const css2js = require('gulp-css2js');
const clean = require('gulp-clean');
const concat = require('gulp-concat');
const filter = require('gulp-filter');
const include = require('gulp-include');
const minify = require('gulp-minify');
const uglify = require('gulp-uglify');
const rename = require('gulp-rename');
const wrap = require('gulp-wrap-file');

// TODO: fetch activities from an API
const activitiesJSON = require('./src/activities.json');
var scriptsPath = 'src/activities';

const fileWrap = (content, file) => {
	return `
		(function() {
			const feProjectId = 'fe_activity_${file.modName.split('/').pop()}';
			try {
				// @ts-ignore
				window.feReusableFnB2B.sendTrackEvent("start-activity", { projectId: feProjectId });
				${content}
				window.feReusableFnB2B.sendTrackEvent("executed-activity", { projectId: feProjectId });
			} catch(err) {
				// @ts-ignore
				window.feReusableFnB2B.sendTrackEvent("activity-error", { projectId: feProjectId });
				console.error('ERROR:', err);
			}
		}())
	`;
}

const fileWrapResusable = (content) => {
	return `
		${content}
		(function() {
			//if (window.location.href.indexOf('//uat.buy.hpe.com/') >= 0) return;
			if (window.location.href.indexOf('itgh.buy.hpe.com') >= 0) return;
			var whenLibLoaded = function (todoWhenLoaded) {
				var waitFor = setInterval(
					function () {
						if (typeof window.jQuery != 'undefined') {
							if (typeof window.feReusableFnB2B != 'undefined' ) {
								clearInterval(waitFor);
								todoWhenLoaded();
							}
						}
					}, 500);
				setTimeout(function () {
					clearInterval(waitFor);
				}, 10000);
			}
			var loadActivities = () => {
				window.feReusableFnB2B.setSites(${JSON.stringify(activitiesJSON.sites)});
				window.feReusableFnB2B.setActivities(${JSON.stringify(activitiesJSON.activities)});
				var acts = window.feReusableFnB2B.detectActivitiesToActivate();
				var env = window.feReusableFnB2B.detectTypeOfEnvironment();
				var salt = window.feReusableFnB2B.salt(60 * 2);
				acts.map(function(activity) {
					window.feReusableFnB2B.sendTrackEvent("load-activity", { projectId: 'fe_activity_'+activity.activity });
					window.feReusableFnB2B.attachJsFile('${process.env.AWS_S3_BUCKET}'+'/fe_activity_'+activity.activity+(env === "PROD" ? '.min' : '')+'.js');
				});
			}
			whenLibLoaded( loadActivities);
		}());
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
	return src(`${scriptsPath}/${activitiesJSON.reusable}`)
		.pipe(rename(path => {
			path.basename = 'fe_dev';
		}))
		.pipe(wrap({
			wrapper: function(content) {
				return fileWrapResusable(content);
			},
		}))
		.pipe(babel({
			presets: [
				'@babel/env',
				'@babel/typescript',
			],
		}))
		.pipe(dest('./dist'))
		.pipe(rename(path => {
			path.basename = 'fe_prod';
		}))
		.pipe(uglify())
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

	folders.map(folder => {
		const filterJS = filter(['**/*.ts', '**/*.js'], { restore: true });
		const filterCSS = filter(['**/*.css'], { restore: true });
		const basePath = path.join(scriptsPath, folder);
		const activity = activitiesJSON.activities.find(a => a.activity === folder) || null;
		return src([
			basePath + '/*.ts',
			basePath + '/*.js',
			basePath + '/*.css',
		])
			.pipe(filterCSS)
			.pipe(cleanCSS({}))
			.pipe(css2js({
				prefix: "var strMinifiedCss = \"",
				suffix: `\";\n
					const addCss = () => {
						if (window.feReusableFnB2B && window.feReusableFnB2B.injectCss && window.feReusableFnB2B.sendTrackEvent) {
							${activity?.cssRestriction ? "if(" + activity.cssRestriction + ") {" : ""}
							window.feReusableFnB2B.sendTrackEvent("css-loaded", { projectId: feProjectId });
							window.feReusableFnB2B.injectCss(strMinifiedCss, feProjectId);
							${activity?.cssRestriction ? "}" : ""}
						}
					};
					${activity?.cssRestriction ? 'window.feReusableFnB2B.waitForAudience(addCss);' : 'addCss()'}
				`,
			}))
			.pipe(filterCSS.restore)
			.pipe(filterJS)
			.pipe(concat('fe_activity_' + folder + '.ts'))
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

	cb();
});

const activities = task('activities');

exports.default = series(clear, parallel(reusable, activities));
