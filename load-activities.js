const activities = [];
const sites = [];

function getActivities() {
	return activities;
}

function setActivities(newActivities) {
	activities = newActivities;
}

function getActivityById(id) {
	return activities.find((activity) => {
		return activity && activity.projectId === id;
	});
}

function getSelectorsDictionaryById(id) {
	getActivityById(id);
	return f && f.selectorsDictionary ? f.selectorsDictionary : null;
}

function getSites() {
	return sites;
}

function setSites(newSites) {
	sites = newSites;
}

function getCookie(name) {
	var nameEQ = name + '=';
	var ca = document.cookie.split(';');
	ca = ca
		.filter(function (c) {
			while (c.charAt(0) == ' ')
				c = c.substring(1, c.length);
			return (c.indexOf(nameEQ) == 0);
		})
		.map(function (c) {
			if (c) {
				c = c.trim();
				var pos = c.indexOf("=")
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
	var expires = '';
	if (days) {
		var date = new Date();
		date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
		expires = '; expires=' + date.toUTCString();
	}
	document.cookie = name + '=' + (value || '') + expires + '; path=/';
}

function detectTypeOfSite() {
	var out = sites
		.filter(function (site) {
			var out = true;
			if (typeof site.url_has == 'string') site.url_has = [site.url_has]
			if (typeof site.url_missing == 'undefined') site.url_missing = []
			if (typeof site.url_missing == 'string') site.url_missing = [site.url_missing]
			site.url_has.map(function (url) {
				if (window.location.href.indexOf(url) < 0) out = false;
			})
			site.url_missing.map(function (url) {
				if (window.location.href.indexOf(url) >= 0) out = false;
			})
			return out;
		})
		.shift();
	return out ? out.name : '';
}

function detectTypeOfEnvironment() {
	//use cookies first
	var envs = ['DEV', 'QA', 'PROD'];
	var cookieName = 'fe-alt-load-env';
	var cooked = getCookie(cookieName)
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
	var urlFragsDev = ["QA_test=DACL", "FE_LOADER=DEV", "itg."];
	var isDev = false;
	var urlFragsQa = ["FE_LOADER=QA", "uat."];
	var isQa = false;

	urlFragsDev.map(function (uf) {
		if (window.location.href.indexOf(uf) >= 0)
			isDev = true;
	});
	if (isDev) return 'DEV';

	urlFragsQa.map(function (uf) {
		if (window.location.href.indexOf(uf) >= 0)
			isQa = true;
	});
	if (isQa) return 'QA';

	return "PROD";
}

function detectActivitiesToActivate() {
	var site = detectTypeOfSite();
	var env = detectTypeOfEnvironment();
	return activities
		.filter((activity) => { //by env
			if (!activity.enable) return false;
			var out = false;
			if (!activity.env) return false;
			activity.env.map(function (actEnv) {
				out = out || actEnv == env;
			})
			return out;
		})
		.filter((activity) => { //by site
			var out = false;
			if (!activity.sites) return false;
			// TODO: Ask Jason if this is needed
			// if (activity.block_mtp7 && feReusableFn.detectSlickCarousel())
			// 	return false; //Activity is to be OFF for MTP7
			activity.sites.map(function (actSite) {
				//	console.log('detectActivitiesToActivate actSite', actSite, site)
				out = out || actSite == site;
			})
			return out;
		})
		.filter((activity) => { //by url_has
			if (!activity.url_has || activity.url_has.length < 1) return true;
			var matches = activity.url_has.filter(
				function (urlFragment) {
					return (window.location.href.indexOf(urlFragment) >= 0);
				});
			return matches.length > 0;
		})
		.filter((activity) => { //by url_missing
			if (!activity.url_missing || activity.url_missing.length < 1) return true;
			if (typeof activity.url_missing == 'string') activity.url_missing = [activity.url_missing]
			var matches = activity.url_missing.filter(
				function (urlFragment) {
					return (window.location.href.indexOf(urlFragment) >= 0);
				});
			return matches.length === 0; // if you found one, then 1<>0
		});
}

function attachJsFile(src) {
	if (window.FE_LOADER_v2 && window.FE_LOADER_v2.indexOf(src) >= 0) return;
	window.FE_LOADER_v2.push(src)
	var salt = salt(60 * 5);//Math.round(Date.now() / 360 / 1000);// 6min
	var rc = document.getElementsByTagName('head')[0];
	var sc = document.createElement('script');
	sc.src = src + "?_t=" + salt;
	if (rc)
		rc.appendChild(sc);
}

function salt(ttlSeconds) {
	ttlSeconds = ttlSeconds ? ttlSeconds : 60;
	return Math.round(Date.now() / ttlSeconds / 1000) + '';
}
