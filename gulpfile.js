import path from 'path';
import gulp from 'gulp';
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
import activitiesJSON from './src/activities.json' assert { type: "json" };

const { series, parallel, src, dest } = gulp;

const scriptsPath = 'src/activities';

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
};

// Clean the 'dist' directory
const cleanDist = () => {
  return src('./dist/*', { read: false, allowEmpty: true })
    .pipe(clean());
};

// Process activities and their variants
const processActivities = (cb) => {
  activitiesJSON.activities.forEach(activity => {
    const activityName = activity.activity;
    const variants = activity.variants;

    Object.entries(variants).forEach(([variantName, { scripts, styles, weight }]) => {
      src([].concat(scripts.map(file => path.join(scriptsPath, activityName, variantName, file)),
                styles.map(file => path.join(scriptsPath, activityName, variantName, file))))
        .pipe(concat('all.css'))
        .pipe(cleanCSS())
        .pipe(css2js({
          prefix: "var strMinifiedCss = \"",
          suffix: `\";\n
            const addCss = () => {
              if (window.${process.env.REUSABLE_FN} && window.${process.env.REUSABLE_FN}.injectCss) {
                ${activity.cssRestriction ? `if (${activity.cssRestriction}) {` : ''}
                window.${process.env.REUSABLE_FN}.injectCss(strMinifiedCss, feProjectId);
                ${activity.cssRestriction ? '}' : ''}
              }
            };
            ${activity.cssRestriction ? `window.${process.env.REUSABLE_FN}.waitForAudience(addCss);` : 'addCss();'}
          `,
        }))
        .pipe(concat(`fe_activity_${activityName}_${variantName}.ts`))
        .pipe(include().on('error', console.log))
        .pipe(wrap({ wrapper: (content, file) => fileWrap(content, file) }))
        .pipe(babel({ presets: ['@babel/env', '@babel/typescript'] }))
        .pipe(rename({ suffix: '.min' }))
        .pipe(terser())
        .pipe(dest('./dist'));
    });
  });

  cb();
};

// Define the default Gulp task
export default series(cleanDist, processActivities);
