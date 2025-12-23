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
	const user = String(userAudience ?? '').trim();
	const userOrg = user.slice(0, 10);

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
	const auiIncludeMatch = auiInc.length > 0 && auiInc.some(x => x === user);
	const auiExcludeMatch = auiExc.length > 0 && auiExc.some(x => x === user);

	// org_party: list entries should start with the user's first 10 chars
	const opiIncludeMatch = opiInc.length > 0 && opiInc.some(x => x.startsWith(userOrg));
	const opiExcludeMatch = opiExc.length > 0 && opiExc.some(x => x.startsWith(userOrg));

	// Exclusions always win
	if (auiExcludeMatch || opiExcludeMatch) return false;

	// If any include lists exist, must match at least one include (AU or OP)
	const hasAnyInclude = auiInc.length > 0 || opiInc.length > 0;
	if (hasAnyInclude) return auiIncludeMatch || opiIncludeMatch;

	// No includes defined, and not excluded ⇒ include
	return true;
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
	const ENV_QUERY_PARAMETER = 'fe_env';
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

function passQueryParametersToB2BConfiguratorIFrame() {
	// only run on cart configuration page
	if (window.location.pathname.indexOf('/cart/configure') === -1) return;
	const IFRAME_ID = 'configure_cart';
	const alterIframeSrc = () => {
	const iframe = document.getElementById(IFRAME_ID);
		if (iframe && iframe.src) {
			const pageParams = new URLSearchParams(window.location.search);
			const srcURL = new URL(iframe.src);
			const variants = pageParams.has(VARIATIONS_QUERY_PARAMETER) ? pageParams.get(VARIATIONS_QUERY_PARAMETER) : null;
			const environment = pageParams.has(ENV_QUERY_PARAMETER) ? pageParams.get(ENV_QUERY_PARAMETER) : null;

			if (environment) {
				srcURL.searchParams.set(ENV_QUERY_PARAMETER, environment);
			}
			if (variants) {
				srcURL.searchParams.set(VARIATIONS_QUERY_PARAMETER, variants);
			}
			iframe.src = srcURL.toString();
		}
	};

	window.feUtils.waitForConditions({
		conditions: [`iframe#${IFRAME_ID}`],
		activity: 'fe-altloader',
		callback: alterIframeSrc,
	});
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
	const storageValue = getJSONFromMemory(COOKIE_NAME) || { variations: {} };
	const storageVariations = storageValue.variations || {};

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
					window.trackMetrics('new.link', { link_name: `mp:fe-experiment:fe-altloader:${experiment}:${variant}` });
				},
			});
		} catch(err) {}
	}

	// --- 1. Handle FE_VARIANT override ---
	const variantOverride = getQueryParamVariantOverride();
	const overrideVariant = variantOverride?.[activityName];

	if (overrideVariant && variations?.[overrideVariant]) {
		// set storage to value used in override
		storageVariations[activityName] = overrideVariant;
		setJSONToMemory(COOKIE_NAME, { ...storageValue, variations: storageVariations });
		setClarityTags(activityName, overrideVariant);
		setTrackMetricsLink(activityName, overrideVariant);
		// Load overridden variant without modifying storage
		loadVariantScript(activity, overrideVariant, env);
		return;
	}

	// --- 2. Normal flow using storage or selection ---
	let selectedVariation = storageVariations?.[activityName];

	if (!selectedVariation || !variations?.[selectedVariation]) {
		selectedVariation = selectVariation(variations);
		storageVariations[activityName] = selectedVariation;
		setJSONToMemory(COOKIE_NAME, { ...storageValue, variations: storageVariations });
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
	const params = new URLSearchParams(window.location.search);
	passQueryParametersToB2BConfiguratorIFrame();
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
	
	// Clean up any stored variations for activities that no longer exist or are disabled
	cleanupStoredVariations();
}

loadActivities();
