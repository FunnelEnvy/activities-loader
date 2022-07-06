(function () {
	if (typeof window.feReusableFnB2B != 'undefined')
		return; // if feReusableFnB2B is a thing, then do not run 2x

	//this thing is not used for making sure we do not inject JS more than once
	if (window && !window.FE_LOADER) {
		window.FE_LOADER_v2 = [];
	}

	var activities = [];

	type SiteInterface = {
		name: string;
		url_has: string | string[];
		url_missing?: string | string[];
	}
	type SitesInterface = SiteInterface[];
	var sites: SitesInterface = [//this block is in case activities.json is missing
		{
			name: "ARUBA",
			url_has: "buy.hpe.com/aruba"
		},
		{
			name: "B2B",
			url_has: "b2b.hpe.com"
		},
		{
			name: "B2BH",
			url_has: "buy.hpe.com/b2b",
			url_missing: "uatc.buy.hpe.com/b2b"
		},
		{
			name: "B2B-H-UATC",
			url_has: "uatc.buy.hpe.com/b2b"
		}
	];
	var lang = 'en';

	// ALL FE libraries should go in ONE place, currently we have 2
	window.feReusableFnB2B = {

		clone: function (obj) {
			return JSON.parse(JSON.stringify(obj))
		},

		sendTrackEvent(eventName: string, attributes: any) {
			try {
			var routerURL = "https://router.funnelenvy.com";
			var xhr = new XMLHttpRequest();
			xhr.open("POST", routerURL + '/track', true);
			xhr.setRequestHeader('Content-Type', 'application/json');

			xhr.send(JSON.stringify({
				orgId: 'd27c9d78-5e89-4bde-8cec-67315aa23700',
				version: '2020-11-01',
				action: 'updateAttributes',
				identities: [
					{
						source: "individual",
						identifier: attributes.email || window.hpmmd.user.id || '',
						event: {
							name: eventName,
							attributes: Object.assign(attributes, {
								url: window.location.href || '',
							}),
						},
					},
				],
			}));
		} catch (err) {}
		},

		// waitfor jQuery
		doWhenJqueryLoaded: function (todoWhenLoaded) {
			var waitForjQuery = setInterval(
				function () {
					if (typeof window.jQuery != 'undefined') {
						let $ = window.jQuery;
						clearInterval(waitForjQuery);
						todoWhenLoaded();
					}
				}, 100);
			setTimeout(function () {
				clearInterval(waitForjQuery);
			}, 5000);
		},
		// wait for vanilla DOM element ready
		doWhenDomLoaded: function (element, todoWhenLoaded) {
			var waitForDOm = setInterval(function () {
				if (document && document.querySelectorAll(element) && document.querySelectorAll(element).length) {
					clearInterval(waitForDOm);
					todoWhenLoaded();
				}
			}, 100);
			setTimeout(function () {
				clearInterval(waitForDOm);
			}, 6000);
		},
		// wait for jQuery element
		doWhenElementLoaded: function (element, todoWhenLoaded) {
			var waitForElement = setInterval(
				function () {
					if ($(element).length > 0) {
						clearInterval(waitForElement);
						todoWhenLoaded();
					}
				}, 100);
			setTimeout(function () {
				clearInterval(waitForElement);
			}, 6000);
		},
		log: function (message, argB) {
			if (typeof argB !== 'undefined')
				message = [message, argB];
			if (/fecli|QA_test|FE_LOADER|jump/.test(location.href)) {
				console && console.log(message);
			} else if (this.detectTypeOfEnvironment() == 'DEV') {
				console && console.log(message);
			} else if (location.href.indexOf('hc9t07003') >= 0 || location.href.indexOf('itg.buy.hpe.com') >= 0) {
				console && console.log(message);
			}
		},
		doWhenAllElementsLoaded: function (arrElements, todoWhenLoaded) {
			var waitForElement = setInterval(
				function () {
					var eleFound = 0;
					arrElements
						.map(function (element) {
							if ($(element).length > 0) {
								eleFound++;
							}
						});
					if (eleFound >= arrElements.length) {
						clearInterval(waitForElement);
						todoWhenLoaded();
					}
				}, 100);
			setTimeout(function () {
				clearInterval(waitForElement);
			}, 6000);
		},
		findGetParameter: function (parameterName, href) {
			//todo remove this version and merge it to getQueryParam
			var result = null,
				tmp = [];
			href = href ? href : location.search
			var items = href.substr(1).split("&");
			for (var index = 0; index < items.length; index++) {
				tmp = items[index].split("=");
				if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
			}
			return result;
		},
		//TODO DRY OUT
		getQueryParam: function (field, url) {//regex=yuk
			var href = url ? url : location.search;//  window.location.href;
			if (href.indexOf('?')) href = href.split('?').pop()
			return this.findGetParameter(field, href)
			//var reg = new RegExp('[?&]' + field + '=([^&#]*)', 'i');
			//var string = reg.exec(href);
			//return string ? decodeURIComponent(string[1]) : null;
		},
		doesUrlMatch: function (urlFragements) {
			if (typeof urlFragements === 'string')
				urlFragements = [urlFragements];
			var isFound = false;
			if (typeof urlFragements === 'undefined' || !urlFragements || urlFragements.length < 1) {
				isFound = true;
			} else {
				urlFragements.map(function (f) {
					if (window.location.href.indexOf(f) >= 0)
						isFound = true;
				});
			}

			return isFound;
		},
		sortByField: function (fld) {
			return function (a, b) {
				if (a[fld] && b[fld]) {
					if (a[fld] > b[fld]) return 1;
					else if (a[fld] < b[fld]) return -1;
					else return 0;
				} else if (a[fld] && !b[fld]) {
					return 1;
				} else if (!a[fld] && b[fld]) {
					return -1;
				}
			}
			return 0;
		},
		salt: function (ttlSeconds) {
			ttlSeconds = ttlSeconds ? ttlSeconds : 60;
			return Math.round(Date.now() / ttlSeconds / 1000) + '';
		},
		setCookie: function (name, value, days) {
			var expires = '';
			if (days) {
				var date = new Date();
				date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
				expires = '; expires=' + date.toUTCString();
			}
			document.cookie = name + '=' + (value || '') + expires + '; path=/';
		},
		getCookie: function (name) {
			var nameEQ = name + '=';
			var ca_temp = document.cookie.split(';');
			var ca = ca_temp
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
			/*			for (var i = 0; i < ca.length; i++) {
							var c = ca[i];
							while (c.charAt(0) == ' ')
								c = c.substring(1, c.length);
							if (c.indexOf(nameEQ) == 0)
								return c.substring(nameEQ.length, c.length);
						}*/
		},
		currencies: {//copied from https://buy.hpe.com/_ui/dist/js/all.min.js
			'CH': {'symbol': 'CHF ', 'symbolPosition': 'begin', 'decimal': '.', 'comma': '\''},     // Switzerland-
			'CA': {'symbol': '$', 'symbolPosition': 'begin', 'decimal': '.', 'comma': ','},      // Canada-
			'US': {'symbol': '$', 'symbolPosition': 'begin', 'decimal': '.', 'comma': ','},      // United States-
			'UK': {'symbol': '£', 'symbolPosition': 'begin', 'decimal': '.', 'comma': ','},      // United Kingdom-
			'CZ': {'symbol': ' Kč', 'symbolPosition': 'end', 'decimal': '.', 'comma': ','},      // Czech Republic-
			'DK': {'symbol': ' kr', 'symbolPosition': 'end', 'decimal': ',', 'comma': '.'},      // Denmark-
			'SE': {'symbol': ' kr', 'symbolPosition': 'end', 'decimal': ',', 'comma': ' '},      // Sweden-
			'IL': {'symbol': '$', 'symbolPosition': 'begin', 'decimal': '.', 'comma': ','},      // Israel -
			'PL': {'symbol': ' zł', 'symbolPosition': 'end', 'decimal': ',', 'comma': '.'},      // Poland -
			'NO': {'symbol': ' kr', 'symbolPosition': 'end', 'decimal': ',', 'comma': '.'},      // Norway -
			'AT': {'symbol': ' €', 'symbolPosition': 'end', 'decimal': ',', 'comma': '.'},      // Austria-
			'BE': {'symbol': ' €', 'symbolPosition': 'end', 'decimal': '.', 'comma': ','},      // Belgium-
			'JP': {'symbol': ' 円', 'symbolPosition': 'end', 'decimal': '.', 'comma': ','},      // Belgium-
			'BR': {'symbol': '$', 'symbolPosition': 'begin', 'decimal': ',', 'comma': '.'},      // Brazil-
			'DE': {'symbol': ' €', 'symbolPosition': 'end', 'decimal': ',', 'comma': ' '},      // Germany-
			'FR': {'symbol': ' €', 'symbolPosition': 'end', 'decimal': ',', 'comma': ' '},      // France -
			'ES': {'symbol': ' €', 'symbolPosition': 'end', 'decimal': ',', 'comma': '.'},      // Spain-
			'PT': {'symbol': ' €', 'symbolPosition': 'end', 'decimal': '.', 'comma': ','},      // Portugal-
			'IE': {'symbol': ' €', 'symbolPosition': 'end', 'decimal': '.', 'comma': ','},      // Ireland-
			'EMEA_EUROPE': {'symbol': ' €', 'symbolPosition': 'end', 'decimal': '.', 'comma': ','},      // emea-aurope
			'FI': {'symbol': ' €', 'symbolPosition': 'end', 'decimal': '.', 'comma': ','},      // Finland -
			'IT': {'symbol': ' €', 'symbolPosition': 'end', 'decimal': ',', 'comma': '.'},      // Italy -
			'NL': {'symbol': ' €', 'symbolPosition': 'end', 'decimal': ',', 'comma': '.'},      // Netherlands -
			'MX': {'symbol': '$', 'symbolPosition': 'begin', 'decimal': '.', 'comma': ','},         // Mexico -
			'LAMERICA': {'symbol': '$', 'symbolPosition': 'begin', 'decimal': '.', 'comma': ','},         // lamerica -
			'MY': {'symbol': ' MYR', 'symbolPosition': 'end', 'decimal': '.', 'comma': ','},        // Malaysia -
			'SG': {'symbol': ' SGD', 'symbolPosition': 'end', 'decimal': '.', 'comma': ','},        // Singapore -
			'TW': {'symbol': ' NT$', 'symbolPosition': 'begin', 'decimal': '.', 'comma': ','}         // Singapore -
		},
		roundMoney: function (currencyValue) {
			var cc = this.findTargetCountry().toUpperCase();
			cc = cc ? cc : 'USD';
			currencyValue = (Math.round(currencyValue * 100) / 100);
			if (!window.feReusableFnB2B.currencies[cc]) {
				console && console.error(' roundMoney() failed with values', currencyValue, cc);
				return null;
			}
			var separatorSymbol = this.currencies[cc].comma;
			var decimalSymbol = this.currencies[cc].decimal;
			var symbolPosition = this.currencies[cc].symbolPosition
			var currencysymbol = this.currencies[cc].symbol;

			const currencyString = currencyValue.toString().split('.');
			const integerPart = currencyString[0];
			const integerPartGrouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, separatorSymbol);
			if (symbolPosition === 'end') {
				return integerPartGrouped + currencysymbol;
			} else {
				return currencysymbol + integerPartGrouped;
			}
		},
		currencyToNumber: function (money, cc) {
			cc = cc ? cc : this.findTargetCountry().toUpperCase();
			cc = cc ? cc : 'US';
			if (!this.currencies[cc]) {
				console && console.error(' currencyToNumber() failed with values', money, cc);
				return null;
			}
			var comma = this.currencies[cc].comma;
			var decimal = this.currencies[cc].decimal;
			var symbol = this.currencies[cc].symbol;
			return money.toString()
				.split(symbol).join('')
				.split(comma).join('')
				.split(' ').join('')
				.split('\t').join('')
				.split(decimal).join('.')
				.trim() * 1;
		},
		// NOT safe if money is passed in wrong mode
		//formatMoney: function (money, isDecimalMode) {// delema, is this in normal format or decimal-comma inversion?
		//	var m = money * 1;
		//	//console && console.log('formatMoney', money, m, isDecimalMode);
		//	if (!isDecimalMode)
		//		m = this.currencyToNumber(money).toFixed(2);
		//	if (!m) return '';
		//	var cc = this.findTargetCountry().toUpperCase();
		//	cc = cc ? cc : 'US';
		//	if (this.currencies[cc]) {
		//		var getCurrencyData = this.currencies[cc];
		//		return m.formatMoney(m + '', getCurrencyData['decimal'], getCurrencyData['comma'], getCurrencyData['symbolPosition'], getCurrencyData['symbol']);
		//	}
		//	return (m).formatMoneyInternational(this.findTargetCountry().toUpperCase());
		//},


		isB2b: function () {
			return (window.location.href.indexOf('b2b.hpe.com') >= 0);
		},
		isB2bHybris: function () {
			return (window.location.href.indexOf('buy.hpe.com/b2b') >= 0);
		},
		setActivities: function (newActivities) {
			if (newActivities) activities = newActivities;
		},
		getActivities: function (newSites) {
			return activities;
		},
		setSites: function (newSites) {
			if (newSites) sites = newSites;
		},
		getSites: function (newSites) {
			return sites;
		},
		detectSlickCarousel: function () {
			return typeof ($('body') as any).slick != 'undefined';
		},
		detectActivitiesToActivate: function () {
			var site = this.detectTypeOfSite();
			var env = this.detectTypeOfEnvironment();
			return activities
				.filter(function (activity) {//by env
					var out = false;
					//console.log('detectActivitiesToActivate activity', activity)
					if (!activity.env) return false;
					activity.env.map(function (actEnv) {
						//	console.log('detectActivitiesToActivate actSite', actSite, site)
						out = out || actEnv == env;
					})
					//if (env == "DEV")
					//	console && console.log('detectActivitiesToActivate by env activity', out, activity)

					return out;
				})
				.filter(function (activity) {//by site
					var out = false;
					if (!activity.sites) return false;
					if (activity.block_mtp7 && this.detectSlickCarousel())
						return false; //Activity is to be OFF for MTP7
					activity.sites.map(function (actSite) {
						//	console.log('detectActivitiesToActivate actSite', actSite, site)
						out = out || actSite == site;
					})
					//if (env == "DEV")
					//	console && console.log('detectActivitiesToActivate by site activity', out, activity)

					return out;
				})
				.filter(function (activity) {//by url_has
					if (!activity.url_has || activity.url_has.length < 1) return true;
					var matches = activity.url_has.filter(
						function (urlFragment) {
							return (window.location.href.indexOf(urlFragment) >= 0);
						});
					return matches.length > 0;
				})
				.filter(function (activity) {//by url_missing
					if (!activity.url_missing || activity.url_missing.length < 1) return true;
					if (typeof activity.url_missing == 'string') activity.url_missing = [activity.url_missing]
					var matches = activity.url_missing.filter(
						function (urlFragment) {
							return (window.location.href.indexOf(urlFragment) >= 0);
						});
					return matches.length === 0;// if you found one, then 1<>0
				});
		},
		attachJsFile: function (src) {
			if (window.FE_LOADER_v2 && window.FE_LOADER_v2.indexOf(src) >= 0) return;
			window.FE_LOADER_v2.push(src)
			var salt = this.salt(60 * 5);//Math.round(Date.now() / 360 / 1000);// 6min
			var rc = document.getElementsByTagName('head')[0];
			var sc = document.createElement('script');
			sc.src = "https://fe-hpe-script.s3.us-east-2.amazonaws.com/" + src + "?_t=" + salt;
			if (rc)
				rc.appendChild(sc);
		},
		/**
		 * If a cookie is set, then use it to decide environment used
		 *
		 * To Set cookie include in URL
		 * 			FE_LOADER=DEV_COOKIE or FE_LOADER=QA_COOKIE
		 * To clear cookie include in URL
		 * 			FE_LOADER= or FE_LOADER=PROD
		 *
		 * To load page with a given environment and without setting a cookie
		 * 			FE_LOADER=QA or FE_LOADER=DEV
		 * @returns {string|null}
		 */
		detectTypeOfEnvironment: function () {
			//use cookies first
			var envs = ['DEV', 'QA', 'PROD'];
			var cookieName = 'fe-alt-load-env';
			var cooked = this.getCookie(cookieName)
			if (window.location.href.indexOf('FE_LOADER=DEV_COOKIE') > 0) {
				this.setCookie(cookieName, 'DEV', 1);
				return "DEV";
			} else if (window.location.href.indexOf('FE_LOADER=QA_COOKIE') > 0) {
				this.setCookie(cookieName, 'QA', 1);
				return "QA";
			} else if (window.location.href.indexOf('FE_LOADER=PROD') > 0) {
				this.setCookie(cookieName, '', 1);
				return "PROD";
			} else if (window.location.href.indexOf('FE_LOADER=') > 0) {
				this.setCookie(cookieName, '', 1)
			}
			if (cooked && cooked.length > 1 && envs.indexOf(cooked) >= 0) {
				return cooked;//whatever saved in cookie
			}

			//otherwise try narmal way
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
		},
		detectTypeOfSite: function () {
			var out = sites
				.filter(function (site) {
					var out = true;
					if (typeof site.url_has === 'string') site.url_has = [site.url_has]
					if (typeof site.url_missing === 'undefined') site.url_missing = []
					if (typeof site.url_missing === 'string') site.url_missing = [site.url_missing]
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
		},
		injectCss: function (strCss, projectId) {
			if (!strCss) return;
			try {
				var rc = document.getElementsByTagName('head')[0];
				var style = document.createElement('style');
				if (projectId)
					style.id = projectId;
				style.type = 'text/css';
				style.appendChild(document.createTextNode(strCss));
				rc.appendChild(style);
			} catch (err) {
				console && console.error('FE: failed to injectCss()', projectId)
			}
		},

		epochSeconds: function () {
			return Math.floor((new Date()).getTime() / 1000)
		},

		/**
		 * ops:
		 * 			onError call back function on fail()
		 * 		storeType string [session|local]
		 * 		cacheTtl number seconds to cache
		 *
		 * @param url string
		 * @param cb function
		 * @param storeType string [session|local]
		 * @param cacheTtl number seconds to cache
		 * @param ops {*|(storeType:string,cacheTtl:number,onError:function)}
		 * @return {*|((...data: any[]) => void)}
		 */
		cachedFetchJson: function (url, cb, ops) {
			var key = 'FE::' + url
			cb = cb ? cb : console.log
			ops = ops ? ops : {}
			var cacheTtl = ops && ops.cacheTtl ? ops.cacheTtl : 60 * 10//10min

			function defaultOnError(jqxhr, textStatus, error) {
				var err = textStatus + ", " + error;
				console.error("FE: Request Failed: " + err);
			}

			ops.onError = ops.onError ? ops.onError : defaultOnError
			var now = this.epochSeconds()
			var storage = ops && ops.storeType && ops.storeType == 'local' ? localStorage : sessionStorage
			var cFromStorage = storage.getItem(key);
			if (cFromStorage && typeof cFromStorage == 'string') {
				try {
					var c = JSON.parse(c)
				} catch (err) {
					console.error('FE: feReusableFnB2B.cachedFetchJson() : url,str,error', url, c, err)
				}
				if (c && c.resp
					&& c.epoch
					&& (c.epoch + cacheTtl) >= now) {
					return cb(c.resp)
				}
				storage.setItem(key, null);//CLEAR IT as it is too old or broken
			}
			//?_salt=' + feReusableFnB2B.salt(60 * 5);
			if (url.indexOf('?') < 0) url += '?_salt=' + this.salt(60 * 60);//1hr
			$.getJSON(url, function (resp) {// still @ mercy of browser cache but that is fine
				storage.setItem(key, JSON.stringify({epoch: now, resp}));
				cb(resp)
			}).fail(ops.onError);
		},
	};


	//	window.feReusableFnB2B.doWhenJqueryLoaded(window.FEi18n.setIsReady);

})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
	function adopt(value) {
		return value instanceof P ? value : new P(function (resolve) {
			resolve(value);
		});
	}

	return new (P || (P = Promise))(function (resolve, reject) {
		function fulfilled(value) {
			try {
				step(generator.next(value));
			} catch (e) {
				reject(e);
			}
		}

		function rejected(value) {
			try {
				step(generator["throw"](value));
			} catch (e) {
				reject(e);
			}
		}

		function step(result) {
			result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
		}

		step((generator = generator.apply(thisArg, _arguments || [])).next());
	});
};
var __generator = (this && this.__generator) || function (thisArg, body) {
	var _ = {
		label: 0, sent: function () {
			if (t[0] & 1) throw t[1];
			return t[1];
		}, trys: [], ops: []
	}, f, y, t, g;
	return g = {
		next: verb(0),
		"throw": verb(1),
		"return": verb(2)
	}, typeof Symbol === "function" && (g[Symbol.iterator] = function () {
		return this;
	}), g;

	function verb(n) {
		return function (v) {
			return step([n, v]);
		};
	}

	function step(op) {
		if (f) throw new TypeError("Generator is already executing.");
		while (_) try {
			if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
			if (y = 0, t) op = [op[0] & 2, t.value];
			switch (op[0]) {
				case 0:
				case 1:
					t = op;
					break;
				case 4:
					_.label++;
					return {value: op[1], done: false};
				case 5:
					_.label++;
					y = op[1];
					op = [0];
					continue;
				case 7:
					op = _.ops.pop();
					_.trys.pop();
					continue;
				default:
					if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
						// _ = 0;
						continue;
					}
					if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
						_.label = op[1];
						break;
					}
					if (op[0] === 6 && _.label < t[1]) {
						_.label = t[1];
						t = op;
						break;
					}
					if (t && _.label < t[2]) {
						_.label = t[2];
						_.ops.push(op);
						break;
					}
					if (t[2]) _.ops.pop();
					_.trys.pop();
					continue;
			}
			op = body.call(thisArg, _);
		} catch (e) {
			op = [6, e];
			y = 0;
		} finally {
			f = t = 0;
		}
		if (op[0] & 5) throw op[1];
		return {value: op[0] ? op[1] : void 0, done: true};
	}
}
