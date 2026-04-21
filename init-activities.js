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

function getJSONFromMemory(name) {
	const value = getJSONFromCookie(name);
	if (value !== null) return value;
	return getJSONFromStorage(name);
}

function setJSONToMemory(name, data) {
	setJSONCookie(name, data);
	setJSONStorage(name, data);
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
	try {
		const json = JSON.stringify(data);
		const encoded = encodeURIComponent(json);

		let expires = '';
		if (days) {
			const date = new Date();
			date.setTime(date.getTime() + (days * 86400 * 1000));
			expires = `; expires=${date.toUTCString()}`;
		}

		// Set the cookie with "/" path
		document.cookie = `${name}=${encoded}${expires}; path=/`;
		console.log('set cookie with:', `${name}=${encoded}${expires}; path=/`);
		
		// Clear any page-specific cookie to avoid conflicts
		const currentPath = window.location.pathname;
		document.cookie = `${name}=; path=${currentPath}; max-age=0`;
	} catch (err) {
		console.log('error info:', err);
	}
}

function getJSONFromStorage(key) {
	try {
		const value = localStorage.getItem(key);
		if (!value) return null;
		return JSON.parse(value);
	} catch (err) {
		console.error('Failed to parse localStorage JSON:', err);
		return null;
	}
}

function setJSONStorage(key, data) {
	try {
		const json = JSON.stringify(data);
		localStorage.setItem(key, json);
	} catch (err) {
		console.error('Failed to set localStorage:', err);
	}
}

function cleanupStoredVariations() {
	const storageValue = getJSONFromMemory(COOKIE_NAME);
	if (!storageValue || !storageValue.variations) return;

	const storedVariations = storageValue.variations;
	const cleanedVariations = {};
	const activities = getActivities();

	// Build a map of valid activities with their variants
	const validActivities = {};
	activities.forEach(activity => {
		if (activity.enable === true && activity.variants) {
			validActivities[activity.activity] = Object.keys(activity.variants);
		}
	});

	// Only keep variations that still exist in valid, enabled activities
	Object.keys(storedVariations).forEach(activityName => {
		const variantKey = storedVariations[activityName];
		
		// Check if activity exists, is enabled, and variant still exists
		if (validActivities[activityName] && 
		    validActivities[activityName].includes(variantKey)) {
			cleanedVariations[activityName] = variantKey;
		}
	});

	// Update storage with cleaned variations
	setJSONToMemory(COOKIE_NAME, { ...storageValue, variations: cleanedVariations });
}

function detectAudiences(accountUnitId, activityAudiences) {
	const audiences = getAudiences();

	for (let audience of activityAudiences) {
		if (typeof audience === "string") {
			const audienceEntry = audiences[audience];
			if (audienceEntry && evaluateAudience(accountUnitId, audienceEntry)) {
				return true;
			}
		} else if (typeof audience === "object") {
			if (evaluateAudience(accountUnitId, audience)) {
				return true;
			}
		}
	}

	return false;
}

function evaluateAudience(accountUnitId, audienceEntry) {
	accountUnitId = String(accountUnitId ?? '').trim();
	const orgPartyId = accountUnitId.slice(0, 10);

	const {
		account_unit_id_include = [],
		account_unit_id_exclude = [],
		org_party_id_include = [],
		org_party_id_exclude = [],
	} = audienceEntry;

	const norm = v => String(v ?? '').trim();

	const auiInc = account_unit_id_include.map(norm);
	const auiExc = account_unit_id_exclude.map(norm);
	const opiInc = org_party_id_include.map(norm);
	const opiExc = org_party_id_exclude.map(norm);

	// No restrictions at all ⇒ include
	const noRestrictions =
		auiInc.length === 0 && auiExc.length === 0 &&
		opiInc.length === 0 && opiExc.length === 0;
	if (noRestrictions) return true;

	// Evaluate all four conditions
	const auiIncludeMatch = auiInc.length > 0 && auiInc.some(x => x === accountUnitId);
	const auiExcludeMatch = auiExc.length > 0 && auiExc.some(x => x === accountUnitId);

	const opiIncludeMatch = opiInc.length > 0 && opiInc.some(x => x.startsWith(orgPartyId));
	const opiExcludeMatch = opiExc.length > 0 && opiExc.some(x => x.startsWith(orgPartyId));

	// Exclusions always win
	if (auiExcludeMatch || opiExcludeMatch) return false;

	// If any include lists exist, must match at least one include
	const hasAnyInclude = auiInc.length > 0 || opiInc.length > 0;
	if (hasAnyInclude) return auiIncludeMatch || opiIncludeMatch;

	// No includes defined, and not excluded ⇒ include
	return true;
}

function detectConfiguratorCustomerAudience(accountUnitId, activityAudiences) {
	const audiences = getAudiences();

	for (let audience of activityAudiences) {
		if (typeof audience === "string") {
			const audienceEntry = audiences[audience];
			if (audienceEntry && evaluateAudience(accountUnitId, audienceEntry)) {
				return true;
			}
		} else if (typeof audience === "object") {
			if (evaluateAudience(accountUnitId, audience)) {
				return true;
			}
		}
	}

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
	const VALID_ENVS = ['DEV', 'QA', 'PROD'];
	const SESSION_KEY = 'fe-altloader-env';
	const sessionValue = sessionStorage.getItem(SESSION_KEY);
	const params = new URLSearchParams(window.location.search);

	if (params.has(ENV_QUERY_PARAMETER)) {
		const paramValue = params.get(ENV_QUERY_PARAMETER);
		const value = paramValue.split('-')[0].toUpperCase();

		if (!VALID_ENVS.includes(value)) {
			console.warn(`Invalid environment: ${value}`);
			return 'PROD';
		}

		if (paramValue.endsWith('-save')) {
			sessionStorage.setItem(SESSION_KEY, value);
		} else {
			sessionStorage.removeItem(SESSION_KEY);
		}
		return value;
	}

	if (sessionValue && VALID_ENVS.includes(sessionValue)) {
		return sessionValue;
	}

	return 'PROD';
}

function createEnvironmentIndicator() {
	const env = detectTypeOfEnvironment();
	if (env === 'PROD') return;
	const indicator = document.createElement('div');
	indicator.textContent = `FunnelEnvy Altloader Environment: ${env}`;
	Object.assign(indicator.style, {
		position: 'fixed',
		top: '10px',
		left: '10px',
		fontSize: '12px',
		color: 'red',
		zIndex: '999999',
		pointerEvents: 'none'
	});
	document.body.appendChild(indicator)
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

// Module level - tracks variants loaded this page session
const loadedVariants = [];

function loadVariation(activity) {
	const activityName = activity.activity;
	const variations = activity.variants;
	const storageValue = getJSONFromMemory(COOKIE_NAME) || { variations: {} };
	const storageVariations = storageValue.variations || {};

	// Check if variant already exists in cookie BEFORE any modifications
	const existingVariant = storageVariations?.[activityName];
	const hadValidVariant = existingVariant && variations?.[existingVariant];

	// --- Helper: Weighted random selection ---
	function selectVariation() {
		let totalWeight = 0;
		for (const key in variations) {
			totalWeight += variations[key].weight;
		}

		let rand = Math.random() * totalWeight;
		let sum = 0;

		for (const key in variations) {
			sum += variations[key].weight;
			if (rand <= sum) {
				return key;
			}
		}

		return Object.keys(variations)[Object.keys(variations).length - 1];
	}

	function loadVariantScript(activity, variantKey) {
		const basePath = `${bucketPath}/${activity.group.toLowerCase()}/v2`;
		const env = detectTypeOfEnvironment();
		const filename = `fe_activity_${activity.activity}_${variantKey}${env === 'PROD' ? '.min' : ''}.js`;
		attachJsFile(`${basePath}/${filename}`);
	}

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
				conditions: [() => typeof window.clarity === 'function'],
				activity: 'fe_altloader',
				callback: () => {
					window.clarity('set', 'experiment_id', experiment);
					window.clarity('set', 'variant_id', variant);
				},
			});
		} catch (err) {}
	}

	function setTrackMetricsLink(experiment, variant) {
		try {
			window.feUtils.waitForConditions({
				conditions: [() => typeof window.trackMetrics === 'function'],
				activity: 'fe_altloader',
				callback: () => {
					window.trackMetrics('new.link', { link_name: `mp:fe-experiment:fe-altloader:${experiment}:${variant}` });
				},
			});
		} catch (err) {}
	}

	// --- 1. Handle FE_VARIANT override (no tracking) ---
	const variantOverride = getQueryParamVariantOverride();
	const overrideVariant = variantOverride?.[activityName];

	if (overrideVariant && variations?.[overrideVariant]) {
		storageVariations[activityName] = overrideVariant;
		setJSONToMemory(COOKIE_NAME, { ...storageValue, variations: storageVariations });
		setClarityTags(activityName, overrideVariant);
		setTrackMetricsLink(activityName, overrideVariant);
		loadVariantScript(activity, overrideVariant);
		// No tracking for overrides
		return;
	}

	// --- 2. Normal flow ---
	let selectedVariation;

	if (hadValidVariant) {
		selectedVariation = existingVariant;
	} else {
		selectedVariation = selectVariation();
		storageVariations[activityName] = selectedVariation;
		setJSONToMemory(COOKIE_NAME, { ...storageValue, variations: storageVariations });
	}

	// Track this load (only for trackable activities starting with '3')
	if (activityName.startsWith('3')) {
		loadedVariants.push({
			activity: activityName,
			variant: selectedVariation,
			isNew: !hadValidVariant,
		});
	}

	setClarityTags(activityName, selectedVariation);
	setTrackMetricsLink(activityName, selectedVariation);
	loadVariantScript(activity, selectedVariation);
}

// Call this after all activities have been processed
function sendVariantLoadTracking() {
	if (loadedVariants.length === 0) return;

	// Deduplicate: prevent multiple API calls if script loads twice
	const TRACKING_KEY = 'fe_tracking_sent';
	const pageLoadId = `${window.location.href}_${performance.timeOrigin}`;

	if (sessionStorage.getItem(TRACKING_KEY) === pageLoadId) {
		return; // Already sent for this page load
	}
	sessionStorage.setItem(TRACKING_KEY, pageLoadId);

	const cookie = getJSONFromMemory(COOKIE_NAME) ?? {};
	const env = detectTypeOfEnvironment();

	// Determine if this is a conversion page

	fetch('https://funnelenvy.retool.com/url/track-hits', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			cookie,
			env,
			variants: loadedVariants,
		}),
	});
}

function sendConversionTracking() {
	const pathname = window.location.pathname ?? '';
	let conversion_type = '';
	let internal_id = '';
	let env = window.FeActivityLoader.detectTypeOfEnvironment();
	const cookie = getJSONFromStorage(COOKIE_NAME) ?? {};
	if (pathname.includes('/quoteConfirmSummary')) {
		internal_id = pathname.match(/\/quote\/([^\/]+)\/quoteConfirmSummary$/)?.[1] ?? '';
		conversion_type = 'quote';
	} else if (pathname.includes('/orderConfirmation')) {
		internal_id = pathname.match(/\/checkout\/orderConfirmation\/([^\/]+)$/)?.[1] ?? '';
		conversion_type = 'order';
	}
	if (conversion_type === '') return;
	const activities = Object.keys(cookie?.variations ?? {});
	if (activities.filter(a => a.startsWith('3')).length > 0) {
		fetch('https://funnelenvy.retool.com/url/track-conversion', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				internal_id,
				conversion_type,
				cookie,
				env,
			}),
		});
	}
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

const getAccountIDFromURL = (url) => {
	const configuratorUrl = url ? url : window.location.href;
	const searchParams = new URLSearchParams(configuratorUrl.split('?')[1]);
	return searchParams.get('orgid') || null;
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
	const params = new URLSearchParams(window.location.search);
	if (params.has(ENV_QUERY_PARAMETER) && params.get(ENV_QUERY_PARAMETER) === 'disable') {
		return;
	}
	createEnvironmentIndicator();
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
			if (detectConfiguratorCustomerAudience(getAccountIDFromURL(), activity.audiences)) {
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
	
	sendConversionTracking();
	// sendVariantLoadTracking();
	// Clean up any stored variations for activities that no longer exist or are disabled
	cleanupStoredVariations();
}

loadActivities();
