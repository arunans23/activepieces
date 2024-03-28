import { createPiece, Piece, PieceAuth, Property } from '@activepieces/pieces-framework';

export const nocodbAuth = PieceAuth.CustomAuth({
	description: `
  1. Log in to your NocoDB Account.
  2. Click on your profile-pic(bottom-left) and navigate to **Account Settings->Tokens**.
  3. Create new token with any name and copy API Token.
  4. Your Base URL is where your app is hosted.`,
	props: {
		baseUrl: Property.ShortText({
			displayName: 'NocoDB Base URL',
			required: true,
			defaultValue: 'https://app.nocodb.com',
		}),
		apiToken: PieceAuth.SecretText({
			displayName: 'API Token',
			required: true,
		}),
	},
	required: true,
});

export const nocodb = createPiece({
	displayName: 'NocoDB',
	auth: nocodbAuth,
	minimumSupportedRelease: '0.20.0',
	logoUrl: 'https://cdn.activepieces.com/pieces/nocodb.png',
	authors: [],
	actions: [],
	triggers: [],
});
