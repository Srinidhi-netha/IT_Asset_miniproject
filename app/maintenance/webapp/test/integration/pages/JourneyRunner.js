sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"maintenance/test/integration/pages/MaintenanceRecordSrvList.gen",
	"maintenance/test/integration/pages/MaintenanceRecordSrvObjectPage.gen"
], function (JourneyRunner, MaintenanceRecordSrvListGenerated, MaintenanceRecordSrvObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('maintenance') + '/test/flp.html#app-preview',
        pages: {
			onTheMaintenanceRecordSrvListGenerated: MaintenanceRecordSrvListGenerated,
			onTheMaintenanceRecordSrvObjectPageGenerated: MaintenanceRecordSrvObjectPageGenerated
        },
        async: true
    });

    return runner;
});

