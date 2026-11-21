const { defineConfig, devices } = require('@playwright/test');
module.exports=defineConfig({testDir:'./tests',timeout:30000,retries:0,reporter:[['list'],['html',{open:'never'}]],use:{headless:true},projects:[{name:'chromium',use:{...devices['Desktop Chrome']}},{name:'mobile-webkit',use:{...devices['iPhone 13']}}]});
