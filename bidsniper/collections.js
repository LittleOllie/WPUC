/**
 * Known on-chain collections across LO Labs apps (TradePort, Web3House).
 * Merged by contract address — used for BidSniper quick-pick dropdown only.
 */
(function (global) {
  "use strict";

  /** @type {Array<{id:string,name:string,shortName:string,chain:string,contract:string,openSea:string}>} */
  var COLLECTIONS = [
    {
      id: "akidcalledbeast",
      name: "A Kid Called Beast",
      shortName: "AKCB",
      chain: "eth",
      contract: "0x77372a4cc66063575b05b44481f059be356964a4",
      openSea: "https://opensea.io/collection/akidcalledbeast",
    },
    {
      id: "call-of-the-stars",
      name: "Call of the Stars",
      shortName: "COTS",
      chain: "eth",
      contract: "0x11ad9906f148c6b452f9617b350ce5c98660ab1c",
      openSea: "https://opensea.io/collection/call-of-the-stars",
    },
    {
      id: "ddg",
      name: "DropDed Gorgez",
      shortName: "DDG",
      chain: "eth",
      contract: "0x9c51a3cb5094b26aa1dcb380f3dc7e1a7c681c2d",
      openSea: "https://opensea.io/collection/gorgez",
    },
    {
      id: "ghost-lab",
      name: "Ghost Labs",
      shortName: "Ghost Labs",
      chain: "eth",
      contract: "0x375dfbe7ebdf082276fc0cb9447932dc1bb6e306",
      openSea: "https://opensea.io/collection/ghost-lab-collection",
    },
    {
      id: "lessthanthree",
      name: "Less Than Three",
      shortName: "LT3",
      chain: "eth",
      contract: "0x4ef6f6a7ee7d1cf7f1f7bfad2ba56baab868de48",
      openSea: "https://opensea.io/collection/lessthanthree",
    },
    {
      id: "killabears",
      name: "Killabears",
      shortName: "KB",
      chain: "eth",
      contract: "0xc99c679c50033bbc5321eb88752e89a93e9e83c5",
      openSea: "https://opensea.io/collection/killabears",
    },
    {
      id: "longlost",
      name: "The Long Lost",
      shortName: "Long Lost",
      chain: "eth",
      contract: "0x1347a97789cd3aa0b11433e8117f55ab640a0451",
      openSea: "https://opensea.io/collection/the-long-lost",
    },
    {
      id: "ogenies",
      name: "OGenies",
      shortName: "OGenies",
      chain: "eth",
      contract: "0x5b12e009e1b5f14b1e8f3a3b9fb3ca165702dcbd",
      openSea: "https://opensea.io/collection/ogenienft",
    },
    {
      id: "quirklings",
      name: "Quirklings",
      shortName: "Quirklings",
      chain: "eth",
      contract: "0x8f1b132e9fd2b9a2b210baa186bf1ae650adf7ac",
      openSea: "https://opensea.io/collection/quirklings",
    },
    {
      id: "officialrugdollz",
      name: "Rug Dollz",
      shortName: "Rug Dollz",
      chain: "eth",
      contract: "0x291ac379af66e25bd8488b3154f076b27b9f9e36",
      openSea: "https://opensea.io/collection/officialrugdollz",
    },
    {
      id: "quirkies",
      name: "Quirkies",
      shortName: "Quirkies",
      chain: "eth",
      contract: "0xd4b7d9bb20fa20ddada9ecef8a7355ca983cccb1",
      openSea: "https://opensea.io/collection/quirkiesoriginals",
    },
    {
      id: "spaceriders",
      name: "Space Riders",
      shortName: "Space Riders",
      chain: "eth",
      contract: "0xc9d198089d6c31d0ca5cc5b92c97a57a97bbfde2",
      openSea: "https://opensea.io/collection/spaceriders",
    },
  ];

  COLLECTIONS.sort(function (a, b) {
    return a.name.localeCompare(b.name);
  });

  function getById(id) {
    return COLLECTIONS.find(function (c) {
      return c.id === id;
    }) || null;
  }

  function getByContract(contract) {
    var key = String(contract || "")
      .trim()
      .toLowerCase();
    return (
      COLLECTIONS.find(function (c) {
        return c.contract.toLowerCase() === key;
      }) || null
    );
  }

  global.BIDSNIPER_COLLECTIONS = {
    list: COLLECTIONS,
    getById: getById,
    getByContract: getByContract,
  };
})(window);
