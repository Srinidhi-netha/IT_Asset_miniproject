using CatalogService as service from '../../srv/catservice';

annotate service.AssetSrv with @(
    UI.HeaderInfo : {
        TypeName       : 'Asset',
        TypeNamePlural : 'Hardware Assets',
        Title          : { Value : assetTag },
        Description    : { Value : model }
    },

    UI.SelectionFields : [
        assetTag,
        serialNumber,
        status
    ],

    UI.LineItem : [
        { Value : assetTag,                 Label : 'Asset' },
        { Value : serialNumber,             Label : 'Serial Number' },
        { Value : category.name,            Label : 'Category' },
        { Value : status, Label : 'Status', Criticality : statusCriticality, ![@UI.Importance] : #High },
        { Value : currentHolder.fullName,   Label : 'Owner' },
        { Value : currentHolder.location,   Label : 'Location' },
        { Value : vendor.name,              Label : 'Vendor' }
    ]
);

annotate service.AssetSrv with {
    assetTag     @title : 'Asset Tag';
    serialNumber @title : 'Serial Number';
    status       @title : 'Status';
};

annotate service.AssetSrv with @(
    UI.Facets : [
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'GeneralFacet',
            Label  : 'General Information',
            Target : '@UI.FieldGroup#General'
        },
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'PurchaseFacet',
            Label  : 'Purchase & Warranty',
            Target : '@UI.FieldGroup#Purchase'
        },
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'OwnershipFacet',
            Label  : 'Ownership',
            Target : '@UI.FieldGroup#Ownership'
        },
                {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'HistoryFacet',
            Label  : 'Ownership History',
            Target : 'ownershipHistory/@UI.LineItem'
        },
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'MaintenanceFacet',
            Label  : 'Maintenance Records',
            Target : 'maintenanceRecords/@UI.LineItem'
        },
                {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'ArchiveFacet',
            Label  : 'Archive Record',
            Target : 'archiveRecords/@UI.LineItem'
        }

    ],

    UI.FieldGroup #General : {
        Data : [
            { Value : assetTag,      Label : 'Asset Tag' },
            { Value : serialNumber,  Label : 'Serial Number' },
            { Value : model,         Label : 'Model' },
            { Value : category_category_ID, Label : 'Category' },
            { Value : status, Label : 'Status', Criticality : statusCriticality },
        ]
    },

    UI.FieldGroup #Purchase : {
        Data : [
            { Value : vendor_vendor_ID, Label : 'Vendor' },
            { Value : purchaseDate,     Label : 'Purchase Date' },
            { Value : purchaseCost,     Label : 'Purchase Cost' },
            { Value : warrantyExpiry,   Label : 'Warranty Expiry' }
        ]
    },

       UI.FieldGroup #Ownership : {
        Data : [
            { Value : currentHolder_employee_ID, Label : 'Current Holder' },
            {
                Value : currentHolder.location,
                Label : 'Location',
                ![@Common.FieldControl] : #ReadOnly
            },
            { Value : firstDistributionDate,    Label : 'First Distribution Date' }
        ]
    }
);

annotate service.AssetSrv with {
    category      @Common.ValueList : {
        CollectionPath : 'AssetCategorieSrv',
        Parameters     : [
            { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : category_category_ID, ValueListProperty : 'category_ID' },
            { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'name' }
        ]
    };
    vendor        @Common.ValueList : {
        CollectionPath : 'VendorSrv',
        Parameters     : [
            { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : vendor_vendor_ID, ValueListProperty : 'vendor_ID' },
            { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'name' }
        ]
    };
    currentHolder @Common.ValueList : {
        CollectionPath : 'EmployeeSrv',
        Parameters     : [
            { $Type : 'Common.ValueListParameterInOut', LocalDataProperty : currentHolder_employee_ID, ValueListProperty : 'employee_ID' },
            { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'fullName' }
        ]
    };
};

annotate service.AssetSrv with {
    category      @Common.Text : category.name         @Common.TextArrangement : #TextOnly;
    vendor        @Common.Text : vendor.name           @Common.TextArrangement : #TextOnly;
    currentHolder @Common.Text : currentHolder.fullName @Common.TextArrangement : #TextOnly;
};

annotate service.OwnershipLedgerSrv with @(
    UI.LineItem : [
        { Value : transitionDate,       Label : 'Date' },
        { Value : action,               Label : 'Action' },
        { Value : fromEmployee.fullName, Label : 'From' },
        { Value : toEmployee.fullName,   Label : 'To' },
        { Value : recordedBy.fullName,   Label : 'Recorded By' },
        { Value : notes,                Label : 'Notes' }
    ]
);

annotate service.MaintenanceRecordSrv with @(
    UI.LineItem : [
        { Value : asset.assetTag, Label : 'Asset' },
        { Value : reportedDate,         Label : 'Reported' },
        { Value : type,                 Label : 'Type' },
        { Value : serviceVendor.name,   Label : 'Vendor' },
        { Value : status,               Label : 'Status' },
        { Value : outcome,              Label : 'Outcome' },
        { Value : cost,                 Label : 'Cost' },
        { Value : completedDate,        Label : 'Completed' }
    ]
);

annotate service.AssetSrv with @(
    UI.Identification : [
        { $Type : 'UI.DataFieldForAction', Action : 'CatalogService.assign',              Label : 'Assign' },
        { $Type : 'UI.DataFieldForAction', Action : 'CatalogService.returnAsset',         Label : 'Return' },
        { $Type : 'UI.DataFieldForAction', Action : 'CatalogService.sendToMaintenance',   Label : 'Send to Maintenance' },
        { $Type : 'UI.DataFieldForAction', Action : 'CatalogService.completeMaintenance', Label : 'Complete Maintenance' },
        { $Type : 'UI.DataFieldForAction', Action : 'CatalogService.retire',              Label : 'Retire' },
        { $Type : 'UI.DataFieldForAction', Action : 'CatalogService.archive',             Label : 'Archive' }
    ]
);

annotate service.ArchiveRecordSrv with @(
    UI.LineItem : [
        { Value : asset.assetTag, Label : 'Asset' },
        { Value : archivedAt,      Label : 'Archived On' },
        { Value : reason,          Label : 'Reason' },
        { Value : disposalMethod,  Label : 'Disposal Method' },
        { Value : disposalCertNo,  Label : 'Certificate No.' }
    ]
);