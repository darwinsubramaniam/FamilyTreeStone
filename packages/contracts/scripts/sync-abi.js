const fs = require("fs");
const path = require("path");

const artifact = require("../artifacts/contracts/FamilyTree.sol/FamilyTree.json");
const abi = JSON.stringify(artifact.abi, null, 2);

const outPath = path.join(__dirname, "../../ui/src/generated/abi.ts");
const outDir = path.dirname(outPath);

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(
  outPath,
  `// Auto-generated from contract compilation. Do not edit.\nexport const familyTreeAbi = ${abi} as const;\n`
);

console.log("ABI synced to packages/ui/src/generated/abi.ts");
