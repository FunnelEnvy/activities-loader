export {};

declare global {
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
		headerData?: {
			user?: {
				rootorg_id?: string;
			};
		};
	};
}
