const fs = require('fs');

const bundlePath = "C:\\Users\\ASUS\\.gemini\\antigravity-ide\\brain\\b4c85105-ed82-403f-a9c4-ad9f8cda295e\\.system_generated\\steps\\389\\content.md";
const bundleContent = fs.readFileSync(bundlePath, 'utf8');

// The bundle contains the defaultCategories array directly compiled.
// Look for [{id:"web",icon...
const startIndex = bundleContent.indexOf('[{id:"web"');
if (startIndex !== -1) {
    // We need to parse this JS array. Since it's compiled JS, it might be tricky to JSON.parse it directly.
    // Let's use regex to find sections within categories.
    // We'll split by `{id:"` which indicates a new category.
    const chunks = bundleContent.slice(startIndex).split('{id:"');
    
    // We only care about the first 6 chunks (web, api, android, ios, thick, web3)
    const validIds = ['web', 'api', 'android', 'ios', 'thick', 'web3'];
    const mappings = {};
    
    let currentCategory = null;
    
    // Alternative approach: the bundle is JavaScript. We can extract the raw array string using matching brackets
    let brackets = 0;
    let arrayStr = '';
    for(let i = startIndex; i < bundleContent.length; i++) {
        if(bundleContent[i] === '[') brackets++;
        if(bundleContent[i] === ']') brackets--;
        arrayStr += bundleContent[i];
        if(brackets === 0) break;
    }
    
    // Write arrayStr to a file to inspect it
    fs.writeFileSync('extracted_array.js', 'module.exports = ' + arrayStr + ';');
    console.log('Array extracted. Check extracted_array.js');
} else {
    console.log('Could not find categories array');
}
