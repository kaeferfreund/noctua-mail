import { defineConfig } from '@playwright/test';
import base from '../playwright.qa-shell.config';
export default defineConfig(base,{testDir:'.',testMatch:'german320.spec.ts',outputDir:'german320-results'});
