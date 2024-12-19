// build.js

// capture command line arguments
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
const argv = yargs(hideBin(process.argv)).argv
// rollup dependencies
import * as rollup from 'rollup';
import activitiesJSON from './src/activities.json' assert { type: 'json' };
import audiencesJSON from './src/audiences.json' assert { type: 'json' };
import locationsJSON from './src/locations.json' assert { type: 'json' };
import sitesJSON from './src/sites.json' assert { type: 'json' };
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import json from '@rollup/plugin-json';
import { wrap, prepend } from 'rollup-plugin-insert';
import { cleandir } from 'rollup-plugin-cleandir';
// for building css
import fs from 'fs';
import CleanCSS from 'clean-css';

const plugins = ({ activity, styles, cssRestrictions, config }) => {
	// Read the CSS file
	const cssFilePath = (styles && styles.length > 0) ? `./src/activities/${activity}/${styles[0]}` : '';
	const cssContent = (styles && styles.length > 0) ? fs.readFileSync(cssFilePath, 'utf8') : null;

	// Minify the CSS content
	const minifiedCssContent = (styles && styles.length > 0) ? new CleanCSS().minify(cssContent).styles : '';
	return [
		json(),
		prepend(`
			${(styles && styles.length > 0) ? 'const strMinifiedCss = process.env.MINIFIED_CSS;' : ''}
			const feProjectId = process.env.FE_PROJECT_ID;
			const addCss_unique = () => {
				${cssRestrictions ? 'if (' + cssRestrictions + ') {' : ''}
					${(styles && styles.length > 0) ? 'window[process.env.REUSABLE_FN].injectCss(strMinifiedCss, feProjectId);' : ''}
				${cssRestrictions ? '}' : ''}
			};
			${cssRestrictions ? 'window[process.env.REUSABLE_FN].waitForAudience(addCss_unique);' : 'addCss_unique();'}
			const waitForConditions = (conditions, callback, onError, timeout, pollFreq) => {
				if (onError || window?.FeActivityLoader?.detectTypeOfEnvironment() !== 'PROD') {
					return window.feUtils.waitForConditions(conditions, callback, onError, timeout, pollFreq);
				}
				const loggingError = (err) => window.FeActivityLoader.loggingError(err, feProjectId);
				return window.feUtils.waitForConditions(conditions, callback, loggingError, timeout, pollFreq);
			};
		`),
		wrap(
			`try {`,
			`} catch (err) {
				console.error('Error loading activity ${activity}:', err);
			}`,
		),
		nodePolyfills(),
		resolve({
			preferBuiltins: true,
		}),
		commonjs(),
		replace({
			preventAssignment: false,
			objectGuards: true,
			values: {
				...config,
				'process.env.MINIFIED_CSS': `${JSON.stringify(minifiedCssContent)}`,
				'process.env.FE_PROJECT_ID': `"fe_activity_${activity}"`,
				'process.env.REUSABLE_FN': `"feReusable"`,
			},
		}),
		babel({
			babelHelpers: 'bundled',
			extensions: ['.js', '.ts'],
			exclude: 'node_modules/**',
			presets: [
				'@babel/typescript',
				'@babel/env',
			],
		}),
	];
};

const addingDefaultSite = (activities) => {
	let activityData = {};
	const defaultSites = {
		"B2B-Hybris": ["B2B-PROD"],
		"B2C": ["B2C-PROD"],
		"configurator": ["CONFIGURATOR"],
	}
	const keys = Object.keys(activities);
	for (const key of keys) {
		activityData[key] = activities[key].map(a => {
			if (a.sites && a.sites.length > 0) {
				return a;
			}
			return {
				...a,
				sites: defaultSites[key],
			};
		});
	}

	return activityData;
}

const { exec } = await import('child_process');

function runCommand(command, dirPath) {
	return new Promise((resolve, reject) => {
		exec(command, { cwd: dirPath }, (error, stdout, stderr) => {
			if (error) {
				reject(`Error: ${error.message}`);
				return;
			}
			if (stderr) {
				console.warn(`Stderr: ${stderr}`);
			}
			resolve(stdout);
		});
	});
}

// Loop through files and build each one
const buildActivities = async (activitiesFilter = [], activitiesGroup) => {
	let activitiesToBuild = [];
	if (activitiesFilter.length) {
		activitiesToBuild = activitiesJSON.activities[activitiesGroup].filter(activity => activitiesFilter.includes(activity.activity));
	} else {
		activitiesToBuild = activitiesJSON.activities[activitiesGroup];
	}
	for (const activity of activitiesToBuild) {
		let activityConfig = {};
		const activityConfigPath = `./src/activities/${activity.activity}/activity_config.json`;
		const packageJsonPath = `./src/activities/${activity.activity}/package.json`;
		try {
			activityConfig = JSON.parse(fs.readFileSync(activityConfigPath, 'utf8'));
		} catch (err) {}
		const config = Object.keys(activityConfig).reduce((accum, curr) => {
			accum[`process.env.${curr.toUpperCase()}`] = JSON.stringify(activityConfig[curr]);
			return accum;
		}, {});
		// check if activity has package.json
		if (fs.existsSync(packageJsonPath)) {
			console.log('package json found');
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
			if (packageJson.scripts && packageJson.scripts.dist) {
				console.log(`"dist" script found. Running "dist" script...`);
				const dirPath = `./src/activities/${activity.activity}`;
				await runCommand('npm run dist', dirPath);
			}
		}
		if (activity.variants) {
			// build variants...
			Object.entries(activity.variants).forEach(async (variant) => {
				console.log(`Building ${activity.activity}_${variant}/${activity.variants[variant].scripts[0]}...`);
				await buildFile({
					input: `src/activities/${activity.activity}/${variant}/${activity.scripts[0]}`,
					output: {
						file: `dist/fe_activity_${activity.activity}_${variant}}.js`,
						format: 'iife',
					},
					plugins: plugins({ ...activity, config }),
				});
				await buildFile({
					input: `src/activities/${activity.activity}/${variant}/${activity.scripts[0]}`,
					output: {
						file: `dist/fe_activity_${activity.activity}_${variant}}.min.js`,
						format: 'iife',
					},
					plugins: [...plugins({ ...activity, config }), terser()],
				});
			});
		} else {
			console.log(`Building ${activity.activity}/${activity.scripts[0]}...`);
			await buildFile({
				input: `src/activities/${activity.activity}/${activity.scripts[0]}`,
				output: {
					file: `dist/fe_activity_${activity.activity}.js`,
					format: 'iife',
				},
				plugins: plugins({ ...activity, config }),
			});
			await buildFile({
				input: `src/activities/${activity.activity}/${activity.scripts[0]}`,
				output: {
					file: `dist/fe_activity_${activity.activity}.min.js`,
					format: 'iife',
				},
				plugins: [...plugins({ ...activity, config }), terser()],
			});
		}
	}
}

// Function to build a single file
const buildFile = async (config) => {
	try {
		const bundle = await rollup.rollup(config);
		await bundle.write(config.output);
	} catch (error) {
		console.error('Build error:', error);
		// process.exit(1);
	}
}

// Build the library files
const buildLibFiles = async () => {
	await buildFile({
		input: './init-activities.js',
		output: {
			file: 'dist/fe_altloader.js',
			format: 'iife',
		},
		plugins: [
			json(),
			replace({
				preventAssignment: false,
				objectGuards: true,
				values: {
					'process.env.REUSABLE_LIB': `"./src/libs/index.js"`,
					'process.env.ENVIRONMENTS': JSON.stringify(activitiesJSON.environments),
					'process.env.SITES': JSON.stringify(sitesJSON),
					'process.env.ACTIVITIES': JSON.stringify(addingDefaultSite(activitiesJSON.activities)),
					'process.env.AUDIENCES': JSON.stringify(audiencesJSON),
					'process.env.LOCATIONS': JSON.stringify(locationsJSON),
					'process.env.AWS_S3_BUCKET': `"${process.env.AWS_S3_BUCKET}"`,
				},
			}),
			nodePolyfills(),
			resolve({
				preferBuiltins: true,
			}),
			commonjs(),
			babel({
				babelHelpers: 'bundled',
				extensions: ['.js', '.ts'],
				exclude: 'node_modules/**',
				presets: [
					'@babel/typescript',
					'@babel/env',
				],
			}),
			terser(),
		],
	});
}

// Run the build process
cleandir('dist');
if (argv.all) {
	buildLibFiles();
	buildActivities().catch((error) => {
		console.error('Build error:', error);
		process.exit(1);
	});
}
if (argv.lib) {
	buildLibFiles();
} else {
	console.log('activities:', argv.activities);
	buildActivities(argv.activities?.split(','), argv?.group).catch((error) => {
		console.error('Build error:', error);
		process.exit(1);
	});
}
