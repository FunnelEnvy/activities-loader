export {};

declare global {
	interface Window {
		rootorg_id: string;
		userAccountId: string;
		feReusableFnB2B: {
			injectCss: (strMinifiedCss: string, feProjectId: string) => void;
		}
		hpelite: {
			params: {
				quoteCheckoutVM?: any,
					quoteSummaryVM?: {
						checkoutInfo?: {
							quoteId?: string;
						},
					}
			}
		},
			headerData?: {
				user?: {
					rootorg_id?: string;
				},
			},
	}
}
