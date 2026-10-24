using CatalogService as service from '../../srv/catservice';
annotate service.VendorSrv with @(
    UI.HeaderInfo : {
        TypeName       : 'Vendor',
        TypeNamePlural : 'Vendors',
        Title          : { Value : name },
        Description    : { Value : email }
    },
    UI.SelectionFields : [ name, email ],
    UI.LineItem : [
        { Value : name,  Label : 'Vendor', ![@UI.Importance] : #High },
        { Value : email, Label : 'Email',  ![@UI.Importance] : #High }
    ],
    UI.Facets : [
        { $Type : 'UI.ReferenceFacet', ID : 'GeneralFacet', Label : 'Vendor Details', Target : '@UI.FieldGroup#General' },
        { $Type : 'UI.ReferenceFacet', ID : 'AssetsFacet',  Label : 'Assets Supplied', Target : 'assets/@UI.LineItem' }
    ],
    UI.FieldGroup #General : {
        Data : [
            { Value : name,  Label : 'Vendor Name' },
            { Value : email, Label : 'Email' }
        ]
    }
);
 
annotate service.VendorSrv with {
    name  @title : 'Vendor';
    email @title : 'Email';
};
 