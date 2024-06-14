import fs from 'fs';
import path from 'path';
import babel from 'gulp-babel';
import cleanCSS from 'gulp-clean-css';
import css2js from 'gulp-css2js';
import clean from 'gulp-clean';
import concat from 'gulp-concat';
import filter from 'gulp-filter';
import include from 'gulp-include';
import rename from 'gulp-rename';
import terser from 'gulp-terser';
import wrap from 'gulp-wrap-file';
import replace from 'gulp-replace';
import gulp from 'gulp';
const { task, src, dest, series } = gulp;

import activitiesJSON from './src/activities.json' assert { type: "json" };
var scriptsPath = 'src/activities';

const fileWrap = (content, file) => {
	return `
		(function() {
			const feProjectId = '${file.modName.split('/').pop()}';
			try {
				${content}
			} catch(err) {
				console.error('ERROR:', err);
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

task('activities', (cb) => {
	activitiesJSON.activities.filter(a => a.enable === true).map(activity => {
		const filterJS = filter(["**/*.js", "**/*.ts"], { restore: true });
		const filterCSS = filter(["**/*.css"], { restore: true });
		const scripts = (activity?.scripts ?? []).map(file => path.join(scriptsPath, activity.activity, file));
		const styles = (activity?.styles ?? []).map(file => path.join(scriptsPath, activity.activity, file));
		let activityConfig = {};
		const activityConfigPath = `./src/activities/${activity.activity}/activity_config.json`;
		try {
			activityConfig = JSON.parse(fs.readFileSync(activityConfigPath, 'utf8'));
		} catch (err) {}
		const config = Object.keys(activityConfig).reduce((accum, curr) => {
			accum[`process.env.${curr.toUpperCase()}`] = activityConfig[curr]
			return accum;
		}, {});
		let stream = src([].concat(scripts, styles), { allowEmpty: true })
			.pipe(filterCSS)
			.pipe(concat('all.css'))
			.pipe(cleanCSS({}))
			.pipe(css2js({
				prefix: "var strMinifiedCss = \"",
				suffix: `\";\n
					const addCss = () => {
						if (window.${process.env.REUSABLE_FN} && window.${process.env.REUSABLE_FN}.injectCss) {
							${activity?.cssRestriction ? "if(" + activity.cssRestriction + ") {" : ""}
							window.${process.env.REUSABLE_FN}.injectCss(strMinifiedCss, feProjectId);
							${activity?.cssRestriction ? "}" : ""}
						}
					};
					${activity?.cssRestriction ? 'window.' + process.env.REUSABLE_FN + '.waitForAudience(addCss);' : 'addCss()'}
				`,
			}))
			.pipe(filterCSS.restore)
			.pipe(filterJS)
			.pipe(concat('fe_activity_' + activity.activity + '.ts'))
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
			}));

		Object.keys(config).forEach(key => {
			stream = stream.pipe(replace(key, JSON.stringify(config[key])));
		});

		return stream
			.pipe(filterJS.restore)
			.pipe(dest('./dist'))
			.pipe(rename({ suffix: '.min' }))
			.pipe(terser())
			.pipe(dest('./dist'));
	});

	cb();
});

const activities = task('activities');

export default series(clear, activities);

