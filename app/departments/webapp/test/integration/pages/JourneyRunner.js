sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"departments/test/integration/pages/DepartmentSrvList.gen",
	"departments/test/integration/pages/DepartmentSrvObjectPage.gen"
], function (JourneyRunner, DepartmentSrvListGenerated, DepartmentSrvObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('departments') + '/test/flp.html#app-preview',
        pages: {
			onTheDepartmentSrvListGenerated: DepartmentSrvListGenerated,
			onTheDepartmentSrvObjectPageGenerated: DepartmentSrvObjectPageGenerated
        },
        async: true
    });

    return runner;
});

