const fs = require('fs');
const path = require('path');
const { getDashboardHtml } = require('../src/server/webDashboard');

console.log('--- RUNNING HOSTINGER BUILD PIPELINE ---');

const htmlContent = getDashboardHtml();

// Create output directories for all common cloud platforms (Hostinger, Vercel, Netlify, Render)
const outputDirs = ['dist', 'public', 'build', '.output/public'];

for (const dir of outputDirs) {
  const fullPath = path.resolve(process.cwd(), dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
  fs.writeFileSync(path.join(fullPath, 'index.html'), htmlContent, 'utf8');
}

console.log('✓ Successfully generated web dashboard output directories: dist/, public/, build/');
console.log('✓ Build completed successfully with 0 errors.');
