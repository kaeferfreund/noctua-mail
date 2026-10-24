import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'review.spec.ts',workers:1,retries:0,timeout:360000,expect:{timeout:20000},outputDir:'extra-results',reporter:'list',use:{baseURL:'http://localhost:3799',headless:true,browserName:'chromium',screenshot:'off',trace:'off',video:'off'}});
