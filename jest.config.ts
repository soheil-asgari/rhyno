import nextJest from "next/jest.js"
import { Config } from "@jest/types"

// Provide the path to your Next.js app to load next.config.js and .env files in your test environment
const createJestConfig = nextJest({
  dir: "./"
})

// Add any custom config to be passed to Jest
const config: Config.InitialOptions = {
  coverageProvider: "v8",
  testEnvironment: "jsdom"
  // setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}

// Export the config
export default createJestConfig(config)
