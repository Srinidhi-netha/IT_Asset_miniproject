sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"assets/test/integration/pages/AssetSrvList.gen",
	"assets/test/integration/pages/AssetSrvObjectPage.gen"
], function (JourneyRunner, AssetSrvListGenerated, AssetSrvObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('assets') + '/test/flp.html#app-preview',
        pages: {
			onTheAssetSrvListGenerated: AssetSrvListGenerated,
			onTheAssetSrvObjectPageGenerated: AssetSrvObjectPageGenerated
        },
        async: true
    });

    return runner;
});

