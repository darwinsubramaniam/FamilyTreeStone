import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const FamilyTreeModule = buildModule("FamilyTreeModule", (m) => {
  const familyTree = m.contract("FamilyTree");
  return { familyTree };
});

export default FamilyTreeModule;
