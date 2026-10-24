using CatalogService as service from '../../srv/catservice';
annotate service.ArchiveRecordSrv with @(
    UI.HeaderInfo : {
        TypeName       : 'Archive Record',
        TypeNamePlural : 'Retirement & Archive',
        Title          : { Value : asset.assetTag },
        Description    : { Value : reason }
    },
    UI.SelectionFields : [ reason, disposalMethod ],
    UI.Facets : [
        { $Type : 'UI.ReferenceFacet', ID : 'GeneralFacet', Label : 'Archive Details', Target : '@UI.FieldGroup#General' }
    ],
    UI.FieldGroup #General : {
        Data : [
            { Value : asset.assetTag,    Label : 'Asset' },
            { Value : archivedAt,        Label : 'Archived On' },
            { Value : reason,            Label : 'Reason' },
            { Value : disposalMethod,    Label : 'Disposal Method' },
            { Value : disposalCertNo,    Label : 'Certificate No.' }
        ]
    },
    Capabilities.InsertRestrictions : { Insertable : false },
    Capabilities.UpdateRestrictions : { Updatable  : false },
    Capabilities.DeleteRestrictions : { Deletable  : false }
);
 
annotate service.ArchiveRecordSrv with {
    reason         @title : 'Reason';
    disposalMethod @title : 'Disposal Method';
};
 