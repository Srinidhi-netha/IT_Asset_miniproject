sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"categories/test/integration/pages/AssetCategorieSrvList.gen",
	"categories/test/integration/pages/AssetCategorieSrvObjectPage.gen"
], function (JourneyRunner, AssetCategorieSrvListGenerated, AssetCategorieSrvObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('categories') + '/test/flp.html#app-preview',
        pages: {
			onTheAssetCategorieSrvListGenerated: AssetCategorieSrvListGenerated,
			onTheAssetCategorieSrvObjectPageGenerated: AssetCategorieSrvObjectPageGenerated
        },
        async: true
    });

    return runner;
});

