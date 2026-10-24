sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"archive/test/integration/pages/ArchiveRecordSrvList.gen",
	"archive/test/integration/pages/ArchiveRecordSrvObjectPage.gen"
], function (JourneyRunner, ArchiveRecordSrvListGenerated, ArchiveRecordSrvObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('archive') + '/test/flp.html#app-preview',
        pages: {
			onTheArchiveRecordSrvListGenerated: ArchiveRecordSrvListGenerated,
			onTheArchiveRecordSrvObjectPageGenerated: ArchiveRecordSrvObjectPageGenerated
        },
        async: true
    });

    return runner;
});

