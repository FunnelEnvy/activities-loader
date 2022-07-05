export {};

declare global {
	var strMinifiedCss: string;
	var feProjectId: string;
	interface hpmmd {
		page: {
			name: string,
		},
	};
	interface Window {
		FE_LOADER: any;
		FE_LOADER_v2: any;
		jQuery: any;
		rootorg_id: string;
		userAccountId: string;
		feReusableFnB2B: any;
		hpelite: {
			params: {
				quoteCheckoutVM?: any;
				quoteSummaryVM?: {
					checkoutInfo?: {
						quoteId?: string;
					};
				};
			};
		};
		hpmmd: {
			user: {
				id: string;
			};
		};
		headerData?: {
			user?: {
				rootorg_id?: string;
			};
		};
	};
}
