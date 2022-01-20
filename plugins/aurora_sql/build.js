const path = require('path');
const fs = require('fs');
const gen = require(path.join(__dirname, 'genschema.js'));


let config = process.argv[2];

let baseDir = process.argv[6];
let outputDir = process.argv[4];
let allPlugins = JSON.parse(process.argv[8]);
let myPlugin = path.relative(baseDir,__dirname);
let genDir = path.join(process.argv[7], myPlugin);

fs.mkdirSync(genDir, {recursive:true});
let schemas = [];
let namespaceMap = {};
allPlugins.forEach(function (plugin) {
    fs.readdirSync(plugin).forEach(function (fileName) {
        if (fileName.endsWith('.schema.json')) {
            let fullFileName = path.join(baseDir, plugin, fileName);
            try {
                let def = JSON.parse(fs.readFileSync(fullFileName));
                let nsItem = namespaceMap[def.namespace] || {files: []};
                namespaceMap[def.namespace] = nsItem;
                nsItem.files.push(path.join(baseDir, plugin, fileName));
            }
            catch(e) {
                console.error("error parsing file", fullFileName);
                throw e;
            }
        }
    });
});

for (let ns in namespaceMap) {
	gen.generateSchema(namespaceMap[ns].files,
            ns, path.join(genDir, ns + '.schema'));
}
