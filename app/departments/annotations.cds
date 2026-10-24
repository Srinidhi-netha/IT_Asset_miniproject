using CatalogService as service from '../../srv/catservice';
annotate service.DepartmentSrv with @(
    UI.HeaderInfo : {
        TypeName       : 'Department',
        TypeNamePlural : 'Departments',
        Title          : { Value : name },
        Description    : { Value : costCenter }
    },
    UI.SelectionFields : [ name, costCenter ],
    UI.LineItem : [
        { Value : name,       Label : 'Department',  ![@UI.Importance] : #High },
        { Value : costCenter, Label : 'Cost Center', ![@UI.Importance] : #High }
    ],
    UI.Facets : [
        { $Type : 'UI.ReferenceFacet', ID : 'GeneralFacet',   Label : 'Department Details', Target : '@UI.FieldGroup#General' },
        { $Type : 'UI.ReferenceFacet', ID : 'EmployeesFacet', Label : 'Employees',          Target : 'employees/@UI.LineItem' }
    ],
    UI.FieldGroup #General : {
        Data : [
            { Value : name,Label : 'Department Name' },
            { Value : costCenter, Label : 'Cost Center' }
        ]
    }
);
 
annotate service.DepartmentSrv with {
    name       @title : 'Department';
    costCenter @title : 'Cost Center';
};
 