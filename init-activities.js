import process.env.REUSABLE_LIB;

const bucketPath = 'https://fe-hpe-script.s3.us-east-2.amazonaws.com'
const COOKIE_NAME = 'fe_altloader';
const ENV_QUERY_PARAMETER = 'FE_LOADER';
const VARIATIONS_QUERY_PARAMETER = 'FE_VARIANT';

if (window.location.href.indexOf('itgh.buy.hpe.com') >= 0) throw new Error('This is not the right site for this code');

const environments = process.env.ENVIRONMENTS;
const activities = process.env.ACTIVITIES;
const audiences = process.env.AUDIENCES;
const sites = process.env.SITES;
const locations = process.env.LOCATIONS;

if (window && typeof window.FE_LOADER_v2 === 'undefined') {
	window.FE_LOADER_v2 = [];
}

function getActivities() {
	let acts = [];
	Object.keys(activities).forEach(group => {
		acts = [...acts, ...activities[group].map(activity => ({ ...activity, group })) ];
	});
	return acts;
}

function getSites() {
	return sites;
}

function getAudiences() {
	return audiences;
}

function getLocations() {
	return locations;
}

function getCookie(name) {
	const nameEQ = name + '=';
	let ca = document.cookie.split(';');
	ca = ca
		.filter(function (c) {
			while (c.charAt(0) === ' ')
				c = c.substring(1, c.length);
			return (c.indexOf(nameEQ) === 0);
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

function getJSONFromCookie(cookieName) {
	const cookies = document.cookie.split(';');

	for (let cookie of cookies) {
		const [name, value] = cookie.trim().split('=');
		if (name === cookieName) {
			try {
				const decoded = decodeURIComponent(value);
				return JSON.parse(decoded);
			} catch (err) {
				console.error('Failed to parse cookie JSON:', err);
				return null;
			}
		}
	}

	return null; // Not found
}

function setJSONCookie(name, data, days = 365 /* default to 1 year */) {
	const json = JSON.stringify(data);
	const encoded = encodeURIComponent(json);

	// let expires = '';
	// if (days) {
	// 	const date = new Date();
	// 	date.setTime(date.getTime() + (days * 86400 * 1000));
	// 	expires = `; expires=${date.toUTCString()}`;
	// }

	document.cookie = `${name}=${encoded}`;
}

function detectAudiences(userAudience, activityAudiences) {
	// Fetch the audiences using the getAudiences function
	const audiences = getAudiences();

	// Loop through each activityAudience to check if the user is in any audience
	for (let audience of activityAudiences) {
		if (typeof audience === "string") {
			const audienceEntry = audiences[audience];
			if (audienceEntry && evaluateAudience(userAudience, audienceEntry)) {
				return true; // User is in one of the audiences
			}
		} else if (typeof audience === "object") {
			if (evaluateAudience(userAudience, audience)) {
				return true; // User is custom defined audience
			}
		}
	}

	// If no matching audience is found, return false
	return false;
}

function evaluateAudience(userAudience, audienceEntry) {
	// Extract first 10 digits of userAudience for org_party matching
	const userAudienceOrg = userAudience.slice(0, 10);

	const {
		account_unit_id_include = [],
		account_unit_id_exclude = [],
		org_party_id_include = [],
		org_party_id_exclude = []
	} = audienceEntry;

	// If there are no restrictions defined, include the audience by default.
	if (
		account_unit_id_include.length === 0 &&
		account_unit_id_exclude.length === 0 &&
		org_party_id_include.length === 0 &&
		org_party_id_exclude.length === 0
	) {
		return true;
	}

	let accountUnitMatch = false;
	let orgPartyMatch = false;

	// Check account_unit conditions (exact match)
	if (account_unit_id_include.length > 0) {
		accountUnitMatch = account_unit_id_include.some(user => user.trim() === userAudience.trim());
	}
	if (account_unit_id_exclude.length > 0) {
		accountUnitMatch = !account_unit_id_exclude.some(user => user.trim() === userAudience.trim());
	}
	if (org_party_id_include.length > 0) {
		orgPartyMatch = org_party_id_include.some(org => org.trim().startsWith(userAudienceOrg.trim()));
	}
	if (org_party_id_exclude.length > 0) {
		orgPartyMatch = !org_party_id_exclude.some(org => org.trim().startsWith(userAudienceOrg.trim()));
	}

	// User must meet either account_unit or org_party_id conditions to be included
	return accountUnitMatch || orgPartyMatch;
}

function detectConfiguratorCustomerAudience(userAudience, activityAudiences) {
	// Fetch the audiences using the getAudiences function
	const audiences = getAudiences();

	// Extract first 10 digits of userAudience for org_party matching
	const userAudienceOrg = userAudience.slice(0, 10);

	// Helper function to check inclusion/exclusion for a specific audience entry
	const isInAudience = (audienceEntry) => {
		const {
			account_unit_id_include = [],
			account_unit_id_exclude = [],
			org_party_id_include = [],
			org_party_id_exclude = []
		} = audienceEntry;

		let accountUnitMatch = false;
		let orgPartyMatch = false;

		// Check account_unit conditions (exact match)
		if (account_unit_id_include.length > 0) {
			accountUnitMatch = account_unit_id_include.some(user => user.trim().startsWith(userAudience.trim()));
		}
		if (account_unit_id_exclude.length > 0) {
			accountUnitMatch = !account_unit_id_exclude.some(user => user.trim().startsWith(userAudience.trim()));
		}
		// Check org_party_id conditions (first 10 digits)
		if (org_party_id_include.length > 0) {
			orgPartyMatch = org_party_id_include.some(org => org.trim().startsWith(userAudienceOrg.trim()));
		}
		if (org_party_id_exclude.length > 0) {
			orgPartyMatch = !org_party_id_exclude.some(org => org.trim().startsWith(userAudienceOrg.trim()));
		}

		// User must meet either account_unit or org_party_id conditions to be included
		return accountUnitMatch || orgPartyMatch;
	};

	// Loop through each activityAudience to check if the user is in any audience
	for (let audienceKey of activityAudiences) {
		const audienceEntry = audiences[audienceKey];
		if (audienceEntry && isInAudience(audienceEntry)) {
			return true; // User is in one of the audiences
		}
	}

	// If no matching audience is found, return false
	return false;
}

function detectSites() {
	return sites
		.filter(function (site) {
			let out = true;
			if (typeof site.url_has === 'undefined') site.url_has = [];
			if (typeof site.url_has === 'string') site.url_has = [site.url_has];
			if (typeof site.url_missing === 'undefined') site.url_missing = [];
			if (typeof site.url_missing === 'string') site.url_missing = [site.url_missing];
			if (typeof site.url_matches === 'undefined') site.url_matches = [];
			if (typeof site.url_matches === 'string') site.url_matches = [site.url_matches];
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
		});
}

function detectTypeOfSite() {
	let out = sites
		.filter(function (site) {
			let out = true;
			if (typeof site.url_has === 'undefined') site.url_has = [];
			if (typeof site.url_has === 'string') site.url_has = [site.url_has];
			if (typeof site.url_missing === 'undefined') site.url_missing = [];
			if (typeof site.url_missing === 'string') site.url_missing = [site.url_missing];
			if (typeof site.url_matches === 'undefined') site.url_matches = [];
			if (typeof site.url_matches === 'string') site.url_matches = [site.url_matches];
			site.url_has.map(url => {
				if (window.location.href.indexOf(url) < 0) out = false;
			})
			site.url_missing.map(url => {
				if (window.location.href.indexOf(url) >= 0) out = false;
			})
			if(out && site.url_matches.length > 0) {
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

function evaluateCondition(condition) {
	const url = window.location.href;
	const { operator, value, conditions } = condition;

	switch (operator) {
		case 'AND':
			return conditions.every(cond => evaluateCondition(cond));
		case 'OR':
			return conditions.some(cond => evaluateCondition(cond));
		case 'matches regex':
			const regex = new RegExp(value);
			return regex.test(url);
		case 'path matches regex':
			const pathRegex = new RegExp(value);
			return pathRegex.test(window.location.pathname);
		case 'does not match regex':
			return !new RegExp(value).test(url);
		case 'starts with':
			return url.startsWith(value);
		case 'does not start with':
			return !url.startsWith(value);
		case 'ends with':
			return url.endsWith(value);
		case 'does not end with':
			return !url.endsWith(value);
		case 'matches exactly':
			return url === value;
		case 'does not match exactly':
			return url !== value;
		case 'contains':
			return url.includes(value);
		case 'does not contain':
			return !url.includes(value);
		case 'contains one of':
			return value.some(val => url.includes(val));
		case 'does not contain one of':
			return !value.some(val => url.includes(val));
		case 'contains all of':
			return value.every(val => url.includes(val));
		case 'does not contain any of':
			return !value.every(val => url.includes(val));
		default:
			return false;
	}
}

function detectLocation() {
	return locations.filter(({ conditions }) => evaluateCondition(conditions)).map(location => location.name);
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
	const locations = detectLocation();
	const sites = detectSites();
	const env = detectTypeOfEnvironment();
	return getActivities()
		.filter(activity => activity?.enable === true) // by enable
		.filter(activity => activity.env.some(e => e === env)) // by env
		.filter(activity => { // by sites
			if (!activity.hasOwnProperty("sites")) return true;
			const siteNames = sites.map(site => site.name);
			return activity.sites.some(s => siteNames.indexOf(s) > -1);
		})
		.filter(activity => { // by locations
			if (!activity.hasOwnProperty("locations")) return true;
			if (activity.locations.hasOwnProperty('operator') && activity.locations.hasOwnProperty('locations')) {
				if (activity.locations.operator === 'OR') {
					return activity.locations.locations.some(location => locations.includes(location));
				} else {
					return activity.locations.locations.every(location => locations.includes(location));
				}
			} else {
				return activity.locations.some(l => locations.indexOf(l) > -1);
			}
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
			if (typeof activity.url_missing === 'string') activity.url_missing = [activity.url_missing]
			const matches = activity.url_missing.filter(
				function (urlFragment) {
					return (window.location.href.indexOf(urlFragment) >= 0);
				});
			return matches.length === 0; // if you found one, then 1<>0
		})
		.filter(activity => { // by url_matches
			if (!activity.url_matches || activity.url_matches.length < 1) return true;
			if (typeof activity.url_matches === 'string') activity.url_matches = [activity.url_matches]
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
	const activityName = activity.activity;
	const variations = activity.variants;
	const cookieValue = getJSONFromCookie(COOKIE_NAME) || { variations: {} };
	const cookieVariations = cookieValue.variations || {};

	// --- Helper: Weighted random selection ---
	function selectVariation() {
		// Calculate total weight first
		let totalWeight = 0;
		for (const key in variations) {
			totalWeight += variations[key].weight;
		}

		// Generate random number in range [0, totalWeight)
		let rand = Math.random() * totalWeight;
		let sum = 0;

		for (const key in variations) {
			sum += variations[key].weight;
			if (rand <= sum) {
				return key;
			}
		}

		// Fallback: return the last key if somehow we get here
		return Object.keys(variations)[Object.keys(variations).length - 1];
	}

	// --- Helper: Load JS file for variant ---
	function loadVariantScript(activity, variantKey) {
		const basePath = `${bucketPath}/${activity.group.toLowerCase()}/v2`;
		const env = detectTypeOfEnvironment();
		const filename = `fe_activity_${activity.activity}_${variantKey}${env === 'PROD' ? '.min' : ''}.js`;
		attachJsFile(`${basePath}/${filename}`);
	}

	// --- Helper: Query Param FE_VARIANT parser ---
	function getQueryParamVariantOverride() {
		const match = window.location.href.match(/[?&]FE_VARIANT=([^&#]+)/);
		if (!match) return null;

		const rawParam = decodeURIComponent(match[1]);
		const pairs = rawParam.split('.');
		const result = {};

		pairs.forEach(pair => {
			const [act, variant] = pair.split(':');
			if (act && variant) result[act] = variant;
		});

		return result;
	}

	function setClarityTags(experiment, variant) {
		try {
			window.feUtils.waitForConditions({
				conditions: [
					() => typeof window.clarity === 'function',
				],
				activity: 'fe_altloader',
				callback: () => {
					window.clarity('set', 'experiment_id', experiment);
					window.clarity('set', 'variant_id', variant);
				},
			});
		} catch(err) {}
	}

	function setTrackMetricsLink(experiment, variant) {
		try {
			window.feUtils.waitForConditions({
				conditions: [
					() => typeof window.trackMetrics === 'function',
				],
				activity: 'fe_altloader',
				callback: () => {
					window.trackMetrics('new.link', { link_name: `mp:fe-experiment:${experiment}:${variant}` });
				},
			});
		} catch(err) {}
	}

	// --- 1. Handle FE_VARIANT override ---
	const variantOverride = getQueryParamVariantOverride();
	const overrideVariant = variantOverride?.[activityName];

	if (overrideVariant && variations?.[overrideVariant]) {
		// set cookie to value used in override
		cookieVariations[activityName] = overrideVariant;
		setJSONCookie(COOKIE_NAME, { ...cookieValue, variations: cookieVariations });
		setClarityTags(activityName, overrideVariant);
		setTrackMetricsLink(activityName, overrideVariant);
		// Load overridden variant without modifying cookie
		loadVariantScript(activity, overrideVariant, env);
		return;
	}

	// --- 2. Normal flow using cookie or selection ---
	let selectedVariation = cookieVariations?.[activityName];

	if (!selectedVariation || !variations?.[selectedVariation]) {
		selectedVariation = selectVariation(variations);
		cookieVariations[activityName] = selectedVariation;
		setJSONCookie(COOKIE_NAME, { ...cookieValue, variations: cookieVariations });
	}

	setClarityTags(activityName, selectedVariation);
	setTrackMetricsLink(activityName, selectedVariation);
	loadVariantScript(activity, selectedVariation);
}

window.FeActivityLoader = window.FeActivityLoader || {};
window.FeActivityLoader.getActivities = getActivities;
window.FeActivityLoader.getAudiences = getAudiences;
window.FeActivityLoader.getSites = getSites;
window.FeActivityLoader.detectSites = detectSites;
window.FeActivityLoader.getLocations = getLocations;
window.FeActivityLoader.detectLocation = detectLocation;
window.FeActivityLoader.detectTypeOfSite = detectTypeOfSite;
window.FeActivityLoader.detectTypeOfEnvironment = detectTypeOfEnvironment;
window.FeActivityLoader.detectActivitiesToActivate = detectActivitiesToActivate;

const getCustomerPartyIDFromURL = (url) => {
	const configuratorUrl = url ? url : window.location.href;
	const queryString = configuratorUrl.split('?')[1];
	const searchParams = new URLSearchParams(queryString);

	if (searchParams.has('OptimusParameters')) {
		const optimusParameters = JSON.parse(decodeURIComponent(searchParams.get('OptimusParameters')));
		return optimusParameters.customerPartyID || null;
	}

	if (searchParams.has('customerPartyID')) {
		return searchParams.get('customerPartyID');
	}
	return null;
}

const env = detectTypeOfEnvironment();
const loadActivityOrVariation = (activity) => {
	const path = `${bucketPath}/${activity.group.toLowerCase()}/v2`;
	if (activity.variants) {
		loadVariation(activity);
	} else {
		attachJsFile(path + '/fe_activity_' + activity.activity + (env === "PROD" ? '.min' : '')+'.js');
	}
}

const loadActivities = () => {
	const acts = detectActivitiesToActivate();
	const sites = detectSites().map(s => s.name).join();
	const activitiesWithAudience = acts.filter(a => a.audiences && a.audiences.length > 0);
	const activitiesWithoutAudience = acts.filter(a => !a.hasOwnProperty('audiences') || a.audiences.length === 0);

	// Add these activities right away
	activitiesWithoutAudience.forEach(activity => {
		loadActivityOrVariation(activity);
	});
	// add activities to page after checking URL for audience
	if (sites.indexOf('CONFIGURATOR') > -1) {
		activitiesWithAudience.forEach(activity => {
			if (detectConfiguratorCustomerAudience(getCustomerPartyIDFromURL(), activity.audiences)) {
				loadActivityOrVariation(activity);
			}
		});
	} else {
		// first wait for headerData information, then load activities based on audience
		const loadAudienceActivities = () => {
			activitiesWithAudience.forEach(activity => {
				if (detectAudiences(window?.headerData?.user?.account_id, activity.audiences)) {
					loadActivityOrVariation(activity);
				}
			});
		};
		window.feUtils.waitForConditions({
			conditions: ['body', () => typeof window?.headerData?.user?.account_id === 'string'],
			activity: 'fe_altloader',
			callback: loadAudienceActivities
		});
	}
}

loadActivities();
