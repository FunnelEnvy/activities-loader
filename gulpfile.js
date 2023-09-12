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

const fileWrap = (content, activity) => {
	return `
		(function() {
			const feProjectId = 'fe_activity_${activity}';
			try {
				${content}
			} catch(err) {
				console.error('ERROR:', err);
			}
		}())
	`;
}

const fileWrapResusable = (content) => {
	return `
		${content}
		(function() {
			if (window.location.href.indexOf('itgh.buy.hpe.com') >= 0) return;

			${fs.readFileSync(path.resolve(__dirname, 'load-activities.js'), 'utf8')}

			window.${process.env.REUSABLE_FN}.getActivities = getActivities;
			window.${process.env.REUSABLE_FN}.getActivityById = getActivityById;
			window.${process.env.REUSABLE_FN}.getSelectorsDictionaryById = getSelectorsDictionaryById;
			window.${process.env.REUSABLE_FN}.getSites = getSites;
			window.${process.env.REUSABLE_FN}.getCookie = getCookie;
			window.${process.env.REUSABLE_FN}.setCookie = setCookie;

			var whenLibLoaded = function (todoWhenLoaded) {
				var waitFor = setInterval(
					function () {
						if (typeof window.jQuery != 'undefined') {
							if (typeof window.${process.env.REUSABLE_FN} != 'undefined' ) {
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
				setSites(${JSON.stringify(activitiesJSON.sites)});
				setActivities(${JSON.stringify(activitiesJSON.activities)});
				var acts = detectActivitiesToActivate();
				var env = detectTypeOfEnvironment();
				var salt = salt(60 * 2);
				acts.map(function(activity) {
					attachJsFile('${process.env.AWS_S3_BUCKET}'+'/fe_activity_'+activity.activity+(env === "PROD" ? '.min' : '')+'.js');
				});
			}

			whenLibLoaded(loadActivities);
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
	return src(activitiesJSON.reusable.map(file => path.join(scriptsPath, file)), { allowEmpty: true })
		.pipe(concat(`fe_dev.ts`))
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

task('activities', (cb) => {
	activitiesJSON.activities.filter(a => a.enable === true).map(activity => {
		const filterJS = filter(['**/*.ts', '**/*.js'], { restore: true });
		const filterCSS = filter(['**/*.css'], { restore: true });
		const scripts = (activity?.scripts ?? []).map(file => path.join(scriptsPath, activity.activity, file));
		const styles = (activity?.styles ?? []).map(file => path.join(scriptsPath, activity.activity, file));
		return src([].concat(scripts, styles), { allowEmpty: true })
			.pipe(filterCSS)
			.pipe(cleanCSS({}))
			.pipe(css2js({
				prefix: "var strMinifiedCss = \"",
				suffix: `\";\n
					(function() {
						${activity?.cssRestriction ? 'if(' + activity?.cssRestriction + ') {' : ''}
							if (window.${process.env.REUSABLE_FN} && window.${process.env.REUSABLE_FN}.injectCss) {
								window.${process.env.REUSABLE_FN}.injectCss(strMinifiedCss, feProjectId);
							}
						${activity?.cssRestriction ? '}' : ''}
					}());
				`,
			}))
			.pipe(filterCSS.restore)
			.pipe(filterJS)
			.pipe(concat(`fe_activity_${activity.activity}.ts`))
			.pipe(include())
				.on('error', console.log)
			.pipe(wrap({
				wrapper: function(content) {
					return fileWrap(content, activity.activity);
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
