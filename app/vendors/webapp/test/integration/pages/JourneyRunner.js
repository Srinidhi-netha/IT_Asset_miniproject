sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"vendors/test/integration/pages/VendorSrvList.gen",
	"vendors/test/integration/pages/VendorSrvObjectPage.gen"
], function (JourneyRunner, VendorSrvListGenerated, VendorSrvObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('vendors') + '/test/flp.html#app-preview',
        pages: {
			onTheVendorSrvListGenerated: VendorSrvListGenerated,
			onTheVendorSrvObjectPageGenerated: VendorSrvObjectPageGenerated
        },
        async: true
    });

    return runner;
});

