// backend-v2/src/shared/ai/promptLoader.js
const fs = require('fs');
const path = require('path');

function loadPrompt(relativePath) {
  const fullPath = path.join(__dirname, '..', '..', 'prompts', relativePath);
  return fs.readFileSync(fullPath, 'utf8');
}

module.exports = {
  loadPrompt
};