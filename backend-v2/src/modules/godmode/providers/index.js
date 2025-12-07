"use strict";

const { runDiscoveryProviders } = require("./providersRunner");
const { discoverWithGooglePlaces, providerKey: googlePlacesKey } = require("./googlePlacesProvider");

module.exports = {
  runDiscoveryProviders,
  providers: {
    [googlePlacesKey]: discoverWithGooglePlaces
  }
};
