using CatalogService as service from '../../srv/catservice';
annotate service.AssetCategorieSrv with @(
    UI.HeaderInfo : {
        TypeName       : 'Category',
        TypeNamePlural : 'Categories',
        Title          : { Value : name }
    },
    UI.SelectionFields : [ name ],
    UI.LineItem : [
        { Value : name,           Label : 'Category',        ![@UI.Importance] : #High },
        { Value : lifespanMonths, Label : 'Lifespan (months)', ![@UI.Importance] : #High }
    ],
    UI.Facets : [
        { $Type : 'UI.ReferenceFacet', ID : 'GeneralFacet', Label : 'Category Details', Target : '@UI.FieldGroup#General' },
        { $Type : 'UI.ReferenceFacet', ID : 'AssetsFacet',  Label : 'Assets',           Target : 'assets/@UI.LineItem' }
    ],
    UI.FieldGroup #General : {
        Data : [
            { Value : name,           Label : 'Category Name' },
            { Value : lifespanMonths, Label : 'Lifespan (months)' }
        ]
    }
);
 
annotate service.AssetCategorieSrv with {
    name           @title : 'Category';
    lifespanMonths @title : 'Lifespan (months)';
};
 