sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"employees/test/integration/pages/EmployeeSrvList.gen",
	"employees/test/integration/pages/EmployeeSrvObjectPage.gen"
], function (JourneyRunner, EmployeeSrvListGenerated, EmployeeSrvObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('employees') + '/test/flp.html#app-preview',
        pages: {
			onTheEmployeeSrvListGenerated: EmployeeSrvListGenerated,
			onTheEmployeeSrvObjectPageGenerated: EmployeeSrvObjectPageGenerated
        },
        async: true
    });

    return runner;
});

