using CatalogService as service from '../../srv/catservice';
annotate service.MaintenanceRecordSrv with @(
    UI.HeaderInfo : {
        TypeName       : 'Maintenance Record',
        TypeNamePlural : 'Maintenance Records',
        Title          : { Value : asset.assetTag },
        Description    : { Value : type }
    },
    UI.SelectionFields : [ type, status, reportedDate ],
    UI.Facets : [
        { $Type : 'UI.ReferenceFacet', ID : 'GeneralFacet', Label : 'Maintenance Details', Target : '@UI.FieldGroup#General' }
    ],
    UI.FieldGroup #General : {
        Data : [
            { Value : asset.assetTag,      Label : 'Asset' },
            { Value : type,                Label : 'Type' },
            { Value : serviceVendor.name,  Label : 'Service Vendor' },
            { Value : status,              Label : 'Status' },
            { Value : reportedDate,        Label : 'Reported' },
            { Value : completedDate,       Label : 'Completed' },
            { Value : outcome,             Label : 'Outcome' },
            { Value : cost,                Label : 'Cost' },
            { Value : coveredByWarranty,   Label : 'Covered by Warranty' },
            { Value : description,         Label : 'Description' }
        ]
    },
    Capabilities.InsertRestrictions : { Insertable : false },
    Capabilities.UpdateRestrictions : { Updatable  : false },
    Capabilities.DeleteRestrictions : { Deletable  : false }
);
 
annotate service.MaintenanceRecordSrv with {
    type         @title : 'Type';
    status       @title : 'Status';
    reportedDate @title : 'Reported';
};
 