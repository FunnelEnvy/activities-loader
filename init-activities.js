import process.env.REUSABLE_LIB;

if (window.location.href.indexOf('itgh.buy.hpe.com') >= 0) throw new Error('This is not the right site for this code');

const environments = process.env.ENVIRONMENTS;
const activities = process.env.ACTIVITIES;
const sites = process.env.SITES;

if (window && typeof window.FE_LOADER_v2 === 'undefined') {
	window.FE_LOADER_v2 = [];
}

function getActivities() {
	return activities;
}

function getSites() {
	return sites;
}

function getCookie(name) {
	const nameEQ = name + '=';
	let ca = document.cookie.split(';');
	ca = ca
		.filter(function (c) {
			while (c.charAt(0) == ' ')
				c = c.substring(1, c.length);
			return (c.indexOf(nameEQ) == 0);
		})
		.map(function (c) {
			if (c) {
				c = c.trim();
				const pos = c.indexOf("=")
				return c.substring(pos + 1, c.length)
				//return c.substring(nameEQ.length, c.length)
			}
			return '';
		})
		.sort(function (a, b) {
			return a.length < b.length ? 1 : -1
		}).shift();
	return ca ? ca : null;
}

function setCookie(name, value, days) {
	let expires = '';
	if (days) {
		const date = new Date();
		date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
		expires = '; expires=' + date.toUTCString();
	}
	document.cookie = name + '=' + (value || '') + expires + '; path=/';
}

function detectTypeOfSite() {
	let out = sites
		.filter(function (site) {
			let out = true;
			if (typeof site.url_has == 'undefined') site.url_has = [];
			if (typeof site.url_has == 'string') site.url_has = [site.url_has];
			if (typeof site.url_missing == 'undefined') site.url_missing = [];
			if (typeof site.url_missing == 'string') site.url_missing = [site.url_missing];
			if (typeof site.url_matches == 'undefined') site.url_matches = [];
			if (typeof site.url_matches == 'string') site.url_matches = [site.url_matches];
			site.url_has.map(url => {
				if (window.location.href.indexOf(url) < 0) out = false;
			})
			site.url_missing.map(url => {
				if (window.location.href.indexOf(url) >= 0) out = false;
			})
			if (out && site.url_matches.length > 0) {
				out = site.url_matches.some(regexString => {
					const regexPattern = new RegExp(regexString);
					return regexPattern.test(window.location.pathname);
				})
			}
			return out;
		})
		.shift();
	return out ? out.name : '';
}

function detectTypeOfEnvironment() {
	//use cookies first
	const envs = ['DEV', 'QA', 'PROD'];
	const cookieName = 'fe-alt-load-env';
	const cooked = getCookie(cookieName)
	if (window.location.href.indexOf('FE_LOADER=DEV_COOKIE') > 0) {
		setCookie(cookieName, 'DEV', 1);
		return "DEV";
	} else if (window.location.href.indexOf('FE_LOADER=QA_COOKIE') > 0) {
		setCookie(cookieName, 'QA', 1);
		return "QA";
	} else if (window.location.href.indexOf('FE_LOADER=PROD') > 0) {
		setCookie(cookieName, '', 1);
		return "PROD";
	} else if (window.location.href.indexOf('FE_LOADER=') > 0) {
		setCookie(cookieName, '', 1)
	}
	if (cooked && cooked.length > 1 && envs.indexOf(cooked) >= 0) {
		return cooked;//whatever saved in cookie
	}

	//otherwise try normal way
	const urlFlagsDev = environments.DEV.urlFlags;
	let isDev = false;
	const urlFlagsQa = environments.QA.urlFlags;
	let isQa = false;

	urlFlagsDev.map(function (uf) {
		if (window.location.href.indexOf(uf) >= 0)
			isDev = true;
	});
	if (isDev) return 'DEV';

	urlFlagsQa.map(function (uf) {
		if (window.location.href.indexOf(uf) >= 0)
			isQa = true;
	});
	if (isQa) return 'QA';

	return "PROD";
}

function detectActivitiesToActivate() {
	const site = detectTypeOfSite();
	const env = detectTypeOfEnvironment();
	return activities
		.filter(activity => { // by env
			if (!activity.enable) return false;
			let out = false;
			if (!activity.env) return false;
			activity.env.map(function (actEnv) {
				out = out || actEnv == env;
			})
			return out;
		})
		.filter(activity => { // by site
			let out = false;
			if (!activity.sites) return false;
			activity.sites.map(function (actSite) {
				out = out || actSite == site;
			})
			return out;
		})
		.filter(activity => { // by url_has
			if (!activity.url_has || activity.url_has.length < 1) return true;
			const matches = activity.url_has.filter(
				function (urlFragment) {
					return (window.location.href.indexOf(urlFragment) >= 0);
				});
			return matches.length > 0;
		})
		.filter(activity => { // by url_missing
			if (!activity.url_missing || activity.url_missing.length < 1) return true;
			if (typeof activity.url_missing == 'string') activity.url_missing = [activity.url_missing]
			const matches = activity.url_missing.filter(
				function (urlFragment) {
					return (window.location.href.indexOf(urlFragment) >= 0);
				});
			return matches.length === 0; // if you found one, then 1<>0
		})
		.filter(activity => { // by url_matches
			if (!activity.url_matches || activity.url_matches.length < 1) return true;
			if (typeof activity.url_matches == 'string') activity.url_matches = [activity.url_matches]
			const matches = activity.url_matches.filter(regexString => {
				const regexPattern = new RegExp(regexString);
				return regexPattern.test(window.location.pathname);
			});
			return matches.length > 0;
		});
}

function salt(ttlSeconds) {
	ttlSeconds = ttlSeconds ? ttlSeconds : 60;
	return Math.round(Date.now() / ttlSeconds / 1000) + '';
}

function attachJsFile(src) {
	if (window.FE_LOADER_v2 && window.FE_LOADER_v2.indexOf(src) >= 0) return;
	window.FE_LOADER_v2.push(src)
	const s = salt(60 * 5);
	const rc = document.getElementsByTagName('head')[0];
	const sc = document.createElement('script');
	sc.src = src + "?_t=" + s;
	if (rc)
		rc.appendChild(sc);
}

function loadVariation(activity) {
	// Determine which variation to load
	const cookieName = activity.activity;
	let selectedVariation = getCookie(cookieName);

	// Variations object
	const variations = activity.variants;

	// Function to select a variation based on configured weights
	function selectVariation() {
		let rand = Math.random();
		let sum = 0;

		for (const key in variations) {
			sum += variations[key].weight;
			if (rand <= sum) {
				return key;
			}
		}
		return Object.keys(variations)[0]; // In case there is a rounding error in the weights return first variant
	}

	if (!selectedVariation) {
		selectedVariation = selectVariation();
		// Set the cookie with the selected variation
		setCookie(cookieName, selectedVariation, 7); // expires in 7 days
	}

	console.log('selectedVariation: ', selectedVariation)
	console.log('path: ', `/fe_activity_${activity.activity}_${selectedVariation}${detectTypeOfEnvironment() === "PROD" ? '.min' : ''}.js`)

	// Load the selected variation script
	const bucketPath = process.env.AWS_S3_BUCKET + '/fe_activity_';
	//attachJsFile(bucketPath + activity.activity + selectedVariation + (detectTypeOfEnvironment() === "PROD" ? '.min' : '') + '.js');
	attachJsFile(`${bucketPath}${activity.activity}_${selectedVariation}${detectTypeOfEnvironment() === "PROD" ? '.min' : ''}.js`);
}

window.FeActivityLoader = window.FeActivityLoader || {};
window.FeActivityLoader.getActivities = getActivities;
window.FeActivityLoader.getSites = getSites;
window.FeActivityLoader.detectTypeOfSite = detectTypeOfSite;
window.FeActivityLoader.detectTypeOfEnvironment = detectTypeOfEnvironment;
window.FeActivityLoader.detectActivitiesToActivate = detectActivitiesToActivate;

const whenLibLoaded = function (todoWhenLoaded) {
	const waitFor = setInterval(
		function () {
			if (typeof window.jQuery != 'undefined') {
				clearInterval(waitFor);
				todoWhenLoaded();
			}
		}, 500);
	setTimeout(function () {
		clearInterval(waitFor);
	}, 10000);
}

const loadActivities = () => {
	const acts = detectActivitiesToActivate();
	const env = detectTypeOfEnvironment();

	acts.map(function (activity) {
		if (activity.variants) {
			loadVariation(activity);
		} else {
			attachJsFile(process.env.AWS_S3_BUCKET + '/fe_activity_' + activity.activity + (env === "PROD" ? '.min' : '')+'.js');
		}
	});
}

whenLibLoaded(loadActivities);
