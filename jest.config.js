module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',
  // A map from regular expressions to paths to transformers
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      // Use tsconfig-paths to resolve path aliases like `~/utils`
      tsconfig: 'tsconfig.json',
    }],
  },
  // An array of regexp pattern strings that are matched against all source file paths before transformation
  transformIgnorePatterns: ['<rootDir>/node_modules/'],
  moduleNameMapper: {
    // This mapping must match the "paths" in your tsconfig.json
    '^~/(.*)$': '<rootDir>/src/$1',
  },
};