/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
	preset: 'ts-jest',
	testTimeout: 30000,
	testEnvironment: 'jsdom',
	setupFiles: [ "<rootDir>/test-env.js" ],
};
